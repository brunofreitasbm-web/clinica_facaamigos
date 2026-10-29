import { CLINIC_TIMEZONE } from "@/lib/constants";
import { buildPrefillView, type PrefillRow } from "@/lib/pre-anamnesis-questions";

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * "Respostas da família antes da consulta": o que o responsável escreveu na
 * pré-anamnese por WhatsApp (lib/twilio-preanamnesis-bot.ts), em
 * `anamnesis_prefill_requests.structured`. Só leitura e só dado bruto — o
 * terapeuta aprofunda na consulta; isso NÃO é a anamnese oficial (`anamneses`).
 * Vive no topo de AnamnesePanel, então aparece na tela do terapeuta avaliador
 * e na da supervisão. Sem convite para o paciente, não renderiza nada.
 */
export function PreAnamnesisCard({ row }: { row: PrefillRow | null }) {
  const view = buildPrefillView(row);
  if (!view) return null;

  if (view.kind === "answered") {
    return (
      <section className="card max-w-4xl" aria-label="Respostas da família antes da consulta">
        <h3 className="text-sm font-semibold text-ink">Respostas da família antes da consulta</h3>
        <p className="mt-1 text-xs text-ink-soft">
          Enviadas pelo WhatsApp{view.respondedAt ? ` em ${fmtDateTime(view.respondedAt)}` : ""} · só leitura · aprofunde na consulta, não substitui a anamnese.
        </p>
        <dl className="mt-3 grid gap-3">
          {view.items.map((item) => (
            <div key={item.label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-soft">{item.label}</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-ink">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    );
  }

  if (view.kind === "declined") {
    return (
      <section className="card max-w-4xl" aria-label="Pré-anamnese recusada">
        <h3 className="text-sm font-semibold text-ink">Pré-anamnese por WhatsApp</h3>
        <p className="mt-1 text-sm text-ink-soft">A família preferiu preencher tudo presencialmente com o terapeuta.</p>
      </section>
    );
  }

  return (
    <section className="card max-w-4xl" aria-label="Pré-anamnese aguardando resposta">
      <h3 className="text-sm font-semibold text-ink">Pré-anamnese por WhatsApp</h3>
      <p className="mt-1 text-sm text-ink-soft">
        Convite enviado{view.sentAt ? ` em ${fmtDateTime(view.sentAt)}` : ""}
        {view.reminded ? " (com lembrete)" : ""}. A família ainda não respondeu: conduza a anamnese completa na consulta.
      </p>
    </section>
  );
}
