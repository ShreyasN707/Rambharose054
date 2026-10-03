
C_oil = 5000;

%% ========================================================================
%  GLOBAL & ENGINE STRUCTURAL CONSTANTS
%  ========================================================================
T_max        = 10;       % Maximum engine torque (Nm) - 100cc class engine
J_engine     = 0.05;     % Total rotational inertia of crank & prop (kg*m^2)
RPM_idle     = 1500;     % Idle speed (RPM)
RPM_max      = 7500;     % Maximum rated engine speed (RPM)

%% ========================================================================
%  PHASE 2: ENVIRONMENT & ISA CONSTANTS
%  ========================================================================
P0           = 101325;   % Sea-level standard atmospheric pressure (Pa)
T0           = 288.15;   % Sea-level standard temperature (K)
rho0         = 1.225;    % Sea-level standard air density (kg/m^3)
L_lapse      = 0.0065;   % Atmospheric temperature lapse rate (K/m)
R_air        = 287.05;   % Specific gas constant for dry air (J/(kg*K))
g_gravity    = 9.80665;  % Standard gravity acceleration (m/s^2)

%% ========================================================================
%  PHASE 3: FRICTION MODEL CONSTANTS
%  ========================================================================
friction_a   = 0.001;    % Linear friction coefficient (Nm / (rad/s))
friction_b = 0.00005;  % Viscous/quadratic friction coefficient (Nm / (rad/s)^2)

%% ========================================================================
%  PHASE 4: FUEL SYSTEM CONSTANTS
%  ========================================================================
BSFC_nominal = 280;      % Nominal Brake Specific Fuel Consumption (g/kWh)
fuel_min     = 0.2;      % Minimum idle fuel flow limit (kg/hr)

%% ========================================================================
%  PHASES 5 & 6: THERMAL MODEL CONSTANTS (CHT & EGT)
%  ========================================================================
% Cylinder Head Temperature (CHT)
CHT_capacity = 100;      % Cylinder thermal mass/capacity (J/°C)
k_h          = 100;     % Heat generation scaling factor
k_c          = 5;      % Air cooling efficiency scaling factor
CHT_init     = 25;       % Initial engine temperature before start (°C)

% Exhaust Gas Temperature (EGT)
k1_egt       = 150;      % EGT fuel flow sensitivity gain
k2_egt       = 100;      % EGT engine load sensitivity gain
k3_egt       = 0.05;     % EGT RPM sensitivity gain
EGT_tau      = 0.8;      % EGT thermocouple time constant (seconds)

%% ========================================================================
%  PHASE 7: LUBRICATION MODEL CONSTANTS
%  ========================================================================
% Oil Temperature
C_oil = 2500;
Oil_capacity = 250;      % Oil thermal mass/capacity (J/°C)
k_oil_heat   = 8;      % Mechanical heat dissipation into oil gain
k_oil_cool   = 0.05;     % Oil cooling dissipation gains
OilTemp_init = 25;       % Initial oil temperature before start (°C)

k_oil_pressure_rpm = 0.015;
k_oil_pressure_temp = 0.000075;

% Oil Pressure
kp_oil       = 0.015;    % Oil pump pressure-to-RPM gain (psi/RPM)
kt_oil       = 0.2;      % Temperature viscosity loss coefficient (psi/°C)
T_oil_ref    = 90;       % Nominal optimal operating oil temperature (°C)

%% ========================================================================
%  PHASE 8: VIBRATION MODEL CONSTANTS
%  ========================================================================
k_vib_amp    = 0.001;    % Baseline vibration amplitude scaling factor
vib_noise_pwr= 0.1;      % High-frequency white noise power for vibration

%% ========================================================================
%  PHASE 9: SENSOR DYNAMICS, NOISE, DRIFT & TELEMETRY SAMPLING
%  ========================================================================
% Sensor Response Time Constants (Transfer Function Tau in seconds)
tau_rpm_sensor      = 0.05;
tau_cht_sensor      = 3.0;
tau_egt_sensor      = 0.8;
tau_fuel_sensor     = 0.2;
tau_oilp_sensor     = 0.1;
tau_oilt_sensor     = 2.0;
tau_vib_sensor      = 0.005;

% Sensor Measurement Noise Variance (Band-Limited White Noise Power)
noise_rpm           = 0.01;
noise_cht           = 0.05;
noise_egt           = 0.2;
noise_fuel          = 0.001;
noise_oilp          = 0.05;
noise_oilt          = 0.02;
noise_vib           = 0.1;

% Sensor Drift Rates (Ramp Slope per second)
drift_cht           = 0.001;   % Thermal drift over flight duration
drift_egt           = 0.002;
drift_oilp          = -0.0005; % Pressure calibration loss

% Sensor Telemetry Sampling Rates (Zero-Order Hold Sample Time in seconds)
Ts_telemetry_std    = 0.1;     % 10 Hz telemetry rate for standard signals
Ts_telemetry_fast   = 0.005;   % 200 Hz sampling rate for high-freq vibration
Ts_telemetry_slow   = 0.5;     % 2 Hz sampling rate for slow thermal channels

%% ========================================================================
%  PHASE 10: ELECTRICAL SYSTEM (BATTERY / ALTERNATOR)  -> Electrical_Model
%  ========================================================================
% 28 VDC aircraft bus fed by an engine-driven alternator through a voltage
% regulator, backed by a 24 V nominal battery. The model only reads RPM;
% alternator load torque is NOT fed back into EngineCore.
elec.V_bus_reg      = 28.0;    % Regulated bus voltage when alternator carries the load (V)
elec.V_batt_full    = 25.6;    % Battery open-circuit voltage at 100 % state of charge (V)
elec.V_batt_empty   = 22.0;    % Battery open-circuit voltage at 0 % state of charge (V)
elec.R_batt_int     = 0.05;    % Battery internal resistance (ohm)
elec.C_batt_Ah      = 7.0;     % Battery capacity (Ah)
elec.SoC_init       = 0.85;    % Battery state of charge at mission start (0-1)
elec.SoC_taper      = 0.95;    % State of charge above which charge current tapers to zero (0-1)
elec.I_avionics     = 10.0;    % Constant avionics + payload bus load (A)
elec.I_charge_max   = 5.0;     % Maximum battery charge acceptance current (A)
elec.I_alt_max      = 25.0;    % Rated alternator output current (A)
elec.RPM_alt_cutin  = 1200;    % Engine speed at which the alternator starts producing current (RPM)
elec.RPM_alt_rated  = 3500;    % Engine speed at which the alternator reaches rated output (RPM)

%% ========================================================================
%  PHASE 11: FUEL INJECTION (ECU)  -> Injection_Model
%  ========================================================================
% Read-only ECU parameters: they are reported as telemetry but do NOT feed
% back into the combustion / engine physics.
%
% injection_timing   = start of injection, degrees crank angle BTDC
%                      (positive = before top dead centre), from an
%                      ECU-style 2-D map of engine speed x throttle.
% injection_duration = injector pulse width per injection event (ms),
%                      derived from fuel flow and engine speed.
inj.rpm_bp       = [1500 3000 4500 6000 7500];   % Map breakpoints: engine speed (RPM)
inj.throttle_bp  = [0 0.25 0.5 0.75 1.0];        % Map breakpoints: throttle position (0-1)
% Start-of-injection map (deg BTDC). Rows = rpm_bp, columns = throttle_bp.
% Advance grows with RPM to compensate the shorter time per crank degree
% and shrinks slightly with throttle as more fuel is delivered per event.
inj.timing_table = [
    12 11 10  9  8
    16 15 14 13 12
    20 19 18 17 16
    23 22 21 20 19
    26 25 24 23 22
];
inj.n_cyl          = 1;      % Number of cylinders (one injector per cylinder)
inj.strokes        = 4;      % Engine cycle (4-stroke: one injection per 2 revolutions)
inj.q_static_gps   = 2.5;    % Injector static flow rate (g/s)
inj.t_dead_ms      = 0.8;    % Injector opening dead time added to every pulse (ms)
inj.rpm_min        = 300;    % Below this speed the ECU does not inject (RPM)

%% ========================================================================
%  PHASE 12: SENSOR CONDITIONING FOR ELECTRICAL & INJECTION TELEMETRY
%  ========================================================================
% Same chain as the existing sensors: first-order lag -> drift -> band-
% limited white noise -> zero-order hold -> saturation.
% The lag 1/(tau*s + 1) is implemented as its exact discrete equivalent at
% Ts_telemetry_std, (1 - a)/(z - a) with a = exp(-Ts_telemetry_std/tau),
% and the battery state of charge uses a discrete integrator. Keeping the
% new blocks discrete leaves the variable-step solver's continuous states
% unchanged, so signals 1-9 stay bit-identical to the original model.
% Noise power P gives a standard deviation of sqrt(P / Ts_telemetry_std).
tau_vbatt_sensor    = 0.1;       % Battery voltage sensor lag (s)
tau_ialt_sensor     = 0.1;       % Alternator current sensor lag (s)
tau_injt_sensor     = 0.05;      % Injection timing reporting lag (s)
tau_injd_sensor     = 0.05;      % Injection duration reporting lag (s)

noise_vbatt         = 2.5e-4;    % ~0.05 V standard deviation
noise_ialt          = 4e-3;      % ~0.2 A standard deviation
noise_injt          = 1e-3;      % ~0.1 deg standard deviation
noise_injd          = 4e-5;      % ~0.02 ms standard deviation

seed_vbatt          = 23351;     % Independent noise seeds for the new sensors
seed_ialt           = 23352;
seed_injt           = 23353;
seed_injd           = 23354;

drift_vbatt         = 0;         % No calibration drift modelled (units/s)
drift_ialt          = 0;
drift_injt          = 0;
drift_injd          = 0;

sat_vbatt           = [0 36];    % Battery voltage sensor range (V)
sat_ialt            = [0 40];    % Alternator current sensor range (A)
sat_injt            = [0 60];    % Injection timing reporting range (deg BTDC)
sat_injd            = [0 30];    % Injection duration reporting range (ms)
%% ========================================================================
%  PHASE 13: FAULT PROGRESSION  -> Degradation subsystem
%  ========================================================================
% Every fault grows from no effect (degradation 0) at the moment it is
% injected to full severity (degradation 1) after fault_ramp_time seconds.
% simulink_mqtt_stream.m sets Degradation/Fault_Onset to the injection
% time. Dataset runs should last at least fault_ramp_time so they cover
% the whole progression.
fault_ramp_time     = 300;       % Time from fault onset to full severity (s)
