function generate_sim_dataset(out_dir, seeds, profiles, fault_ids)
%GENERATE_SIM_DATASET Simulate the ML training dataset (raw part).
%
%   generate_sim_dataset(out_dir, seeds)
%   generate_sim_dataset(out_dir, seeds, profiles, fault_ids)
%
%   Runs one simulation per (seed, mission profile, Fault_ID) and writes
%   <out_dir>/raw/<run_id>.csv (1 Hz telemetry, as the live stream
%   publishes it) and <out_dir>/raw/<run_id>.json (run settings).
%   ai/dataset/label_dataset.py then adds the expected healthy values,
%   health scores, failure time and labels. Existing runs are skipped, so
%   an interrupted generation can be resumed by calling it again.
%
%   Each run randomises, from its own random stream:
%     - the mission profile parameters (mission_profile.m with a seed),
%     - fault onset, uniform 120-300 s after engine start,
%     - fault ramp time, by fault speed class (see RAMP_RANGES),
%     - the seeds of every noise source in the model, so no two runs
%       share a noise pattern.
%   Fault runs last onset + ramp + 300 s (labelling trims them to 60 s
%   after failure); healthy runs last 900-1500 s.
%
%   Defaults: all five profiles and Fault_IDs 0-9. Seeds 1-4 are the train
%   split, 5 validation and 6 test (assigned by label_dataset.py).

if nargin < 3 || isempty(profiles)
    profiles = {'cruise', 'high_altitude', 'hot_weather', 'endurance', ...
        'rapid_throttle'};
end
if nargin < 4 || isempty(fault_ids)
    fault_ids = 0:9;
end

mdl = 'AeroPistonEngineSimulator';
load_system(mdl);
evalin('base', 'engine_params;');

raw_dir = fullfile(out_dir, 'raw');
if ~exist(raw_dir, 'dir')
    mkdir(raw_dir);
end

% Ramp time range (s) per Fault_ID: dangerous faults develop fast.
RAMP_RANGES = containers.Map('KeyType', 'double', 'ValueType', 'any');
RAMP_RANGES(1) = [180 360];   % misfire
RAMP_RANGES(2) = [180 360];   % overheating
RAMP_RANGES(3) = [60 180];    % oil pressure failure
RAMP_RANGES(4) = [60 180];    % fuel starvation
for f = 5:9
    RAMP_RANGES(f) = [480 900];   % injector, cooling, CHT sensor, instability, vibration
end

% Every noise source in the model, with the name of its seed parameter.
noise_blocks = {
    'CHT_Sensor_Fault/Unit_Noise', 'seed'
    'EngineCore/Cycle_Noise', 'seed'
    'EngineCore/Misfire_Draw', 'Seed'
    'Sensor_AlternatorCurrent/Band-Limited White Noise', 'seed'
    'Sensor_BatteryVoltage/Band-Limited White Noise', 'seed'
    'Sensor_InjectionDuration/Band-Limited White Noise', 'seed'
    'Sensor_InjectionTiming/Band-Limited White Noise', 'seed'
    };
for k = 1:8
    noise_blocks(end + 1, :) = ...
        {sprintf('Subsystem%d/Band-Limited White Noise', k), 'seed'}; %#ok<AGROW>
end
noise_blocks(end + 1, :) = {'VibrationMode/Band-Limited White Noise', 'seed'};

names = {'rpm', 'fuel_flow', 'torque', 'oil_temperature', 'oil_pressure', ...
    'cht', 'fault_label', 'egt', 'vibration', 'battery_voltage', ...
    'alternator_current', 'injection_timing', 'injection_duration'};

total = numel(seeds) * numel(profiles) * numel(fault_ids);
done = 0;

for seed = seeds
    for p = 1:numel(profiles)
        for fault_id = fault_ids
            done = done + 1;
            run_id = sprintf('%s_f%d_s%d', profiles{p}, fault_id, seed);
            csv_path = fullfile(raw_dir, [run_id '.csv']);
            if exist(csv_path, 'file')
                continue;
            end

            % Independent, reproducible random stream per run.
            rs = RandStream('mt19937ar', 'Seed', 10000 * seed + 100 * p + fault_id);
            profile_seed = 1000 * seed + 10 * fault_id + p;

            if fault_id == 0
                onset = 0;
                ramp = 0;
                duration = round(900 + 600 * rand(rs));
            else
                onset = round(120 + 180 * rand(rs));
                range = RAMP_RANGES(fault_id);
                ramp = round(range(1) + (range(2) - range(1)) * rand(rs));
                duration = onset + ramp + 300;
            end
            noise_seeds = randi(rs, 2^31 - 2, size(noise_blocks, 1), 1);

            [t, u] = mission_profile(profiles{p}, duration, profile_seed);

            in = Simulink.SimulationInput(mdl);
            in = in.setExternalInput([t, u]);
            in = in.setBlockParameter([mdl '/Fault_ID'], 'Value', num2str(fault_id));
            in = in.setBlockParameter([mdl '/Degradation/Fault_Onset'], ...
                'Value', num2str(onset));
            in = in.setVariable('fault_ramp_time', max(ramp, 1));
            for k = 1:size(noise_blocks, 1)
                in = in.setBlockParameter([mdl '/' noise_blocks{k, 1}], ...
                    noise_blocks{k, 2}, num2str(noise_seeds(k)));
            end
            in = in.setModelParameter('StopTime', num2str(duration));

            tic;
            o = sim(in);
            log = o.telemetry_log;

            ts = (0:duration)';
            T = table(ts, 'VariableNames', {'sim_time'});
            for k = 1:13
                if k == 7
                    continue;   % Fault_ID label, not a sensor signal
                end
                s = log.(sprintf('signal%d', k));
                d = squeeze(s.Data);
                % The live stream publishes the latest logged value.
                T.(names{k}) = interp1(s.Time, d, ts, 'previous', 'extrap');
            end
            U = interp1(t, u, ts, 'previous');
            T.throttle = U(:, 1);
            T.engine_load = U(:, 2);
            T.altitude = U(:, 3);
            T.ambient_temperature = U(:, 4);
            if fault_id == 0
                T.severity = zeros(size(ts));
                T.fault_id = zeros(size(ts));
            else
                T.severity = min(max((ts - onset) / ramp, 0), 1);
                T.fault_id = fault_id * (ts >= onset);
            end

            meta = struct('run_id', run_id, 'profile', profiles{p}, ...
                'seed', seed, 'profile_seed', profile_seed, ...
                'fault_id', fault_id, 'onset_s', onset, 'ramp_s', ramp, ...
                'duration_s', duration, 'noise_seeds', noise_seeds');
            fid = fopen(fullfile(raw_dir, [run_id '.json']), 'w');
            fprintf(fid, '%s', jsonencode(meta));
            fclose(fid);

            % Write the CSV last: its presence marks the run as complete.
            writetable(T, [csv_path '.tmp'], 'FileType', 'text');
            movefile([csv_path '.tmp'], csv_path);

            fprintf('[%d/%d] %-28s onset %4d s  ramp %4d s  %5d s simulated in %4.0f s\n', ...
                done, total, run_id, onset, ramp, duration, toc);
        end
    end
end
fprintf('DATASET RAW DONE: %d runs in %s\n', total, raw_dir);
end
