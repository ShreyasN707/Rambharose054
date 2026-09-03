%% generate_ml_dataset.m

clear;
clc;

model_name = 'AeroPistonEngineSimulator';

load_system(model_name);
engine_params;

% Simulation input
t = (0:0.1:1200)';

u = [
    ones(size(t)), ...          % Throttle
    0.5 * ones(size(t)), ...    % Engine Load
    zeros(size(t)), ...         % Altitude
    25 * ones(size(t))          % Ambient Temperature
];

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

        % Convert timetable to table
        run_table = timetable2table(telemetry_log);

        % Rename columns
        run_table.Properties.VariableNames = {
            'Time', ...
            'RPM', ...
            'FuelFlow', ...
            'Torque', ...
            'OilTemperature', ...
            'OilPressure', ...
            'CHT', ...
            'FaultID', ...
            'EGT', ...
            'Vibration'
        };

        % Add run identifier
        run_table.RunID = ...
            repmat(run + fault * 100, height(run_table), 1);

        % Add to master dataset
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