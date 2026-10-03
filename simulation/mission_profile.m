function [t, u] = mission_profile(name, duration, seed)
%MISSION_PROFILE External inputs for one mission profile.
%
%   [t, u] = mission_profile(name, duration)
%   [t, u] = mission_profile(name, duration, seed)
%
%   Returns the 0.1 s time vector t and the input matrix
%   u = [throttle, engine_load, altitude_m, ambient_temp_C] for the
%   model's four root inports.
%
%   Without a seed (or with an empty one) the profile uses fixed nominal
%   values, used by the live stream. With a seed, its parameters are drawn
%   at random within realistic ranges, used for dataset generation.
%
%   ambient_temp_C is the outside air temperature at the aircraft's
%   altitude: it drives both air density (Environment_Model) and engine
%   cooling, so it follows the ISA lapse rate from the ground temperature.
%
%   Profiles:
%     cruise          steady level flight (nominal = the original live inputs)
%     high_altitude   climb to altitude, then cruise there
%     hot_weather     low-altitude flight on a hot day
%     endurance       long cruise at medium altitude with slow variations
%     rapid_throttle  repeated fast throttle changes at low altitude

if nargin < 3
    seed = [];
end

randomised = ~isempty(seed);
if randomised
    stream = RandStream('mt19937ar', 'Seed', seed);
else
    stream = [];
end

    function value = pick(nominal, low, high)
        % Nominal value for the live stream, uniform draw for datasets.
        if randomised
            value = low + (high - low) * rand(stream);
        else
            value = nominal;
        end
    end

lapse_rate = 0.0065;   % ISA temperature lapse rate (degC/m)

t = (0:0.1:duration)';
n = numel(t);

switch name
    case 'cruise'
        throttle = pick(1.0, 0.7, 1.0) * ones(n, 1);
        engine_load = pick(0.5, 0.4, 0.6) * ones(n, 1);
        altitude = pick(0, 0, 1500) * ones(n, 1);
        ground_temp = pick(25, 10, 35);

    case 'high_altitude'
        target_alt = pick(4500, 3000, 7500);    % m
        climb_rate = pick(6, 3, 8);             % m/s
        climb_end = target_alt / climb_rate;
        altitude = min(t * climb_rate, target_alt);
        % Full throttle while climbing, cruise power at altitude.
        throttle = pick(1.0, 0.9, 1.0) * ones(n, 1);
        throttle(t > climb_end) = pick(0.85, 0.7, 0.95);
        engine_load = pick(0.5, 0.4, 0.6) * ones(n, 1);
        ground_temp = pick(25, 10, 35);

    case 'hot_weather'
        throttle = pick(1.0, 0.7, 1.0) * ones(n, 1);
        engine_load = pick(0.55, 0.45, 0.65) * ones(n, 1);
        altitude = pick(500, 0, 1500) * ones(n, 1);
        ground_temp = pick(45, 40, 50);

    case 'endurance'
        % Long loiter: slow throttle and load wander around a cruise
        % setting, small altitude changes.
        base_throttle = pick(0.75, 0.6, 0.85);
        base_alt = pick(3000, 2000, 4500);
        period = pick(600, 400, 900);           % s
        phase = pick(0, 0, 2 * pi);
        throttle = base_throttle + 0.05 * sin(2 * pi * t / period + phase);
        engine_load = pick(0.45, 0.35, 0.55) ...
            + 0.05 * sin(2 * pi * t / (1.7 * period) + phase);
        altitude = base_alt + 300 * sin(2 * pi * t / (2.3 * period) + phase);
        ground_temp = pick(25, 10, 35);

    case 'rapid_throttle'
        % Throttle steps between low and high power every hold_time
        % seconds, each change taking ramp_time seconds.
        low = pick(0.4, 0.3, 0.5);
        high = pick(1.0, 0.85, 1.0);
        hold_time = pick(30, 15, 45);           % s
        ramp_time = pick(2, 1, 3);              % s
        cycle = mod(t, 2 * hold_time);
        up = min(cycle / ramp_time, 1);
        down = 1 - min(max(cycle - hold_time, 0) / ramp_time, 1);
        level = min(up, down);
        throttle = low + (high - low) * level;
        engine_load = pick(0.5, 0.4, 0.6) * ones(n, 1);
        altitude = pick(500, 0, 1500) * ones(n, 1);
        ground_temp = pick(25, 10, 35);

    otherwise
        error('mission_profile:unknown', ...
            'Unknown mission profile "%s". Valid: %s', name, ...
            strjoin(mission_profile_names(), ', '));
end

ambient = ground_temp - lapse_rate * altitude;

u = [throttle, engine_load, altitude, ambient];
end

function names = mission_profile_names()
names = {'cruise', 'high_altitude', 'hot_weather', 'endurance', ...
    'rapid_throttle'};
end
