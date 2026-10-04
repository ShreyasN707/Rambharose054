classdef MqttLite < handle
    % Minimal MQTT 3.1.1 client on MATLAB's built-in tcpclient.
    %
    % Publishes and subscribes at QoS 0 only. It replaces paho-mqtt via
    % MATLAB's Python interface, so the simulator needs no pyenv setup and
    % runs the same on Linux, Windows and macOS.
    %
    %   c = MqttLite("127.0.0.1", 1883, "sim");
    %   c.subscribe("engine/engine_001/fault");
    %   c.publish("engine/engine_001/telemetry", payload);
    %   msgs = c.poll();   % struct array with fields topic, payload
    %   c.disconnect();

    properties (Access = private)
        conn
        buffer = uint8([])
        keepalive
        lastSent
        nextPacketId = 1
    end

    methods
        function obj = MqttLite(host, port, clientId, keepalive)
            if nargin < 4
                keepalive = 60;
            end
            obj.keepalive = keepalive;
            obj.conn = tcpclient(char(host), double(port), ...
                "ConnectTimeout", 10, "Timeout", 10);

            % CONNECT: protocol "MQTT" level 4, clean session.
            body = [MqttLite.str("MQTT"), uint8(4), uint8(2), ...
                MqttLite.u16(keepalive), MqttLite.str(clientId)];
            obj.send(uint8(16), body);

            % CONNACK: 0x20, length 2, session flag, return code.
            ack = read(obj.conn, 4, "uint8");
            if ack(1) ~= 32 || ack(4) ~= 0
                error("MqttLite:connect", ...
                    "MQTT broker refused the connection (code %d).", ack(4));
            end
        end

        function publish(obj, topic, payload)
            body = [MqttLite.str(topic), MqttLite.bytes(payload)];
            obj.send(uint8(48), body);
        end

        function subscribe(obj, topic)
            id = obj.nextPacketId;
            obj.nextPacketId = mod(id, 65535) + 1;
            body = [MqttLite.u16(id), MqttLite.str(topic), uint8(0)];
            obj.send(uint8(130), body);
        end

        function msgs = poll(obj)
            % Returns the messages received since the last poll and keeps
            % the connection alive. SUBACK and PINGRESP are discarded.
            msgs = struct("topic", {}, "payload", {});

            if obj.conn.NumBytesAvailable > 0
                obj.buffer = [obj.buffer, ...
                    read(obj.conn, obj.conn.NumBytesAvailable, "uint8")];
            end

            while true
                [type, body, consumed] = MqttLite.parse(obj.buffer);
                if consumed == 0
                    break;
                end
                obj.buffer = obj.buffer(consumed + 1:end);

                if bitshift(type, -4) == 3
                    topicLen = double(body(1)) * 256 + double(body(2));
                    payloadStart = 3 + topicLen;
                    if bitand(bitshift(type, -1), 3) > 0
                        payloadStart = payloadStart + 2;   % packet id
                    end
                    msgs(end + 1) = struct( ...
                        "topic", native2unicode(body(3:2 + topicLen), "UTF-8"), ...
                        "payload", native2unicode(body(payloadStart:end), "UTF-8")); %#ok<AGROW>
                end
            end

            if obj.keepalive > 0 && toc(obj.lastSent) > obj.keepalive / 2
                obj.send(uint8(192), uint8([]));   % PINGREQ
            end
        end

        function disconnect(obj)
            if ~isempty(obj.conn)
                try
                    obj.send(uint8(224), uint8([]));
                catch
                end
                obj.conn = [];
            end
        end

        function delete(obj)
            obj.disconnect();
        end
    end

    methods (Access = private)
        function send(obj, header, body)
            write(obj.conn, [header, MqttLite.varint(numel(body)), body]);
            obj.lastSent = tic;
        end
    end

    methods (Static, Access = private)
        function b = bytes(s)
            b = uint8(unicode2native(char(s), "UTF-8"));
        end

        function b = str(s)
            raw = MqttLite.bytes(s);
            b = [MqttLite.u16(numel(raw)), raw];
        end

        function b = u16(n)
            b = uint8([floor(n / 256), mod(n, 256)]);
        end

        function b = varint(n)
            b = uint8([]);
            while true
                digit = mod(n, 128);
                n = floor(n / 128);
                if n > 0
                    digit = digit + 128;
                end
                b(end + 1) = digit; %#ok<AGROW>
                if n == 0
                    break;
                end
            end
        end

        function [type, body, consumed] = parse(buf)
            % Splits one complete packet off the front of buf; consumed is
            % 0 when the buffer does not hold a whole packet yet.
            type = uint8(0);
            body = uint8([]);
            consumed = 0;
            if numel(buf) < 2
                return;
            end
            len = 0;
            multiplier = 1;
            pos = 2;
            while true
                if pos > numel(buf)
                    return;
                end
                len = len + double(bitand(buf(pos), 127)) * multiplier;
                if buf(pos) < 128
                    break;
                end
                multiplier = multiplier * 128;
                pos = pos + 1;
            end
            if numel(buf) < pos + len
                return;
            end
            type = buf(1);
            body = buf(pos + 1:pos + len);
            consumed = pos + len;
        end
    end
end
