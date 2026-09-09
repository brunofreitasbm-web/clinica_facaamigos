import Link from "next/link";

export type AgendaView = "dia" | "semana" | "mes";

/**
 * Troca de visão + navegação de período, tudo em <Link>s server-rendered —
 * sem client JS, cada clique é uma navegação normal de query string
 * (?view=&date=&therapist=). O dia âncora (`date`) é preservado ao trocar de
 * visão de propósito: ver o dia 15 na semana e trocar pra "mês" deve manter
 * o mês de setembro, não pular pro mês corrente.
 */
export function AgendaToolbar({
  view,
  date,
  rangeLabel,
  therapistParam,
  prevHref,
  nextHref,
  todayHref,
}: {
  view: AgendaView;
  date: string;
  rangeLabel: string;
  therapistParam: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
}) {
  const qs = therapistParam ? `&therapist=${therapistParam}` : "";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 md:gap-2">
          <Link href={prevHref} className="btn btn-icon" aria-label="Período anterior">
            ‹
          </Link>
          <Link href={todayHref} className="btn btn-secondary text-sm">
            Hoje
          </Link>
          <Link href={nextHref} className="btn btn-icon" aria-label="Próximo período">
            ›
          </Link>
        </div>
        <span className="text-base font-semibold text-ink md:text-lg">{rangeLabel}</span>
      </div>

      {/* .seg-opt espera um <input type=radio> aninhado (:has(input:checked)) —
          aqui a navegação é feita por link, não por estado de formulário, então
          usamos .seg-btn (estilizado via aria-pressed, que funciona em <a>). */}
      <div className="seg" role="tablist" aria-label="Visão da agenda">
        {(
          [
            { key: "dia", label: "Dia" },
            { key: "semana", label: "Semana" },
            { key: "mes", label: "Mês" },
          ] as const
        ).map((opt) => (
          <Link
            key={opt.key}
            href={`/terapeuta/agenda?view=${opt.key}&date=${date}${qs}`}
            role="tab"
            aria-selected={view === opt.key}
            aria-pressed={view === opt.key}
            className="seg-btn"
          >
            {opt.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
