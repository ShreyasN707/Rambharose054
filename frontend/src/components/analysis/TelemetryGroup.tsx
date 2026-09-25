import type { ReactNode } from "react";

interface TelemetryGroupProps {
    title: string;
    children: ReactNode;
}

export default function TelemetryGroup({
    title,
    children,
}: TelemetryGroupProps) {
    return (
        <section
            className="p-4"
            style={{
                border: "1px solid #3a3a3a",
                background: "#0d0d0d",
            }}
        >
            <div
                className="mb-4 text-sm font-bold"
                style={{
                    color: "#fff",
                    fontFamily: "'JetBrains Mono', monospace",
                }}
            >
                {title}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {children}
            </div>
        </section>
    );
}