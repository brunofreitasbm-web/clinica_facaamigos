import {
  AlertCircle,
  Baby,
  CheckCircle2,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Mail,
  MessageCircle,
  Sparkles,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { todayInTimeZone } from "@/lib/timezone";
import { chronologicalAge, formatChronologicalAge } from "@/lib/age";
import { formatDateBR } from "@/lib/format";
import { DOCUMENT_CATEGORY_LABEL } from "@/lib/document-categories";
import {
  fetchWhatsappLeads,
  WHATSAPP_LEADS_LIMIT,
  type WhatsappDraftRow,
  type WhatsappLeadRow,
  type WhatsappLeadsData,
} from "@/lib/whatsapp-leads-query";
import {
  arrivalIso,
  computeCompleteness,
  DRAFT_STATUS_TAG,
  draftStatusLabel,
  fileKind,
  formatPhoneDisplay,
  maskCpf,
  REQUEST_STATUS_TAG,
  requestStatusLabel,
  summarizeDraftExtraction,
  whatsappLink,
} from "@/lib/whatsapp-leads-view";

const RELATIONSHIP_LABEL: Record<string, string> = {
  mae: "Mãe",
  pai: "Pai",
  avo: "Avó/Avô",
  tutor: "Tutor(a)",
  outro: "Outro",
};

const fmtArrival = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        timeZone: CLINIC_TIMEZONE,
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

function FileLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border-2 border-accent px-3 py-1 text-xs font-bold text-accent no-underline hover:bg-accent/10"
    >
      Abrir
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

function KindIcon({ kind }: { kind: ReturnType<typeof fileKind> }) {
  return kind === "Foto" ? (
    <ImageIcon className="h-4 w-4 shrink-0 text-accent-2" />
  ) : (
    <FileText className="h-4 w-4 shrink-0 text-accent" />
  );
}

function PhoneLink({ phone }: { phone: string | null }) {
  const link = whatsappLink(phone);
  const display = formatPhoneDisplay(phone);
  if (!link) return <span className="font-mono text-ink-soft">{display}</span>;
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-mono text-accent no-underline hover:underline"
    >
      <MessageCircle className="h-3.5 w-3.5" />
      {display}
    </a>
  );
}

function LeadCard({ lead, today }: { lead: WhatsappLeadRow; today: string }) {
  const guardians = lead.guardians ?? [];
  const guardian = guardians[0] ?? null;
  const insurance = (lead.patient_insurance ?? [])[0] ?? null;
  const requests = [...(lead.anamnesis_scheduling_requests ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const request = requests[0] ?? null;
  const documents = lead.documents ?? [];

  const isPrivate = insurance?.is_private ?? request?.is_private ?? false;
  const insurerName = one(insurance?.insurers)?.name ?? null;
  const cardNumber = insurance?.card_number ?? request?.card_number ?? null;
  const hasInsurance = !!insurance || !!request?.card_number;

  const completeness = computeCompleteness({
    birthDate: lead.birth_date,
    guardianName: guardian?.full_name ?? null,
    guardianCpf: guardian?.cpf ?? null,
    guardianEmail: guardian?.email ?? null,
    hasInsurance,
    isPrivate,
    cardNumber,
  });

  const age = lead.birth_date ? formatChronologicalAge(chronologicalAge(lead.birth_date, today)) : null;
  const cpf = maskCpf(guardian?.cpf);
  const relationship = guardian?.relationship ? RELATIONSHIP_LABEL[guardian.relationship] ?? guardian.relationship : null;

  return (
    <article className="card gap-3.5" data-testid="whatsapp-lead-card">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="flex items-center gap-1.5 text-sm font-bold text-ink">
              <Baby className="h-4 w-4 shrink-0 text-accent" />
              {lead.full_name}
            </h4>
            <span className="tag tag-accent-2">Lead WhatsApp</span>
          </div>
          <p className="mt-1 text-xs text-ink-faint">
            {lead.birth_date ? (
              <>
                Nascimento {formatDateBR(lead.birth_date)}
                {age ? ` · ${age}` : ""}
              </>
            ) : (
              "Nascimento não informado"
            )}
            {lead.cid ? (
              <>
                {" "}
                · CID <span className="font-mono text-ink-soft">{lead.cid}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`tag-status ${completeness.complete ? "st-realizada" : "st-falta"}`}>{completeness.label}</span>
          <span className="font-mono text-[11px] text-ink-faint">
            Chegou em {fmtArrival(arrivalIso(lead.first_contact_at, lead.created_at))}
          </span>
        </div>
      </header>

      <div className="grid gap-x-6 gap-y-1.5 text-xs text-ink-faint sm:grid-cols-2">
        <p className="flex flex-wrap items-center gap-1.5">
          <User className="h-3.5 w-3.5 shrink-0" />
          {guardian ? (
            <>
              <strong className="font-semibold text-ink-soft">{guardian.full_name}</strong>
              {relationship ? <span>({relationship})</span> : null}
              {guardians.length > 1 ? <span>+{guardians.length - 1}</span> : null}
            </>
          ) : (
            <span>Responsável não informado</span>
          )}
        </p>
        <p className="flex items-center gap-1.5">
          <PhoneLink phone={guardian?.phone ?? null} />
        </p>
        <p className="flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          {guardian?.email ? <span className="break-all text-ink-soft">{guardian.email}</span> : <span>E-mail não informado</span>}
        </p>
        <p className="flex items-center gap-1.5">
          <span className="shrink-0 text-[10px] font-bold">CPF</span>
          {cpf ? <span className="font-mono text-ink-soft">{cpf}</span> : <span>CPF não informado</span>}
        </p>
      </div>

      <p className="text-xs text-ink-soft">
        {isPrivate ? (
          <span className="font-medium">Atendimento particular</span>
        ) : hasInsurance ? (
          <>
            Convênio: <strong className="font-semibold">{insurerName ?? insurance?.plan_name ?? "não identificado"}</strong>
            {cardNumber ? (
              <>
                {" "}
                · cartão <span className="font-mono text-ink">{cardNumber}</span>
              </>
            ) : (
              <span className="text-ink-faint"> · cartão não informado</span>
            )}
          </>
        ) : (
          <span className="text-ink-faint">Convênio não informado</span>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {request ? (
          <span className={`tag-status ${REQUEST_STATUS_TAG[request.status] ?? "st-agendada"}`}>
            {requestStatusLabel(request.status)}
          </span>
        ) : (
          <span className="text-xs text-ink-faint">{requestStatusLabel(null)}</span>
        )}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-paper-line pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Documentos ({documents.length})</p>
        {documents.length === 0 ? (
          <p className="text-xs text-ink-faint">Nenhum documento recebido ainda.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {documents.map((doc) => {
              const kind = fileKind(doc.mime_type, doc.original_name);
              const category = DOCUMENT_CATEGORY_LABEL[doc.category] ?? doc.category;
              return (
                <li
                  key={doc.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-paper-line-strong bg-paper px-2.5 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <KindIcon kind={kind} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-ink">{category}</p>
                      <p className="truncate text-[11px] text-ink-faint">
                        {doc.original_name ?? "arquivo sem nome"} · {kind} · {fmtArrival(doc.uploaded_at)}
                      </p>
                      {doc.note ? <p className="truncate text-[11px] italic text-ink-faint">{doc.note}</p> : null}
                    </div>
                  </div>
                  <FileLink href={`/api/arquivos/documento/${doc.id}`} label={`Abrir ${category}`} />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="flex justify-end">
        <a
          href={`/supervisao/prontuario-unificado?p=${lead.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-accent no-underline hover:underline"
        >
          Abrir prontuário
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </footer>
    </article>
  );
}

function DraftCard({ draft }: { draft: WhatsappDraftRow }) {
  const summary = summarizeDraftExtraction(draft.extracted);
  const files = [...(draft.registration_draft_files ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const cpf = maskCpf(summary.guardianCpf);
  const hasExtraction = Object.values(summary).some(Boolean);
  const processing = draft.status === "pending" || draft.status === "processing";

  return (
    <article className="card gap-3.5" data-testid="whatsapp-draft-card">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="flex items-center gap-1.5 text-sm font-bold text-ink">
              <PhoneLink phone={draft.source_phone} />
            </h4>
            <span className="tag tag-neutral">Pré-cadastro</span>
          </div>
          <p className="mt-1 text-xs text-ink-faint">Ainda sem cadastro de paciente — a recepção precisa conferir.</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`tag-status ${DRAFT_STATUS_TAG[draft.status] ?? "st-agendada"}`}>{draftStatusLabel(draft.status)}</span>
          <span className="font-mono text-[11px] text-ink-faint">Chegou em {fmtArrival(draft.created_at)}</span>
        </div>
      </header>

      {hasExtraction ? (
        <div className="rounded-md border border-paper-line bg-paper px-3 py-2 text-xs text-ink-faint">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            <Sparkles className="h-3.5 w-3.5 text-accent-2" />O que a IA já leu
          </p>
          <dl className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
            {summary.childName ? (
              <div>
                <dt className="inline">Criança: </dt>
                <dd className="inline font-semibold text-ink-soft">{summary.childName}</dd>
              </div>
            ) : null}
            {summary.birthDate ? (
              <div>
                <dt className="inline">Nascimento: </dt>
                <dd className="inline font-semibold text-ink-soft">{formatDateBR(summary.birthDate)}</dd>
              </div>
            ) : null}
            {summary.cid ? (
              <div>
                <dt className="inline">CID: </dt>
                <dd className="inline font-mono text-ink-soft">{summary.cid}</dd>
              </div>
            ) : null}
            {summary.guardianName ? (
              <div>
                <dt className="inline">Responsável: </dt>
                <dd className="inline font-semibold text-ink-soft">{summary.guardianName}</dd>
              </div>
            ) : null}
            {cpf ? (
              <div>
                <dt className="inline">CPF: </dt>
                <dd className="inline font-mono text-ink-soft">{cpf}</dd>
              </div>
            ) : null}
            {summary.guardianEmail ? (
              <div>
                <dt className="inline">E-mail: </dt>
                <dd className="inline break-all text-ink-soft">{summary.guardianEmail}</dd>
              </div>
            ) : null}
            {summary.insurerName ? (
              <div>
                <dt className="inline">Convênio: </dt>
                <dd className="inline font-semibold text-ink-soft">{summary.insurerName}</dd>
              </div>
            ) : null}
            {summary.cardNumber ? (
              <div>
                <dt className="inline">Cartão: </dt>
                <dd className="inline font-mono text-ink-soft">{summary.cardNumber}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : processing ? (
        <p className="text-xs text-ink-faint">A IA ainda não terminou de ler os arquivos.</p>
      ) : null}

      {draft.status === "failed" && draft.error ? (
        <p className="flex items-start gap-1.5 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="break-words">{draft.error}</span>
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5 border-t border-paper-line pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Arquivos ({files.length})</p>
        {files.length === 0 ? (
          <p className="text-xs text-ink-faint">Nenhum arquivo neste rascunho.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {files.map((file) => {
              const kind = fileKind(file.mime_type, file.original_name);
              const label = file.detected_type ? (DOCUMENT_CATEGORY_LABEL[file.detected_type] ?? file.detected_type) : kind;
              return (
                <li
                  key={file.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-paper-line-strong bg-paper px-2.5 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <KindIcon kind={kind} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-ink">{label}</p>
                      <p className="truncate text-[11px] text-ink-faint">
                        {file.original_name ?? "arquivo sem nome"} · {kind}
                      </p>
                    </div>
                  </div>
                  <FileLink href={`/api/arquivos/rascunho/${file.id}`} label={`Abrir ${label}`} />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="flex justify-end">
        <a
          href={`/recepcao/pre-cadastros/${draft.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-accent no-underline hover:underline"
        >
          Conferir na recepção
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </footer>
    </article>
  );
}

function TruncatedNote({ what }: { what: string }) {
  return (
    <p className="text-[11px] text-ink-faint">
      Mostrando os {WHATSAPP_LEADS_LIMIT} {what} mais recentes — há mais além destes.
    </p>
  );
}

/**
 * Painel "Leads via WhatsApp" da Supervisão: quem chegou pelo chatbot e mandou
 * documentos, do mais recente ao mais antigo — leads já cadastrados como
 * `interessado` e pré-cadastros "a frio" ainda sem paciente. Server Component:
 * usa o client de sessão (a RLS decide o que aparece) e nunca quebra a página
 * se a consulta falhar.
 */
export async function WhatsappLeadsPanel() {
  let data: WhatsappLeadsData | null = null;
  let failed = false;
  try {
    const supabase = await createClient();
    data = await fetchWhatsappLeads(supabase);
  } catch (err) {
    console.error("[WhatsappLeadsPanel] falha ao carregar", err);
    failed = true;
  }

  const today = todayInTimeZone(CLINIC_TIMEZONE);
  const leads = data?.leads ?? [];
  const drafts = data?.drafts ?? [];
  const empty = !failed && leads.length === 0 && drafts.length === 0 && (data?.errors.length ?? 0) === 0;

  return (
    <section className="flex flex-col gap-4" aria-labelledby="whatsapp-leads-title">
      <div>
        <h3 id="whatsapp-leads-title" className="text-sm font-bold text-ink">
          Leads via WhatsApp
        </h3>
        <p className="mt-0.5 text-xs text-ink-faint">
          Famílias que chamaram no WhatsApp e enviaram documentos — do mais recente ao mais antigo.
        </p>
      </div>

      {failed || (data && data.errors.length > 0) ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {failed
              ? "Não foi possível carregar os leads do WhatsApp agora. Recarregue a página em instantes."
              : `Não foi possível carregar parte da lista (${data?.errors.join(", ")}). Recarregue a página em instantes.`}
          </span>
        </div>
      ) : null}

      {empty ? (
        <div className="card items-center gap-2 py-6 text-center">
          <MessageCircle className="mx-auto h-8 w-8 text-accent-2 opacity-80" />
          <p className="text-sm font-medium text-ink">Nenhum lead novo por aqui.</p>
          <p className="text-xs text-ink-faint">
            Quando uma família mandar documentos pelo WhatsApp, o cadastro aparece nesta lista.
          </p>
        </div>
      ) : null}

      {leads.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <CheckCircle2 className="h-3.5 w-3.5 text-accent-2" />
            Leads cadastrados ({leads.length})
          </h4>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} today={today} />
            ))}
          </div>
          {data?.leadsTruncated ? <TruncatedNote what="leads" /> : null}
        </div>
      ) : null}

      {drafts.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <Sparkles className="h-3.5 w-3.5 text-accent-2" />
            Pré-cadastros aguardando conferência ({drafts.length})
          </h4>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {drafts.map((draft) => (
              <DraftCard key={draft.id} draft={draft} />
            ))}
          </div>
          {data?.draftsTruncated ? <TruncatedNote what="pré-cadastros" /> : null}
        </div>
      ) : null}
    </section>
  );
}
