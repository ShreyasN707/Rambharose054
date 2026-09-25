import { useEffect, useState } from "react";

export default function DroneRadarGraphic(){
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick(t => t + 1), 40);
        return () => clearInterval(id);
    }, []);

    const phase = tick * 0.04;
    const cx = 240, cy = 160;

    const droneX = cx + Math.cos(phase * 0.6) * 100;
    const droneY = cy + Math.sin(phase * 0.6) * 60;
    const droneHeading = Math.round(((Math.atan2(
        Math.cos(phase * 0.6) * 60,
        -Math.sin(phase * 0.6) * 100
    ) * 180) / Math.PI + 360) % 360);

    const altitude = Math.round(120 + Math.sin(phase * 0.3) * 25 + Math.sin(phase * 0.9) * 8);
    const speed = Math.round(14 + Math.sin(phase * 0.5) * 4);
    const battery = Math.round(87 - tick * 0.005);
    const battColor = battery > 60 ? "#C6FF3D" : battery > 30 ? "#e8c34a" : "#e8543f";

    const sweepAngle = (tick * 3) % 360;

    const waypoints = [
        { x: cx - 90, y: cy - 45, label: "WP1" },
        { x: cx + 80, y: cy - 55, label: "WP2" },
        { x: cx + 95, y: cy + 40, label: "WP3" },
        { x: cx - 85, y: cy + 50, label: "WP4" },
    ];

    const rotorAngle = tick * 15;

    return (
        <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
            <svg viewBox="0 0 480 320" style={{ width: "100%", height: "100%", display: "block", background: "#0a0a0a" }}>
                {Array.from({ length: 25 }, (_, i) => (
                    <line key={`vg${i}`} x1={i * 20} y1={0} x2={i * 20} y2={320} stroke="#141414" strokeWidth="0.5" />
                ))}
                {Array.from({ length: 17 }, (_, i) => (
                    <line key={`hg${i}`} x1={0} y1={i * 20} x2={480} y2={i * 20} stroke="#141414" strokeWidth="0.5" />
                ))}

                {[40, 80, 120].map((r, i) => (
                    <circle key={`ring${i}`} cx={cx} cy={cy} r={r} fill="none" stroke="#1a2a10" strokeWidth="0.8" />
                ))}
                <line x1={cx - 130} y1={cy} x2={cx + 130} y2={cy} stroke="#1a2a10" strokeWidth="0.5" />
                <line x1={cx} y1={cy - 130} x2={cx} y2={cy + 130} stroke="#1a2a10" strokeWidth="0.5" />

                <defs>
                    <linearGradient id="sweepGrad" gradientTransform={`rotate(${sweepAngle}, 0.5, 0.5)`}>
                        <stop offset="0%" stopColor="transparent" />
                        <stop offset="70%" stopColor="transparent" />
                        <stop offset="100%" stopColor="rgba(198,255,61,0.15)" />
                    </linearGradient>
                </defs>
                <line
                    x1={cx} y1={cy}
                    x2={cx + 130 * Math.cos((sweepAngle * Math.PI) / 180)}
                    y2={cy + 130 * Math.sin((sweepAngle * Math.PI) / 180)}
                    stroke="#C6FF3D" strokeWidth="1.5" opacity="0.4"
                />
                {[1, 2, 3, 4, 5].map(i => {
                    const a = ((sweepAngle - i * 8) * Math.PI) / 180;
                    return (
                        <line key={`sw${i}`} x1={cx} y1={cy}
                            x2={cx + 130 * Math.cos(a)} y2={cy + 130 * Math.sin(a)}
                            stroke="#C6FF3D" strokeWidth="1" opacity={0.08 * (6 - i)} />
                    );
                })}

                <ellipse cx={cx} cy={cy} rx={100} ry={60} fill="none"
                    stroke="#C6FF3D" strokeWidth="0.8" strokeDasharray="6 4" opacity="0.25" />

                {waypoints.map((wp, i) => {
                    const dist = Math.hypot(droneX - wp.x, droneY - wp.y);
                    const isNear = dist < 40;
                    return (
                        <g key={`wp${i}`}>
                            <rect x={wp.x - 6} y={wp.y - 6} width={12} height={12}
                                fill="none" stroke={isNear ? "#C6FF3D" : "#3b82f6"} strokeWidth="1"
                                transform={`rotate(45, ${wp.x}, ${wp.y})`} opacity={isNear ? 1 : 0.5} />
                            {isNear && (
                                <circle cx={wp.x} cy={wp.y} r={18} fill="none"
                                    stroke="#C6FF3D" strokeWidth="0.5" opacity={0.3 + Math.sin(phase * 4) * 0.3}>
                                    <animate attributeName="r" values="12;22;12" dur="1.5s" repeatCount="indefinite" />
                                    <animate attributeName="opacity" values="0.5;0.1;0.5" dur="1.5s" repeatCount="indefinite" />
                                </circle>
                            )}
                            <text x={wp.x} y={wp.y + 20} textAnchor="middle" fontSize="7"
                                fill={isNear ? "#C6FF3D" : "#555"} fontFamily="'JetBrains Mono', monospace">
                                {wp.label}
                            </text>
                        </g>
                    );
                })}

                <g transform={`translate(${droneX}, ${droneY})`}>
                    <circle cx={0} cy={0} r={28} fill="rgba(198,255,61,0.03)" stroke="#C6FF3D" strokeWidth="0.5" opacity="0.3" />

                    <line x1={-10} y1={-10} x2={10} y2={10} stroke="#888" strokeWidth="1.5" />
                    <line x1={10} y1={-10} x2={-10} y2={10} stroke="#888" strokeWidth="1.5" />

                    {[[-10, -10], [10, -10], [10, 10], [-10, 10]].map(([rx, ry], i) => (
                        <g key={`rotor${i}`} transform={`rotate(${rotorAngle + i * 90}, ${rx}, ${ry})`}>
                            <circle cx={rx} cy={ry} r={7} fill="none" stroke="#C6FF3D" strokeWidth="0.6" opacity="0.5" />
                            <line x1={rx - 6} y1={ry} x2={rx + 6} y2={ry} stroke="#C6FF3D" strokeWidth="0.8" opacity="0.7" />
                            <line x1={rx} y1={ry - 6} x2={rx} y2={ry + 6} stroke="#C6FF3D" strokeWidth="0.8" opacity="0.7" />
                        </g>
                    ))}

                    <circle cx={0} cy={0} r={4} fill="#222" stroke="#C6FF3D" strokeWidth="1" />
                    <circle cx={0} cy={0} r={1.5} fill="#C6FF3D" />

                    <line x1={0} y1={-4} x2={0} y2={-9} stroke="#e8543f" strokeWidth="1.5" strokeLinecap="round" />
                </g>

                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => {
                    const tp = phase - i * 0.08;
                    const tx = cx + Math.cos(tp * 0.6) * 100;
                    const ty = cy + Math.sin(tp * 0.6) * 60;
                    return <circle key={`trail${i}`} cx={tx} cy={ty} r={1.2} fill="#C6FF3D" opacity={0.3 - i * 0.03} />;
                })}

                <rect x="12" y="50" width="28" height="220" fill="rgba(10,10,10,0.8)" stroke="#1e1e1e" strokeWidth="0.8" rx="2" />
                {Array.from({ length: 11 }, (_, i) => {
                    const val = 50 + i * 20;
                    const yp = 260 - i * 20;
                    return (
                        <g key={`at${i}`}>
                            <line x1="36" y1={yp} x2="40" y2={yp} stroke="#444" strokeWidth="0.8" />
                            <text x="34" y={yp + 3} textAnchor="end" fontSize="6" fill="#666" fontFamily="'JetBrains Mono', monospace">{val}</text>
                        </g>
                    );
                })}
                {(() => {
                    const altY = 260 - ((altitude - 50) / 200) * 200;
                    return (
                        <g>
                            <rect x="12" y={altY - 6} width="28" height="12" fill="#C6FF3D" rx="1" />
                            <text x="26" y={altY + 2} textAnchor="middle" fontSize="7" fill="#050505" fontWeight="bold" fontFamily="'JetBrains Mono', monospace">{altitude}</text>
                        </g>
                    );
                })()}
                <text x="26" y="44" textAnchor="middle" fontSize="6" fill="#777" fontFamily="'JetBrains Mono', monospace" letterSpacing="0.5">ALT m</text>

                <rect x="170" y="8" width="140" height="18" fill="rgba(10,10,10,0.8)" stroke="#1e1e1e" strokeWidth="0.8" rx="2" />
                {[-60, -30, 0, 30, 60].map(offset => {
                    const hdg = ((droneHeading + offset) % 360 + 360) % 360;
                    const px = 240 + offset * 1.8;
                    const labels: Record<number, string> = { 0: "N", 90: "E", 180: "S", 270: "W" };
                    const isCardinal = labels[hdg] !== undefined;
                    return (
                        <g key={`hdg${offset}`}>
                            <line x1={px} y1={22} x2={px} y2={offset % 30 === 0 ? 26 : 24} stroke={isCardinal ? "#C6FF3D" : "#555"} strokeWidth="0.8" />
                            <text x={px} y={19} textAnchor="middle" fontSize={isCardinal ? "7" : "6"}
                                fill={isCardinal ? "#C6FF3D" : "#666"} fontFamily="'JetBrains Mono', monospace" fontWeight={isCardinal ? "bold" : "normal"}>
                                {isCardinal ? labels[hdg] : hdg}
                            </text>
                        </g>
                    );
                })}
                <polygon points="240,27 237,32 243,32" fill="#e8543f" />

                <rect x="370" y="250" width="100" height="60" fill="rgba(10,10,10,0.85)" stroke="#1e1e1e" strokeWidth="0.8" rx="2" />
                <text x="378" y="264" fontSize="7" fill="#777" fontFamily="'JetBrains Mono', monospace">SPD</text>
                <text x="462" y="264" textAnchor="end" fontSize="9" fill="#fff" fontFamily="'JetBrains Mono', monospace">{speed} m/s</text>
                <line x1="375" y1="268" x2="465" y2="268" stroke="#1e1e1e" strokeWidth="0.5" />
                <text x="378" y="280" fontSize="7" fill="#777" fontFamily="'JetBrains Mono', monospace">HDG</text>
                <text x="462" y="280" textAnchor="end" fontSize="9" fill="#fff" fontFamily="'JetBrains Mono', monospace">{droneHeading}°</text>
                <line x1="375" y1="284" x2="465" y2="284" stroke="#1e1e1e" strokeWidth="0.5" />
                <text x="378" y="296" fontSize="7" fill="#777" fontFamily="'JetBrains Mono', monospace">BAT</text>
                <text x="462" y="296" textAnchor="end" fontSize="9" fill={battColor} fontFamily="'JetBrains Mono', monospace">{battery}%</text>
                <rect x="375" y="300" width="90" height="3" fill="#1e1e1e" rx="1" />
                <rect x="375" y="300" width={Math.max(0, battery * 0.9)} height="3" fill={battColor} rx="1" />

                <rect x="12" y="282" width="80" height="28" fill="rgba(10,10,10,0.85)" stroke="#1e1e1e" strokeWidth="0.8" rx="2" />
                <circle cx="22" cy="296" r="3" fill="#C6FF3D" opacity={0.5 + Math.sin(phase * 3) * 0.5} />
                <text x="30" y="293" fontSize="7" fill="#C6FF3D" fontFamily="'JetBrains Mono', monospace">PATROL</text>
                <text x="30" y="303" fontSize="6" fill="#666" fontFamily="'JetBrains Mono', monospace">MODE: AUTO</text>

                <rect x="0" y={(tick * 2) % 320} width="480" height="2" fill="#C6FF3D" opacity="0.03" />
            </svg>

            <div style={{ position: "absolute", top: 8, left: 8, width: 16, height: 16, borderTop: "2px solid #C6FF3D", borderLeft: "2px solid #C6FF3D", pointerEvents: "none", zIndex: 10 }} />
            <div style={{ position: "absolute", top: 8, right: 8, width: 16, height: 16, borderTop: "2px solid #C6FF3D", borderRight: "2px solid #C6FF3D", pointerEvents: "none", zIndex: 10 }} />
            <div style={{ position: "absolute", bottom: 8, left: 8, width: 16, height: 16, borderBottom: "2px solid #C6FF3D", borderLeft: "2px solid #C6FF3D", pointerEvents: "none", zIndex: 10 }} />
            <div style={{ position: "absolute", bottom: 8, right: 8, width: 16, height: 16, borderBottom: "2px solid #C6FF3D", borderRight: "2px solid #C6FF3D", pointerEvents: "none", zIndex: 10 }} />
        </div>
    );
}