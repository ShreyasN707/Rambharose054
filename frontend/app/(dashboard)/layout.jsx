"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

export default function DashboardLayout({ children }) {
  const [selectedEngineId, setSelectedEngineId] = useState("ENG-001");

  return (
    <div className="flex h-screen bg-[#080A0F] text-slate-300 font-mono overflow-hidden">
      <Sidebar 
        selectedEngineId={selectedEngineId} 
        onSelectEngine={setSelectedEngineId} 
      />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <TopBar activeEngineId={selectedEngineId} missionId="MISSION-042" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#080A0F]">
          {children}
        </main>
      </div>
    </div>
  );
}