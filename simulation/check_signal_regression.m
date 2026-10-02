function report = check_signal_regression(baseline, candidate, signal_names, tolerance)
%CHECK_SIGNAL_REGRESSION Compare telemetry_log runs from two model versions.
%
%   report = check_signal_regression(baseline, candidate)
%   report = check_signal_regression(baseline, candidate, signal_names, tolerance)
%
%   baseline and candidate are structs returned by
%   run_telemetry_scenarios.m. Each listed signal is compared sample by
%   sample (after aligning time vectors) and the maximum absolute and
%   relative differences are reported. The check passes when every
%   relative difference is <= tolerance.

if nargin < 3 || isempty(signal_names)
    signal_names = arrayfun(@(k) sprintf('signal%d', k), 1:9, ...
        'UniformOutput', false);
end

if nargin < 4
    tolerance = 1e-9;
end

scenarios = fieldnames(baseline);
report = struct('scenario', {}, 'signal', {}, 'max_abs_diff', {}, ...
    'max_rel_diff', {}, 'same_time_vector', {}, 'pass', {});

for s = 1:numel(scenarios)
    scenario = scenarios{s};

    for k = 1:numel(signal_names)
        name = signal_names{k};

        ref = baseline.(scenario).(name);
        cur = candidate.(scenario).(name);

        ref_time = ref.Time;
        ref_data = squeeze(ref.Data);
        cur_data = squeeze(cur.Data);

        same_time = isequal(size(ref_time), size(cur.Time)) ...
            && max(abs(ref_time - cur.Time)) == 0;

        if ~same_time
            % Variable-step solvers may place minor steps differently;
            % compare on the baseline time grid.
            [cur_time, unique_idx] = unique(cur.Time, 'last');
            cur_data = interp1(cur_time, cur_data(unique_idx), ...
                ref_time, 'previous', 'extrap');
        end

        abs_diff = max(abs(ref_data - cur_data));
        scale = max(max(abs(ref_data)), eps);
        rel_diff = abs_diff / scale;

        report(end + 1) = struct( ...
            'scenario', scenario, ...
            'signal', name, ...
            'max_abs_diff', abs_diff, ...
            'max_rel_diff', rel_diff, ...
            'same_time_vector', same_time, ...
            'pass', rel_diff <= tolerance); %#ok<AGROW>
    end
end

failed = report(~[report.pass]);

fprintf('Compared %d scenario/signal pairs, tolerance %.1e (relative)\n', ...
    numel(report), tolerance);
fprintf('Worst relative difference: %.3e\n', max([report.max_rel_diff]));
fprintf('Identical time vectors:    %d / %d\n', ...
    sum([report.same_time_vector]), numel(report));

if isempty(failed)
    fprintf('RESULT: PASS\n');
else
    fprintf('RESULT: FAIL (%d pairs)\n', numel(failed));
    for f = failed
        fprintf('  %-20s %-9s abs %.3e rel %.3e\n', ...
            f.scenario, f.signal, f.max_abs_diff, f.max_rel_diff);
    end
end

end
