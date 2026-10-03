# Problem Statement — Digital Twin for Aero-Piston Engines (SIH 2026)

The Smart India Hackathon 2026 problem statement this project answers, as provided to the team (text kept as given, lightly formatted). How the project maps to each section is in [`ARCHITECTURE.md`](ARCHITECTURE.md) §2.

---

## Background

Medium Altitude Long Endurance (MALE) UAVs are increasingly being deployed for long-duration intelligence, surveillance, reconnaissance (ISR), communication relay, maritime surveillance and strategic defence missions. Reliability and availability of propulsion systems are critical for mission success, because piston-engine failures during flight may lead to mission abort, asset loss, or unsafe recovery conditions.

Conventional engine monitoring systems used in UAVs are primarily threshold-based and reactive in nature. These systems generally indicate failures only after an abnormality has already occurred. Present approaches also have limited capability to estimate remaining useful life (RUL), predict degradation trends, or simulate mission-wise engine behaviour under varying environmental and operating conditions.

A Digital Twin (DT) framework for aero piston engines can significantly improve predictive maintenance, operational reliability, mission planning, and life-cycle management by creating a continuously synchronized virtual representation of the physical engine using real-time sensor data, physics-based models and AI/ML techniques.

The proposed problem aims to develop an indigenous Digital Twin framework suitable for deployment in MALE UAV ground control and health monitoring architecture. The solution should support real-time engine state estimation, anomaly detection, degradation tracking, fault prediction, and mission replay capability.

## Description

Develop a scalable and modular Digital Twin system for an aero piston engine used in MALE UAV applications. The system shall create a real-time virtual representation of the engine by integrating:

- Engine sensor data
- Thermodynamic behaviour models
- Engine performance maps
- Failure/degradation logic
- AI/ML based predictive analytics

The proposed system should be capable of:

- Real-time engine parameter visualization
- Monitoring of engine health indicators
- Detection of abnormal operating conditions
- Predicting probable failures before occurrence
- Estimating degradation trends and Remaining Useful Life (RUL)
- Simulating engine behaviour under different mission profiles and environmental conditions
- Supporting post-flight analysis and mission replay

The system may utilize:

- CAN bus / SocketCAN-based engine data acquisition
- ECU/FADEC communication interfaces
- Edge computing architecture
- Cloud or local server-based analytics
- AI/ML algorithms for anomaly detection
- Physics-informed modelling approaches
- Dashboard/HMI for operators and maintenance engineers

## Expected Solution

The digital twin core framework shall act as the central intelligence layer that continuously mirrors the real aero-piston engine operating onboard the MALE UAV. The framework should establish a dynamic and continuously synchronized virtual representation of the engine using live telemetry, physics-based models, operational history and AI-driven analytics. The framework should be designed considering future deployment in defence-grade Ground Control Stations (GCS), engine test rigs, and fleet-level health monitoring infrastructures. The expected solution should include:

### A. Digital Twin Core Framework

- Virtual engine model synchronized with live engine data
- Modular architecture for future scalability
- Real-time data ingestion capability

### B. Health Monitoring System

The health monitoring system shall continuously assess the condition of engine sub-systems and generate health indices for predictive maintenance. Monitoring of the following engine parameters is required:

- RPM
- Cylinder Head Temperature (CHT)
- Exhaust Gas Temperature (EGT)
- Oil Pressure & Temperature
- Fuel flow
- Vibration signatures
- Battery / Alternator health
- Injection timing parameters

### C. Fault Detection & Predictive Analytics

The system should transition from conventional threshold-based monitoring to intelligent predictive diagnostics. Detection/prediction of the following is required:

- Misfire conditions
- Injector abnormalities
- Cooling degradation
- Lubrication issues
- Sensor drift / failure
- Combustion instability
- Overheating trends
- Abnormal vibration patterns

### D. AI/ML Layer

The AI/ML layer shall provide adaptive learning capability for predictive diagnostics and intelligent maintenance planning. The following are required to be captured:

- Anomaly detection algorithms
- Remaining Useful Life (RUL) estimation
- Trend analysis
- Predictive maintenance recommendations

### E. Simulation & Replay Capability

The system should include simulation tools to reproduce engine behaviour and analyse mission scenarios. The following are required to be captured:

- Replay of historical mission data
- Environmental condition simulation
- Engine behaviour simulation during:
  - High altitude
  - Endurance missions
  - Hot-weather operation
  - Rapid throttle transitions

### F. Visualization Dashboard

The dashboard shall provide an intuitive operational interface for UAV operators, propulsion engineers and maintenance teams. The user interface should support:

- Real-time engine health status
- Fault alerts
- Engine efficiency trends
- Maintenance advisory
- Mission-wise health reports

## Deliverables Expected from Teams

- Functional prototype / software demonstrator
- Digital twin architecture design
- Engine simulation model
- AI/ML-based anomaly detection module
- Visualization dashboard
- Demonstration using simulated or real engine datasets
- Technical documentation and deployment roadmap

## Desired Innovation Areas

- Physics-informed AI
- Edge AI for UAV applications
- Lightweight onboard analytics
- Hybrid thermodynamic + data-driven models
- Federated learning approaches
- Explainable AI for fault diagnosis
- Secure telemetry architecture
- Autonomous maintenance advisory systems

## Technical Expectations from Participants

Teams are expected to demonstrate understanding of:

- IC engine fundamentals
- UAV propulsion systems
- Sensor fusion
- Embedded systems
- CAN communication
- AI/ML analytics
- Data visualization
- Simulation modelling
- Reliability engineering
