"use client";

import React from "react";
import { theme } from "@/src/styles/theme";

export interface MonthlyTabItem {
  id: string;
  label: string;
  count?: number;
  hasAlert?: boolean;
}

export interface MonthlyTabsProps {
  tabs: MonthlyTabItem[];
  activeTabId: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export function MonthlyTabs({
  tabs,
  activeTabId,
  onTabChange,
  className = "",
}: MonthlyTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Navegação de Meses"
      className={`flex items-center gap-2 overflow-x-auto py-2 border-b border-paper-line ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            type="button"
            style={{
              backgroundColor: isActive ? theme.colors.tab.activeBg : theme.colors.tab.inactiveBg,
              color: isActive ? theme.colors.tab.activeText : theme.colors.tab.inactiveText,
              borderColor: isActive ? theme.colors.tab.activeBg : theme.colors.tab.inactiveBorder,
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border shadow-xs hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:ring-2 focus-visible:ring-offset-1`}
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  tab.hasAlert
                    ? "bg-status-negative text-white font-bold animate-pulse"
                    : isActive
                    ? "bg-white/25 text-white font-bold"
                    : "bg-[#D4D4D4] text-[#1F1F1F] font-bold"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default MonthlyTabs;
