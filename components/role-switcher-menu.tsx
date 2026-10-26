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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Alternar módulos do sistema"
        className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 transition-all duration-150 hover:bg-slate-700 hover:text-white active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        <LayoutGrid size={15} aria-hidden />
        <span>Módulos</span>
        <ChevronDown size={14} className={`transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Módulos disponíveis"
          className="absolute left-0 top-full z-50 mt-1 flex min-w-[200px] flex-col gap-0.5 rounded-xl border border-slate-700 bg-slate-800 p-1.5 shadow-2xl animate-fade-in"
        >
          {links.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex min-h-[44px] items-center rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 no-underline transition-all duration-150 hover:bg-slate-700 hover:text-white active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {mod.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
