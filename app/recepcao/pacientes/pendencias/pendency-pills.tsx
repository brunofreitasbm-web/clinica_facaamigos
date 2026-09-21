import type { LeadPendencies, LeadPill, PillState } from "@/lib/lead-pendencies";
import { visiblePills } from "@/lib/lead-pendencies";

/**
 * Pílulas do "o que falta" de um contato do WhatsApp na fila de Pendências
 * (lib/lead-pendencies.ts): o operador bate o olho e sabe o que já veio e o que
 * cobrar, sem abrir a conversa. Vermelho = falta e conta no "Faltam N";
 * âmbar = aviso (não conta); tracejado = a IA ainda está lendo; verde = recebido.
 * Sempre com símbolo + texto, nunca só cor.
 */

const PILL_STYLE: Record<PillState, string> = {
  faltando: "border-status-negative-text/60 bg-status-negative-soft text-status-negative-text",
  aviso: "border-status-pending/60 bg-status-pending-soft text-status-pending-text",
  analisando: "border-dashed border-paper-line-strong text-ink-faint",
  ok: "border-status-positive-text/40 text-status-positive-text",
  nao_se_aplica: "border-dashed border-paper-line-strong text-ink-faint",
};

const PILL_SYMBOL: Record<PillState, string> = {
  faltando: "✗",
  aviso: "!",
  analisando: "…",
  ok: "✓",
  nao_se_aplica: "–",
};

const PILL_STATE_TEXT: Record<PillState, string> = {
  faltando: "falta",
  aviso: "atenção",
  analisando: "em leitura",
  ok: "recebido",
  nao_se_aplica: "não se aplica",
};

/**
 * "quiet" é o "recebido" da linha recolhida: texto apagado, sem borda — o que já
 * chegou não deve competir com o que falta. O cartão aberto usa "loud" (padrão).
 */
type PillTone = "loud" | "quiet";

const QUIET_OK_STYLE = "border border-transparent text-ink-faint";

function Pill({ pill, tone = "loud" }: { pill: LeadPill; tone?: PillTone }) {
  const description = `${pill.label}: ${PILL_STATE_TEXT[pill.state]}${pill.detail ? ` — ${pill.detail}` : ""}`;
  const style = tone === "quiet" && pill.state === "ok" ? QUIET_OK_STYLE : `border ${PILL_STYLE[pill.state]}`;
  return (
    <span
      title={description}
      aria-label={description}
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${style}`}
    >
      <span aria-hidden="true">{PILL_SYMBOL[pill.state]} </span>
      {pill.label}
    </span>
  );
}

export function SummaryChip({ pendencies }: { pendencies: LeadPendencies }) {
  const complete = pendencies.missingCount === 0;
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        complete ? "bg-status-positive-soft text-status-positive-text" : "bg-status-negative-soft text-status-negative-text"
      }`}
    >
      {complete ? "Completo" : `Faltam ${pendencies.missingCount}`}
    </span>
  );
}

/** Faixas da linha recolhida, na ordem em que o operador age: cobrar → conferir → aguardar → já chegou. */
const BANDS: { title: string; state: PillState }[] = [
  { title: "Falta", state: "faltando" },
  { title: "Atenção", state: "aviso" },
  { title: "Em leitura", state: "analisando" },
  { title: "Recebido", state: "ok" },
];

/**
 * Linha recolhida da fila: uma faixa rotulada por estado (sem os "não se aplica").
 * O chip "Faltam N" fica no cabeçalho da linha, fora daqui; faixa vazia não aparece.
 */
export function PendencyPills({ pendencies }: { pendencies: LeadPendencies }) {
  const visible = visiblePills(pendencies);
  return (
    <span className="mt-1.5 flex flex-col gap-1">
      {BANDS.map((band) => {
        const pills = visible.filter((p) => p.state === band.state);
        if (pills.length === 0) return null;
        return (
          <span key={band.state} className="flex items-start gap-1.5">
            <span className="w-[4.5rem] shrink-0 pt-1 text-[10px] uppercase tracking-wide text-ink-faint">{band.title}</span>
            <span className="flex flex-wrap items-center gap-1.5">
              {pills.map((pill) => (
                <Pill key={pill.key} pill={pill} tone="quiet" />
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Cartão aberto: todas as pílulas, agrupadas em documentos e dados, incluindo o que não se aplica. */
export function PendencyGrid({ pendencies }: { pendencies: LeadPendencies }) {
  const groups: { title: string; pills: LeadPill[] }[] = [
    { title: "Documentos", pills: pendencies.pills.filter((p) => p.group === "documento") },
    { title: "Dados", pills: pendencies.pills.filter((p) => p.group === "dado") },
  ];
  return (
    <div className="rounded-md border border-paper-line-strong bg-paper/40 px-3 py-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h4 className="m-0 text-xs font-semibold uppercase tracking-wide text-ink-soft">O que falta</h4>
        <SummaryChip pendencies={pendencies} />
      </div>
      <div className="flex flex-col gap-2">
        {groups.map((group) => (
          <div key={group.title} className="flex flex-wrap items-center gap-1.5">
            <span className="w-20 shrink-0 text-[11px] uppercase tracking-wide text-ink-faint">{group.title}</span>
            {group.pills.map((pill) => (
              <Pill key={pill.key} pill={pill} />
            ))}
          </div>
        ))}
      </div>
      {pendencies.pills.some((p) => p.state === "aviso") && (
        <ul className="m-0 mt-2 flex list-none flex-col gap-0.5 p-0 text-[12px] text-ink-faint">
          {pendencies.pills
            .filter((p) => p.state === "aviso" && p.detail)
            .map((p) => (
              <li key={p.key}>
                <span className="font-medium text-status-pending-text">{p.label}:</span> {p.detail}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
