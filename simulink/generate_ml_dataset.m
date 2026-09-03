%% generate_ml_dataset.m

clear;
clc;

model_name = 'AeroPistonEngineSimulator';

% Load model and engine parameters
load_system(model_name);
engine_params;

% Simulation duration
simulation_time = 1200;

% Common dataset timeline
common_time = (0:0.1:simulation_time)';

% Currently implemented faults
% 0 = Healthy
% 1 = Misfire
fault_types = [0, 1];

runs_per_fault = 10;

master_dataset = table();

for fault = fault_types

    for run = 1:runs_per_fault

        fprintf('\nSimulating Fault ID: %d - Run: %d\n', fault, run);

        %% Generate different operating conditions for each run

        % Throttle: 60% - 100%
        throttle = 0.60 + (0.40 * rand);

        % Engine load: 30% - 70%
        engine_load = 0.30 + (0.40 * rand);

        % Altitude: 0 - 1000 m
        altitude = 1000 * rand;

        % Ambient temperature: 20 - 35 °C
        ambient_temp = 20 + (15 * rand);

        fprintf('  Throttle      : %.3f\n', throttle);
        fprintf('  Engine Load   : %.3f\n', engine_load);
        fprintf('  Altitude      : %.1f m\n', altitude);
        fprintf('  Ambient Temp  : %.1f °C\n', ambient_temp);

        %% Create Simulink external input

        t = common_time;

        u = [
            throttle * ones(size(t)), ...
            engine_load * ones(size(t)), ...
            altitude * ones(size(t)), ...
            ambient_temp * ones(size(t))
        ];

        %% Set fault

        set_param( ...
            [model_name '/Fault_ID'], ...
            'Value', num2str(fault) ...
        );

        %% Run simulation

        simOut = sim(model_name, 'StopTime', num2str(simulation_time));

        %% Get telemetry

        telemetry_log = simOut.telemetry_log;

        %% Extract and flatten telemetry

        time1 = telemetry_log.signal1.Time;
        data1 = squeeze(telemetry_log.signal1.Data);

        time2 = telemetry_log.signal2.Time;
        data2 = squeeze(telemetry_log.signal2.Data);

        time3 = telemetry_log.signal3.Time;
        data3 = squeeze(telemetry_log.signal3.Data);

        time4 = telemetry_log.signal4.Time;
        data4 = squeeze(telemetry_log.signal4.Data);

        time5 = telemetry_log.signal5.Time;
        data5 = squeeze(telemetry_log.signal5.Data);

        time6 = telemetry_log.signal6.Time;
        data6 = squeeze(telemetry_log.signal6.Data);

        time7 = telemetry_log.signal7.Time;
        data7 = squeeze(telemetry_log.signal7.Data);

        time8 = telemetry_log.signal8.Time;
        data8 = squeeze(telemetry_log.signal8.Data);

        time9 = telemetry_log.signal9.Time;
        data9 = squeeze(telemetry_log.signal9.Data);

        %% Resample telemetry onto common 0.1 second timeline

        RPM = interp1(time1, data1, common_time, 'linear');

        FuelFlow = interp1(time2, data2, common_time, 'linear');

        Torque = interp1(time3, data3, common_time, 'linear');

        OilTemperature = interp1( ...
            time4, data4, common_time, 'linear');

        OilPressure = interp1( ...
            time5, data5, common_time, 'linear');

        CHT = interp1( ...
            time6, data6, common_time, 'linear');

        % Fault ID is constant throughout the simulation
        FaultID = repmat( ...
            data7(1), ...
            length(common_time), ...
            1);

        EGT = interp1( ...
            time8, data8, common_time, 'linear');

        Vibration = interp1( ...
            time9, data9, common_time, 'linear');

        %% Build dataset table

        run_table = table( ...
            common_time, ...
            RPM, ...
            FuelFlow, ...
            Torque, ...
            OilTemperature, ...
            OilPressure, ...
            CHT, ...
            FaultID, ...
            EGT, ...
            Vibration, ...
            'VariableNames', { ...
                'Time', ...
                'RPM', ...
                'FuelFlow', ...
                'Torque', ...
                'OilTemperature', ...
                'OilPressure', ...
                'CHT', ...
                'FaultID', ...
                'EGT', ...
                'Vibration' ...
            });

        %% Add run metadata

        run_table.RunID = ...
            repmat(run + fault * 100, height(run_table), 1);

        run_table.Throttle = ...
            repmat(throttle, height(run_table), 1);

        run_table.EngineLoad = ...
            repmat(engine_load, height(run_table), 1);

        run_table.Altitude = ...
            repmat(altitude, height(run_table), 1);

        run_table.AmbientTemp = ...
            repmat(ambient_temp, height(run_table), 1);

        %% Add run to master dataset

        master_dataset = [
            master_dataset;
            run_table
        ];

    end
end

%% Save dataset

output_file = 'engine_digital_twin_dataset.csv';

writetable(master_dataset, output_file);

fprintf('\n========================================\n');
fprintf('Dataset generation complete.\n');
fprintf('Saved to: %s\n', output_file);
fprintf('Rows: %d\n', height(master_dataset));
fprintf('Columns: %d\n', width(master_dataset));
fprintf('========================================\n');