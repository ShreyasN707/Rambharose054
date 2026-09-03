%% simulink_mqtt_stream.m

clear;
clc;

model_name = "AeroPistonEngineSimulator";
fault_block = model_name + "/Fault_ID";

%% Load model + params

load_system(model_name);
engine_params;

%% Settings

simulation_time = 1200;   % 20 min
publish_interval = 1.0;

engine_id = "engine_001";
mission_id = "mission_001";

telemetry_topic = ...
    "engine/" + engine_id + "/telemetry";

fault_topic = ...
    "engine/" + engine_id + "/fault";

%% External inputs

t = (0:0.1:simulation_time)';

u = [
    ones(size(t)), ...
    0.5 * ones(size(t)), ...
    zeros(size(t)), ...
    25 * ones(size(t))
];

%% MQTT

mqtt = py.importlib.import_module( ...
    'paho.mqtt.client');

client = mqtt.Client();

client.connect( ...
    '127.0.0.1', ...
    int32(1883), ...
    int32(60));

client.loop_start();

fprintf("Connected to MQTT.\n");

%% Start healthy

current_fault = 0;

set_param( ...
    fault_block, ...
    "Value", ...
    num2str(current_fault));

%% Create live Simulation object

sm = simulation(model_name);

sm = setModelParameter( ...
    sm, ...
    StopTime=num2str(simulation_time));

%% Initialize

initialize(sm);

fprintf("\n");
fprintf("========================================\n");
fprintf("LIVE SIMULATION STARTED\n");
fprintf("Fault command topic:\n");
fprintf("%s\n", fault_topic);
fprintf("========================================\n\n");

%% Main live loop

next_time = publish_interval;

while next_time <= simulation_time

    %% -------------------------------------------------
    % Check requested fault
    %
    % We use a small file as the command bridge.
    % Default is whatever fault is already active.
    %% -------------------------------------------------

    command_file = "fault_command.txt";

    if isfile(command_file)

        raw = strtrim( ...
            fileread(command_file));

        requested_fault = str2double(raw);

        if ~isnan(requested_fault) && ...
                requested_fault ~= current_fault

            if requested_fault == 0 || ...
                    requested_fault == 1

                current_fault = requested_fault;

                setBlockParameter( ...
                    sm, ...
                    fault_block, ...
                    "Value", ...
                    num2str(current_fault));

                fprintf( ...
                    "\n>>> FAULT CHANGED TO %d at t=%.0fs <<<\n\n", ...
                    current_fault, ...
                    next_time - publish_interval);

            end
        end
    end

    %% Advance SAME simulation by 1 second

    finished = step( ...
        sm, ...
        PauseTime=next_time);

    % Step once more so output at the current
    % time hit is available
    step(sm);

    %% Get live simulation output

    simOut = sm.SimulationOutput;

    telemetry_log = ...
        simOut.telemetry_log;

    %% Latest telemetry values

    rpm = squeeze( ...
        telemetry_log.signal1.Data);

    fuel_flow = squeeze( ...
        telemetry_log.signal2.Data);

    torque = squeeze( ...
        telemetry_log.signal3.Data);

    oil_temperature = squeeze( ...
        telemetry_log.signal4.Data);

    oil_pressure = squeeze( ...
        telemetry_log.signal5.Data);

    cht = squeeze( ...
        telemetry_log.signal6.Data);

    egt = squeeze( ...
        telemetry_log.signal8.Data);

    vibration = squeeze( ...
        telemetry_log.signal9.Data);

    rpm = rpm(end);
    fuel_flow = fuel_flow(end);
    torque = torque(end);
    oil_temperature = oil_temperature(end);
    oil_pressure = oil_pressure(end);
    cht = cht(end);
    egt = egt(end);
    vibration = vibration(end);

    %% Real timestamp

    timestamp = datetime( ...
        "now", ...
        "TimeZone", ...
        "UTC");

    timestamp.Format = ...
        "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'";

    %% Build telemetry JSON

    payload = sprintf([ ...
        '{"timestamp":"%s",' ...
        '"engine_id":"%s",' ...
        '"mission_id":"%s",' ...
        '"rpm":%.3f,' ...
        '"torque":%.3f,' ...
        '"cht":%.3f,' ...
        '"egt":%.3f,' ...
        '"oil_pressure":%.3f,' ...
        '"oil_temperature":%.3f,' ...
        '"fuel_flow":%.3f,' ...
        '"vibration":%.3f}' ...
        ], ...
        char(timestamp), ...
        engine_id, ...
        mission_id, ...
        rpm, ...
        torque, ...
        cht, ...
        egt, ...
        oil_pressure, ...
        oil_temperature, ...
        fuel_flow, ...
        vibration);

    %% MQTT publish

    msg = client.publish( ...
        telemetry_topic, ...
        payload, ...
        int32(1));

    msg.wait_for_publish();

    fprintf( ...
        "t=%4.0fs | fault=%d | RPM=%7.1f | Torque=%5.2f | CHT=%6.1f | EGT=%7.1f\n", ...
        next_time, ...
        current_fault, ...
        rpm, ...
        torque, ...
        cht, ...
        egt);

    %% Real-time pacing

    pause(publish_interval);

    next_time = ...
        next_time + publish_interval;

    if finished
        break;
    end

end

%% Stop simulation

if sm.Status ~= "inactive"
    stop(sm);
end

%% Disconnect MQTT

client.loop_stop();
client.disconnect();

fprintf("\n");
fprintf("========================================\n");
fprintf("LIVE SIMULATION FINISHED\n");
fprintf("========================================\n");