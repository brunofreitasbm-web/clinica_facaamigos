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
            className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 active:scale-95 flex items-center gap-2 border shadow-xs hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:ring-2 focus-visible:ring-offset-1 cursor-pointer`}
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  tab.hasAlert
                    ? "bg-status-negative text-white animate-pulse"
                    : isActive
                    ? "bg-white/25 text-white"
                    : "bg-[#D4D4D4] text-[#1F1F1F]"
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
