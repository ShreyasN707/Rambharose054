function results = run_telemetry_scenarios(model_name, simulation_time, profile_names, fault_ids)
%RUN_TELEMETRY_SCENARIOS Simulate every fault ID under fixed input profiles.
%
%   results = run_telemetry_scenarios(model_name, simulation_time)
%   results = run_telemetry_scenarios(model_name, simulation_time, {'steady'})
%   results = run_telemetry_scenarios(model_name, simulation_time, [], 0:4)
%
%   Runs every Fault_ID (default 0..9) under two deterministic input
%   profiles and returns the logged telemetry_log bus for each run. Used by
%   check_signal_regression.m to prove that model changes leave the
%   existing telemetry signals untouched.
%
%   Profiles:
%     steady    - the live MQTT stream inputs (throttle 1, load 0.5,
%                 altitude 0 m, ambient 25 C)
%     transient - rapid throttle transitions, climb to 3000 m, hot day

if nargin < 1
    model_name = 'AeroPistonEngineSimulator';
end

if nargin < 2
    simulation_time = 300;
end

load_system(model_name);
evalin('base', 'engine_params;');

t = (0:0.1:simulation_time)';

profiles = struct();

profiles.steady = [
    ones(size(t)), ...
    0.5 * ones(size(t)), ...
    zeros(size(t)), ...
    25 * ones(size(t))
];

throttle = 0.6 * ones(size(t));
throttle(t >= 60) = 1.0;
throttle(t >= 120) = 0.4;
throttle(t >= 180) = 0.9;

profiles.transient = [
    throttle, ...
    0.3 + 0.4 * (t / simulation_time), ...
    3000 * min(t / 200, 1), ...
    40 * ones(size(t))
];

if nargin < 3 || isempty(profile_names)
    profile_names = fieldnames(profiles);
end

if nargin < 4 || isempty(fault_ids)
    fault_ids = 0:9;
end

results = struct();

for p = 1:numel(profile_names)
    profile_name = profile_names{p};

    for fault_id = fault_ids
        in = Simulink.SimulationInput(model_name);
        in = in.setExternalInput([t, profiles.(profile_name)]);
        in = in.setBlockParameter( ...
            [model_name '/Fault_ID'], 'Value', num2str(fault_id));
        in = in.setModelParameter('StopTime', num2str(simulation_time));

        out = sim(in);

        key = sprintf('%s_fault%d', profile_name, fault_id);
        results.(key) = out.telemetry_log;

        fprintf('%-20s done\n', key);
    end
end

end
