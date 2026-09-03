%% generate_ml_dataset.m

clear;
clc;

model_name = 'AeroPistonEngineSimulator';

load_system(model_name);
engine_params;

% Simulation input
t = (0:0.1:1200)';

u = [
    ones(size(t)), ...
    0.5 * ones(size(t)), ...
    zeros(size(t)), ...
    25 * ones(size(t))
];

% Currently implemented faults
% 0 = Healthy
% 1 = Misfire
fault_types = [0, 1];

runs_per_fault = 10;

master_dataset = table();

for fault = fault_types

    for run = 1:runs_per_fault

        fprintf('\nSimulating Fault ID: %d - Run: %d\n', fault, run);

        % Set fault
        set_param( ...
            [model_name '/Fault_ID'], ...
            'Value', num2str(fault) ...
        );

        % Run simulation
        simOut = sim(model_name, 'StopTime', '1200');

        % Get telemetry
        telemetry_log = simOut.telemetry_log;

        % Common dataset timeline
        common_time = (0:0.1:1200)';

        % Extract and flatten telemetry

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

        % Resample onto common 0.1 second timeline

        RPM = interp1(time1, data1, common_time, 'linear');

        FuelFlow = interp1(time2, data2, common_time, 'linear');

        Torque = interp1(time3, data3, common_time, 'linear');

        OilTemperature = interp1(time4, data4, common_time, 'linear');

        OilPressure = interp1(time5, data5, common_time, 'linear');

        CHT = interp1(time6, data6, common_time, 'linear');

        % Fault ID is constant
        FaultID = repmat(data7(1), length(common_time), 1);

        EGT = interp1(time8, data8, common_time, 'linear');

        Vibration = interp1(time9, data9, common_time, 'linear');

        % Build table
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

        % Add run identifier
        run_table.RunID = ...
            repmat(run + fault * 100, height(run_table), 1);

        % Add run to master dataset
        master_dataset = [
            master_dataset;
            run_table
        ];

    end
end

% Save dataset
output_file = 'engine_digital_twin_dataset.csv';

writetable(master_dataset, output_file);

fprintf('\n========================================\n');
fprintf('Dataset generation complete.\n');
fprintf('Saved to: %s\n', output_file);
fprintf('Rows: %d\n', height(master_dataset));
fprintf('========================================\n');