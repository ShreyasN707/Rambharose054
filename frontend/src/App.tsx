import {useRef } from "react";
import DroneOverviewSection from "./DroneOverview";
import CyberBrutalSection from "./components/landing/CyberBrutalSection";
import HudSection from "./components/landing/HudSection";
import { useEngineData } from "./hooks/useEngineData";

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

@keyframes cyberPulse {
    0%, 100% { opacity: 0.4; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.5); }
}
@keyframes cyberScan {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100%); }
}
@keyframes cyberRing {
    0% { opacity: 0.8; transform: scale(0.3); }
    100% { opacity: 0; transform: scale(2.5); }
}
`;

export default function EngineTwinLanding() {
    const droneRef = useRef<HTMLDivElement>(null);
    const hudRef = useRef<HTMLDivElement>(null);
    const engineData = useEngineData();

    const handleViewTwin = () => {
        droneRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleScrollToDrone = () => {
        droneRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleScrollToHud = () => {
        hudRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    return (
        <div>
            <style>{FONTS}</style>
            <CyberBrutalSection
                onViewTwin={handleViewTwin}
                onScrollToDrone={handleScrollToDrone}
                onScrollToHud={handleScrollToHud}
            />
            <div ref={droneRef}>
                <DroneOverviewSection liveTelemetry={engineData.telemetry} />
            </div>
            <div ref={hudRef}>
                <HudSection engineData={engineData} />
            </div>
        </div>
    );
}
