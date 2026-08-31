"use client";

import { Activity, ShieldCheck, Wifi } from "lucide-react";

export default function TopBar({ activeEngineId, missionId }) {
  return (
    <header className="h-14 bg-panel-bg border-b border-panel-border px-6 flex items-center justify-between font-mono shrink-0 select-none">
      {/* Current Vehicle & Mission Identifier */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2 bg-panel-card px-3 py-1.5 rounded border border-panel-border">
          <span className="text-slate-500 font-semibold">UAV / ID:</span>
          <span className="text-slate-100 font-bold">{activeEngineId}</span>
        </div>
        <span className="text-panel-border">|</span>
        <div className="flex items-center gap-2 bg-panel-card px-3 py-1.5 rounded border border-panel-border">
          <span className="text-slate-500 font-semibold">MISSION:</span>
          <span className="text-engine-blue font-bold">{missionId}</span>
        </div>
      </div>

      {/* Telemetry & System Connection Indicators */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2 bg-engine-green/10 text-engine-green px-3 py-1.5 rounded border border-engine-green/30">
          <Wifi className="w-3.5 h-3.5 animate-pulse" />
          <span className="font-bold tracking-wider text-[11px]">TELEMETRY ONLINE</span>
        </div>

        <div className="flex items-center gap-2 bg-panel-card text-slate-300 px-3 py-1.5 rounded border border-panel-border">
          <ShieldCheck className="w-3.5 h-3.5 text-engine-blue" />
          <span className="text-[11px]">TWIN SYNCED</span>
        </div>

        <div className="flex items-center gap-2 text-slate-500 text-[11px]">
          <Activity className="w-3.5 h-3.5 text-slate-400" />
          <span>50 Hz</span>
        </div>
      </div>
    </header>
  );
}