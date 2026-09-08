"use client";

import { useState } from "react";

const TABS = [
  { key: "protocolos", label: "Protocolos" },
  { key: "instrumentos", label: "Instrumentos rápidos" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function ProtocolosTabs({
  protocolsPanel,
  instrumentsPanel,
}: {
  protocolsPanel: React.ReactNode;
  instrumentsPanel: React.ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("protocolos");

  return (
    <>
      <div className="flex gap-4 border-b border-paper-line px-6 sm:px-10">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`border-b-2 px-1 py-3 text-sm font-semibold ${
              tab === t.key ? "border-accent text-ink" : "border-transparent text-ink-faint"
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div hidden={tab !== "protocolos"}>{protocolsPanel}</div>
      <div hidden={tab !== "instrumentos"}>{instrumentsPanel}</div>
    </>
  );
}
