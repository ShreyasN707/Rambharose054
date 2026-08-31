"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Activity, 
  Cpu, 
  Compass, 
  AlertTriangle, 
  RotateCcw, 
  Settings, 
  Radio
} from "lucide-react";
import { ENGINES_LIST } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { name: "Overview", href: "/overview", icon: LayoutDashboard },
  { name: "Live Monitor", href: "/live", icon: Activity },
  { name: "Digital Twin", href: "/digital-twin", icon: Cpu },
  { name: "Missions", href: "/missions", icon: Compass },
  { name: "Diagnostics", href: "/diagnostics", icon: AlertTriangle },
  { name: "Mission Replay", href: "/replay", icon: RotateCcw },
];

export default function Sidebar({ selectedEngineId, onSelectEngine }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-panel-bg border-r border-panel-border flex flex-col h-screen select-none shrink-0">
      {/* Brand Header */}
      <div className="h-14 border-b border-panel-border flex items-center px-4 gap-3">
        <div className="w-2.5 h-2.5 bg-engine-blue rounded-full animate-pulse" />
        <div className="flex flex-col">
          <span className="text-xs font-bold tracking-widest text-slate-100 uppercase">
            UAV ENGINE TWIN
          </span>
          <span className="text-[10px] text-slate-500 font-mono tracking-wider">
            GCS-CONSOLE v2.4
          </span>
        </div>
      </div>

      {/* Main Navigation Links */}
      <div className="py-4 px-2 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
          Navigation
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (pathname === "/" && item.href === "/overview");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-xs font-mono rounded transition-colors",
                isActive
                  ? "bg-engine-blue-muted text-engine-blue font-semibold border-l-2 border-engine-blue"
                  : "text-slate-400 hover:text-slate-200 hover:bg-panel-hover"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>

      <div className="h-px bg-panel-border my-2 mx-3" />

      {/* Engine Selection List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
          Engines
        </div>
        <div className="space-y-1">
          {ENGINES_LIST.map((eng) => {
            const isSelected = eng.id === selectedEngineId;
            return (
              <button
                key={eng.id}
                onClick={() => onSelectEngine(eng.id)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded border transition-all text-xs font-mono flex flex-col gap-1",
                  isSelected
                    ? "bg-panel-card border-engine-blue/50 text-slate-100 shadow-sm"
                    : "border-transparent text-slate-400 hover:bg-panel-hover hover:text-slate-300"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold tracking-wide">{eng.id}</span>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-mono font-medium",
                      eng.health >= 90
                        ? "bg-engine-green/10 text-engine-green border border-engine-green/30"
                        : "bg-engine-amber/10 text-engine-amber border border-engine-amber/30"
                    )}
                  >
                    HEALTH {eng.health}%
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 truncate">
                  {eng.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer System Status */}
      <div className="p-3 border-t border-panel-border bg-panel-card/50 text-[11px] font-mono flex items-center justify-between text-slate-400">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-engine-green" />
          <span>LINK: READY</span>
        </div>
        <button className="text-slate-500 hover:text-slate-300 transition-colors">
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}