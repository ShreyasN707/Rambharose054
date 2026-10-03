// Mission profiles defined in simulation/mission_profile.m. The simulation
// controller accepts these ids and names each run's mission
// "mission_<date>_<time>_<profile id>".

export interface MissionProfile {
    id: string;
    label: string;
    description: string;
}

export const MISSION_PROFILES: MissionProfile[] = [
    {
        id: "cruise",
        label: "Cruise",
        description: "Steady level flight at sea level",
    },
    {
        id: "high_altitude",
        label: "High altitude",
        description: "Climb to 4500 m, then cruise in thin, cold air",
    },
    {
        id: "hot_weather",
        label: "Hot weather",
        description: "Low-altitude flight on a 45 °C day",
    },
    {
        id: "endurance",
        label: "Endurance",
        description: "Long loiter at 3000 m with slowly varying power",
    },
    {
        id: "rapid_throttle",
        label: "Rapid throttle",
        description: "Throttle steps between low and full power every 30 s",
    },
];

// Profile of a run, from the suffix of its mission id.
export function profileFromMissionId(
    missionId: string | undefined
): MissionProfile | undefined {
    if (!missionId) return undefined;

    return MISSION_PROFILES.find((profile) =>
        missionId.endsWith(`_${profile.id}`)
    );
}
