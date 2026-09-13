import { Trophy, Lock, Info } from "lucide-react";
import {
  BONUS_PERCENTILE_BANDS,
  qualitativeForItem,
  type BonusProgress,
  type BonusProgressLevel,
  type ItemQualitativeLevel,
} from "@/lib/bonus-progress";

const BAR_COLOR: Record<BonusProgressLevel, string> = {
  eliminado: "#ef4444",
  abaixo_esperado: "#ef4444",
  em_desenvolvimento: "#dcae4e",
  no_caminho_certo: "#dcae4e",
  quase_la: "#dcae4e",
  bonificado: "#28c880",
};

const CHIP_STYLE: Record<BonusProgressLevel, { bg: string; text: string }> = {
  eliminado: { bg: "rgba(239, 68, 68, 0.1)", text: "#b91c1c" },
  abaixo_esperado: { bg: "rgba(239, 68, 68, 0.1)", text: "#b91c1c" },
  em_desenvolvimento: { bg: "rgba(220, 174, 78, 0.15)", text: "#7c5a0b" },
  no_caminho_certo: { bg: "rgba(220, 174, 78, 0.15)", text: "#7c5a0b" },
  quase_la: { bg: "rgba(220, 174, 78, 0.15)", text: "#7c5a0b" },
  bonificado: { bg: "rgba(40, 200, 128, 0.12)", text: "#0f7a4a" },
};

/** Mesmo vocabulário do placar geral, com "sem_dado" a mais — só existe no nível de métrica individual. */
const ITEM_CHIP_STYLE: Record<ItemQualitativeLevel, { bg: string; text: string }> = {
  ...CHIP_STYLE,
  sem_dado: { bg: "var(--color-neutral-200)", text: "var(--color-ink-faint)" },
};

const ITEM_BAR_COLOR: Record<ItemQualitativeLevel, string> = {
  ...BAR_COLOR,
  sem_dado: "#c9c2b3",
};

/** Largura em degraus (não o contributionPct exato) — a barrinha de cada métrica também vira qualitativa, não um número. */
const ITEM_LEVEL_WIDTH: Record<ItemQualitativeLevel, number> = {
  sem_dado: 0,
  eliminado: 0,
  abaixo_esperado: 20,
  em_desenvolvimento: 40,
  no_caminho_certo: 60,
  quase_la: 80,
  bonificado: 100,
};

/**
 * Quadro percentil: escada com as 5 categorias de bonus-progress.ts, a atual
 * destacada. O usuário nunca vê o número exato — só em qual degrau está e o
 * que falta pro próximo, reforçando a leitura qualitativa pedida (não é
 * relatório, é placar de jogo).
 */
function PercentileLadder({ level }: { level: BonusProgressLevel }) {
  const currentIndex = BONUS_PERCENTILE_BANDS.findIndex((b) => b.level === level);
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="Quadro percentil da bonificação">
      {BONUS_PERCENTILE_BANDS.map((band, i) => {
        const isCurrent = i === currentIndex;
        const isPast = currentIndex >= 0 && i < currentIndex;
        return (
          <li
            key={band.level}
            aria-current={isCurrent ? "step" : undefined}
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors"
            style={
              isCurrent
                ? { background: BAR_COLOR[band.level], color: "#fff" }
                : isPast
                  ? { background: "var(--color-neutral-200)", color: "var(--color-ink-soft)" }
                  : { background: "transparent", color: "var(--color-ink-faint)", border: "1px solid var(--color-neutral-200)" }
            }
          >
            {band.chipLabel}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Barra de progresso gamificada da bonificação (métricas do gestor em
 * bonus_rule_sets, calculadas ao vivo por lib/bonus-progress.ts). O %
 * ponderado exato nunca aparece na tela — só a categoria qualitativa
 * (quadro percentil) em que o usuário está, pra reforçar a leitura de jogo
 * em vez de um número frio de relatório.
 */
export function BonusProgressCard({ progress }: { progress: BonusProgress }) {
  if (!progress.hasRuleSet) {
    return (
      <section className="card flex items-center gap-3 border border-[var(--color-neutral-200)]">
        <Info size={18} className="shrink-0 text-ink-faint" aria-hidden="true" />
        <p className="m-0 text-sm text-ink-soft">{progress.levelLabel}.</p>
      </section>
    );
  }

  const chip = CHIP_STYLE[progress.level];
  const barColor = BAR_COLOR[progress.level];
  const pctShown = progress.eliminated ? 0 : Math.min(100, progress.weightedPct);

  return (
    <section
      className="card flex flex-col gap-4 border border-[var(--color-neutral-200)]"
      role="region"
      aria-label="Progresso de bonificação do mês"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-accent">
            Bonificação · {progress.periodLabel}
          </div>
          <div className="flex items-center gap-2">
            {progress.level === "bonificado" ? (
              <Trophy size={18} style={{ color: barColor }} aria-hidden="true" />
            ) : progress.eliminated ? (
              <Lock size={18} style={{ color: barColor }} aria-hidden="true" />
            ) : null}
            <h3 className="m-0 text-lg font-semibold text-ink">{progress.levelLabel}</h3>
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-3 py-1 text-sm font-bold"
          style={{ background: chip.bg, color: chip.text }}
        >
          {progress.chipLabel}
        </span>
      </div>

      <div
        className="h-3 w-full overflow-hidden rounded-full bg-[var(--color-neutral-200)]"
        role="img"
        aria-label={`Nível de bonificação: ${progress.chipLabel}`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pctShown}%`, background: barColor }}
        />
      </div>

      <PercentileLadder level={progress.level} />

      {progress.eliminated && (
        <p className="m-0 text-sm font-medium" style={{ color: "#b91c1c" }}>
          Meta eliminatória não cumprida: {progress.eliminatedBy.join(", ")}. Isso zera a bonificação do mês
          mesmo com as outras métricas em dia.
        </p>
      )}

      <ul className="flex flex-col gap-2.5">
        {progress.items.map((item) => {
          const qualitative = qualitativeForItem(item);
          const chip = ITEM_CHIP_STYLE[qualitative.level];
          const itemWidth = ITEM_LEVEL_WIDTH[qualitative.level];
          const itemColor = ITEM_BAR_COLOR[qualitative.level];
          return (
            <li key={item.metricKey} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-ink">
                  {item.label}
                  {item.eliminatory && (
                    <span className="ml-1.5 text-xs font-bold uppercase tracking-wide text-ink-faint">
                      eliminatória
                    </span>
                  )}
                </span>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold"
                  style={{ background: chip.bg, color: chip.text }}
                >
                  {qualitative.chipLabel}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-neutral-200)]">
                <div
                  className="h-full rounded-full transition-[width] duration-500 ease-out"
                  style={{ width: `${itemWidth}%`, background: itemColor }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
