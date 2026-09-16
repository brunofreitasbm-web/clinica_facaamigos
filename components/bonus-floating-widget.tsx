"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gamepad2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getMyBonusWidgetSummary, type BonusWidgetSummary } from "@/lib/bonus-widget-actions";

// 5min: era 60s — é um contador de bonificação, não dado clínico, não
// precisa de frescor por segundo. Some com isso o poll também pausa quando
// a aba não está visível (abaixo), então o custo real de manter isto
// montado o dia todo em toda tela de Recepção/Coordenação cai bastante.
const POLL_MS = 5 * 60_000;
const STORAGE_KEY = "bonus-widget-last-pct";

type Trend = "up" | "down" | "flat" | null;

const LEVEL_COLOR: Record<BonusWidgetSummary["level"], string> = {
  eliminado: "#ef4444",
  abaixo_esperado: "#ef4444",
  em_desenvolvimento: "#dcae4e",
  no_caminho_certo: "#dcae4e",
  quase_la: "#dcae4e",
  bonificado: "#28c880",
};

const TREND_LABEL: Record<Exclude<Trend, null>, string> = {
  up: "crescendo",
  down: "caindo",
  flat: "estagnado",
};

/**
 * Placar flutuante da bonificação (§ pedido do gestor: gamificar a
 * produtividade) — fica fixo no canto inferior direito em QUALQUER tela dos
 * módulos Recepção e Coordenação (montado no layout.tsx de cada um, não numa
 * página específica). Faz polling da própria ação server
 * (getMyBonusWidgetSummary) pra refletir mudança de dados sem precisar de
 * F5, e guarda o último valor visto em sessionStorage pra comparar e mostrar
 * a tendência (crescendo/estagnado/caindo) mesmo depois de navegar entre
 * páginas — sem isso, cada troca de rota remontaria o componente e perderia
 * a comparação.
 */
export function BonusFloatingWidget() {
  const [summary, setSummary] = useState<BonusWidgetSummary | null>(null);
  const [trend, setTrend] = useState<Trend>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const data = await getMyBonusWidgetSummary();
      if (cancelled) return;

      if (data) {
        let previousPct: number | null = null;
        try {
          const raw = window.sessionStorage.getItem(STORAGE_KEY);
          previousPct = raw != null ? Number(raw) : null;
        } catch {
          previousPct = null;
        }

        if (previousPct != null && Number.isFinite(previousPct)) {
          setTrend(data.weightedPct > previousPct ? "up" : data.weightedPct < previousPct ? "down" : "flat");
        }

        try {
          window.sessionStorage.setItem(STORAGE_KEY, String(data.weightedPct));
        } catch {
          // sessionStorage indisponível (aba privada etc.) — widget segue sem tendência.
        }
      }

      setSummary(data);
    }

    refresh();
    const id = setInterval(() => {
      // Aba em segundo plano: pula o poll, mas não perde o ritmo — quando
      // voltar a ficar visível, o listener abaixo refresca na hora em vez
      // de esperar até 5min. Evita bater a Server Action de dezenas de abas
      // de recepção/coordenação abertas e esquecidas em segundo plano.
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);

    function onVisibilityChange() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  if (!summary) return null;

  const color = LEVEL_COLOR[summary.level];
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <Link
      href={summary.href}
      className="fixed bottom-5 right-5 z-30 flex items-center gap-2.5 rounded-full border px-4 py-2.5 shadow-lg no-underline transition-transform hover:scale-[1.03] print:hidden"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-neutral-200)" }}
      aria-label={`Bonificação: ${summary.chipLabel}${trend ? `, ${TREND_LABEL[trend]}` : ""}. Ver detalhes.`}
    >
      <Gamepad2 size={18} style={{ color }} aria-hidden="true" />
      <span className="text-sm font-semibold text-ink">Bonificação</span>
      <span className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white" style={{ background: color }}>
        {summary.chipLabel}
      </span>
      {trend && (
        <span className="flex items-center gap-1 text-xs font-medium text-ink-soft">
          <TrendIcon size={13} aria-hidden="true" />
          {TREND_LABEL[trend]}
        </span>
      )}
    </Link>
  );
}
