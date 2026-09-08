"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LayoutGrid } from "lucide-react";

type ModuleLink = { label: string; href: string };

export function RoleSwitcherMenu({ links }: { links: readonly ModuleLink[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 rounded px-2 py-1 font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
      >
        <LayoutGrid size={14} />
        Módulos
        <ChevronDown size={14} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 flex min-w-[180px] flex-col gap-0.5 rounded-lg border border-slate-700 bg-slate-800 p-1.5 shadow-xl"
        >
          {links.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="rounded px-2.5 py-1.5 font-medium text-slate-200 no-underline transition-colors hover:bg-slate-700 hover:text-white"
            >
              {mod.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
