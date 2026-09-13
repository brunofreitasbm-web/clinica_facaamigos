"use client";

import React from "react";

/**
 * Mapeamento inicial de cores predefinidas para planos de saúde (convênios).
 * - Unimed: verde
 * - Amazônia: vermelho
 * - Yazév: roxo
 */
const PRESET_HEALTH_PLAN_COLORS: Record<string, string> = {
  unimed: "#16a34a", // Verde
  amazonia: "#dc2626", // Vermelho
  "amazônia": "#dc2626", // Vermelho
  yazev: "#7c3aed", // Roxo
  "yazév": "#7c3aed", // Roxo
  bradesco: "#e11d48", // Vermelho Vivo / Rose
  sulamerica: "#ea580c", // Laranja
  "sul américa": "#ea580c",
  amil: "#2563eb", // Azul Royal
  cassi: "#0d9488", // Teal
  hapvida: "#4f46e5", // Indigo
  petrobras: "#15803d", // Verde Escuro
  geap: "#0284c7", // Sky
  particular: "#64748b", // Slate
};

const VIBRANT_FALLBACK_PALETTE = [
  "#16a34a", // Verde
  "#dc2626", // Vermelho
  "#7c3aed", // Roxo
  "#2563eb", // Azul
  "#0d9488", // Teal
  "#d97706", // Amber
  "#c026d3", // Fuchsia
  "#ea580c", // Orange
];

/**
 * Retorna a cor em Hex para o convênio informado.
 * Prioridade: 1) Cor customizada do banco 2) Mapeamento por nome (Unimed, Amazônia, Yazév, etc.) 3) Algoritmo determinístico
 */
export function getHealthPlanColor(name?: string | null, customColor?: string | null): string {
  if (customColor && customColor.trim()) {
    return customColor.trim();
  }

  if (!name) return "#64748b";

  const normalized = name.toLowerCase().trim();

  // Busca por substring ou correspondência exata nos presets
  for (const [key, color] of Object.entries(PRESET_HEALTH_PLAN_COLORS)) {
    if (normalized.includes(key)) {
      return color;
    }
  }

  // Gera uma cor consistente para convênios sem cor explícita
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % VIBRANT_FALLBACK_PALETTE.length;
  return VIBRANT_FALLBACK_PALETTE[index];
}

export interface HealthPlanBadgeProps {
  name: string;
  color?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  hideOnPrint?: boolean;
}

/**
 * Componente de Badge de Plano de Saúde em formato pílula (Pill Badge).
 * Oculto automaticamente na impressão e emissão de documentos via `print:hidden`.
 */
export function HealthPlanBadge({
  name,
  color,
  size = "md",
  className = "",
  hideOnPrint = true,
}: HealthPlanBadgeProps) {
  if (!name || !name.trim()) return null;

  const badgeColor = getHealthPlanColor(name, color);

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] leading-tight font-bold",
    md: "px-2.5 py-0.5 text-xs leading-normal font-bold",
    lg: "px-3 py-1 text-sm leading-normal font-bold",
  }[size];

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-white shadow-xs select-none transition-transform hover:scale-105 ${
        hideOnPrint ? "print:hidden" : ""
      } ${sizeClasses} ${className}`}
      style={{ backgroundColor: badgeColor }}
      title={`Plano de Saúde: ${name}`}
    >
      <span className="truncate max-w-[140px] sm:max-w-[200px]">{name.trim()}</span>
    </span>
  );
}
