import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/format";
import { CLINIC_TIMEZONE } from "@/lib/constants";

import { PreCadastrosExportButton } from "@/src/components/Recepcao/PreCadastros";
import { PageContainer } from "@/components/page-container";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando IA",
  processing: "Processando…",
  extracted: "Pronto para conferir",
  failed: "Falhou — reprocessar",
  validated: "Validado",
  rejected: "Rejeitado",
};

const STATUS_TAG_CLASS: Record<string, string> = {
  pending: "st-agendada",
  processing: "st-agendada",
  extracted: "st-confirmada",
  failed: "st-falta",
  validated: "st-realizada",
  rejected: "st-cancelada",
};

type DraftRow = {
  id: string;
  source: string;
  source_phone: string | null;
  status: string;
  created_at: string;
  patient_id: string | null;
  patients: { full_name: string } | { full_name: string }[] | null;
  registration_draft_files: { count: number }[];
};

function fileCount(row: DraftRow): number {
  return row.registration_draft_files?.[0]?.count ?? 0;
}

function patientName(row: DraftRow): string | null {
  const p = row.patients;
  if (!p) return null;
  return Array.isArray(p) ? p[0]?.full_name ?? null : p.full_name;
}

/**
 * "Cadastro assistido por IA" (20260907000001_registration_drafts.sql) —
 * fila de rascunhos extraídos do WhatsApp/portal ainda não validados pela
 * recepção. Separado em duas seções: pré-cadastros (telefone novo, sem
 * paciente vinculado) e documentos anexados a pacientes já cadastrados.
 */
export default async function PreCadastrosPage() {
  const supabase = await createClient();

  const { data: draftsRaw } = await supabase
    .from("registration_drafts")
    .select("id, source, source_phone, status, created_at, patient_id, patients(full_name), registration_draft_files(count)")
    .in("status", ["pending", "processing", "extracted", "failed"])
    .order("created_at", { ascending: false });

  const drafts = (draftsRaw ?? []) as unknown as DraftRow[];
  const preCadastros = drafts.filter((d) => !d.patient_id);
  const doPaciente = drafts.filter((d) => d.patient_id);

  const renderRow = (draft: DraftRow) => (
    <Link
      key={draft.id}
      href={`/recepcao/pre-cadastros/${draft.id}`}
      className="flex items-center justify-between gap-3 rounded-md border border-paper-line-strong bg-paper/60 px-4 py-3 text-sm no-underline"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">
          {patientName(draft) ?? draft.source_phone ?? "Documento avulso"}
        </p>
        <p className="text-ink-faint">
          {draft.source === "whatsapp" ? "WhatsApp" : "Portal da família"} · {fileCount(draft)} arquivo(s) ·{" "}
          {fmtDateTime(draft.created_at, CLINIC_TIMEZONE)}
        </p>
      </div>
      <span className={`tag-status ${STATUS_TAG_CLASS[draft.status] ?? "st-agendada"}`}>
        {STATUS_LABEL[draft.status] ?? draft.status}
      </span>
    </Link>
  );

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Recepção"
        title="Cadastro assistido por IA"
        description="Documentos enviados pela família pelo WhatsApp ou pelo portal, já extraídos pela IA. Confira os dados antes de salvar — nada vira cadastro sem essa validação."
      />
      <PageContainer className="gap-8">
        <div className="flex items-center justify-between gap-4 border-b border-paper-line-strong pb-4">
          <div>
            <p className="text-sm text-ink-soft">Gerenciamento de rascunhos de atendimento e documentos extraídos.</p>
          </div>
          <PreCadastrosExportButton label="Exportar Relatório em Lote" loadingLabel="Gerando relatório..." />
        </div>
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Pré-cadastros — número novo ({preCadastros.length})
          </h2>
          <div className="flex flex-col gap-2">
            {preCadastros.length === 0 && <p className="text-sm text-ink-faint">Nenhum pré-cadastro pendente.</p>}
            {preCadastros.map(renderRow)}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Documentos de pacientes cadastrados ({doPaciente.length})
          </h2>
          <div className="flex flex-col gap-2">
            {doPaciente.length === 0 && <p className="text-sm text-ink-faint">Nenhum documento pendente.</p>}
            {doPaciente.map(renderRow)}
          </div>
        </section>
      </PageContainer>
    </main>
  );
}
