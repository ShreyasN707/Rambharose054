"use client";

import { useEffect, useState } from "react";

export default function TopBar({ activeEngineId, missionId }) {
  const [sampleCount, setSampleCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSampleCount((n) => n + 50), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-bg px-6">
      <div className="flex items-center gap-8 font-mono text-[13px]">
        <div className="flex items-baseline gap-2">
          <span className="text-text-muted">ENG</span>
          <span className="text-text">{activeEngineId}</span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-text-muted">MSN</span>
          <span className="text-text">{missionId}</span>
        </div>
      </div>
    </header>
  );
}