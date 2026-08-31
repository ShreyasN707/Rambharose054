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
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-border bg-bg text-xs">
      <header className="flex h-12 items-center border-b border-border px-4">
        <span className="font-mono font-bold tracking-wide text-text">
          UAV ENGINE TWIN
        </span>
      </header>

      <nav className="p-2">
        <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-text-muted">
          SYSTEM
        </div>

        <div className="space-y-0.5">
          {NAV_ITEMS.map(({ name, href, icon: Icon }) => {
            const active = pathname === href;

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded px-2.5 py-1.5 transition-colors",
                  active
                    ? "bg-data font-medium text-bg"
                    : "text-text-muted hover:bg-panel hover:text-text"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="mx-2 h-px bg-border" />

      <section className="flex-1 overflow-y-auto p-2">
        <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-text-muted">
          ENGINES
        </div>

        <div className="mt-1 space-y-1">
          {ENGINES_LIST.map((engine) => {
            const selected = engine.id === selectedEngineId;

            return (
              <button
                key={engine.id}
                type="button"
                onClick={() => onSelectEngine(engine.id)}
                className={cn(
                  "flex w-full flex-col gap-1 rounded border px-2.5 py-2 text-left transition-colors",
                  selected
                    ? "border-data bg-panel text-text"
                    : "border-border bg-bg text-text-muted hover:bg-panel hover:text-text"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold">{engine.id}</span>

                  <span
                    className={cn(
                      "rounded px-1 text-[10px] font-semibold",
                      engine.health >= 90
                        ? "bg-nominal/10 text-nominal"
                        : "bg-caution/10 text-caution"
                    )}
                  >
                    {engine.health}%
                  </span>
                </div>

                <span className="truncate text-[10px] text-text-muted">
                  {engine.name}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <footer className="flex items-center justify-between border-t border-border bg-bg p-2 text-[11px] text-text-muted">
        <span>STATUS: OK</span>

        <button
          type="button"
          aria-label="Settings"
          className="text-text-muted hover:text-text"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
      </footer>
    </aside>
  );
}