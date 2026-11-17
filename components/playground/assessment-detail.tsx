import { CLINIC_TIMEZONE } from "@/lib/constants";
import type { PlaygroundDetailSeries } from "@/lib/playground/detail";

const fmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: CLINIC_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const when = (iso: string | null) => (iso ? fmt.format(new Date(iso)).replace(",", "") : "");

const STATUS_LABEL: Record<string, string> = {
  concluida: "Concluída",
  liberada: "Em andamento",
};

const VISIT_LABEL: Record<string, string> = {
  futura: "Agendada",
  aguardando_chegada: "Aguardando chegada",
  no_playground: "No playground",
  confirmar_saida: "Saída não confirmada",
  avaliar_agora: "Avaliar agora",
  atrasada: "Atrasada",
  registrada_no_prazo: "Registrada",
  registrada_com_atraso: "Registrada com atraso",
  nao_feita: "Não feita",
  faltou: "Faltou",
};

/**
 * Avaliação paralela do playground (VB-MAPP) no prontuário, somente leitura.
 * Cada item mostra quem preencheu, a especialidade e a visita; item corrigido
 * no mesmo dia mostra quantas vezes foi revisto.
 */
export function PlaygroundAssessmentDetail({ series }: { series: PlaygroundDetailSeries[] }) {
  if (series.length === 0) {
    return <p className="text-sm text-ink-faint">Esta criança ainda não tem avaliação do playground.</p>;
  }
  return (
    <div className="flex flex-col gap-6">
      {series.map((s) => (
        <section key={s.id} className="rounded-xl border border-paper-line bg-paper p-5 shadow-2xs">
          <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="m-0 text-base font-bold">
              VB-MAPP · Nível {s.level}
              <span className="font-normal text-ink-faint"> · {s.locationName}</span>
            </h3>
            <span className="text-xs font-semibold text-ink-faint">
              {STATUS_LABEL[s.status] ?? s.status}
              {s.concludedAt ? ` em ${when(s.concludedAt)}${s.concludedByName ? ` por ${s.concludedByName}` : ""}` : ""}
            </span>
          </header>

          <div className="mb-4 flex flex-wrap gap-2">
            {s.visits.map((v) => (
              <span key={v.visitNo} className="rounded-md border border-paper-line px-2 py-0.5 text-xs">
                {v.visitNo}ª · {when(v.scheduledStart)} · {VISIT_LABEL[v.status] ?? v.status}
                {v.entryCount > 0 ? ` · ${v.entryCount} registro${v.entryCount === 1 ? "" : "s"}, ${v.authors.length} profissional${v.authors.length === 1 ? "" : "is"}` : ""}
              </span>
            ))}
          </div>

          {s.domains.length === 0 ? (
            <p className="text-sm text-ink-faint">Nenhum item preenchido ainda.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {s.domains.map((d) => (
                <details key={d.domain} open className="rounded-lg border border-paper-line">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
                    {d.domain} <span className="font-normal text-ink-faint">({d.items.length} itens)</span>
                  </summary>
                  <ul className="m-0 list-none divide-y divide-paper-line p-0">
                    {d.items.map((i) => (
                      <li key={i.code} className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-2 text-sm">
                        <div>
                          <div>{i.description}</div>
                          <div className="text-xs text-ink-faint">
                            {i.authorName}
                            {i.authorSpecialty ? ` (${i.authorSpecialty})` : ""}
                            {i.visitNo ? ` · visita ${i.visitNo}` : ""}
                            {i.revisions > 0 ? ` · corrigido ${i.revisions}x` : ""}
                          </div>
                        </div>
                        <span className="tabular-figure self-start font-semibold">{i.scoreLabel}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}

          {s.evolutions.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-2 text-sm font-bold">Evolução do playground</h4>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {s.evolutions.map((e, idx) => (
                  <li key={idx} className="rounded-lg border border-paper-line p-3 text-sm">
                    <div className="mb-1 text-xs text-ink-faint">
                      {e.visitNo ? `Visita ${e.visitNo} · ` : ""}
                      {e.authorName}
                      {e.authorSpecialty ? ` (${e.authorSpecialty})` : ""} · {when(e.savedAt)}
                    </div>
                    {e.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
