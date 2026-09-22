%% HEALTH / DEGRADATION MODEL

% Engine operating limits
RPM_idle = 1500;
RPM_max  = 7500;

% Health thresholds
HI_warning  = 0.70;
HI_critical = 0.30;
HI_EOL      = 0.10;

% Fault severity thresholds
fault_warning  = 0.30;
fault_severe   = 0.60;
fault_critical = 0.80;

% Damage model weights
w_rpm     = 0.30;
w_load    = 0.30;
w_thermal = 0.40;

% Fault damage multiplier
fault_multiplier_warning  = 1.5;
fault_multiplier_severe   = 3.0;
fault_multiplier_critical = 6.0;

% Base damage rate
base_damage_rate = 1e-5;