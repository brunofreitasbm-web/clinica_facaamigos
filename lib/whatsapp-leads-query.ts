// lib/whatsapp-leads-query.ts
//
// Consulta do painel "Leads via WhatsApp" (Supervisão). Usa o client de
// sessão — quem decide o que aparece é a RLS, nunca o admin client.
//
// Leads = patients `interessado` que vieram do chatbot (entry_source) OU que
// já têm ao menos um documento com source='whatsapp'. Pré-cadastros "a frio"
// = registration_drafts do WhatsApp ainda sem paciente (patient_id nulo).
//
// Tudo em poucas queries com embed do PostgREST (sem N+1). As colunas novas de
// `documents` (original_name, mime_type, source) ainda não estão em
// lib/database.types.ts, então o client é tratado como não-tipado aqui e o
// resultado é convertido pelos tipos locais abaixo.
import type { SupabaseClient } from "@supabase/supabase-js";

export const WHATSAPP_LEADS_LIMIT = 50;

const ENTRY_SOURCES = ["chatbot_whatsapp", "WhatsApp"];
const DRAFT_OPEN_STATUSES = ["pending", "processing", "extracted", "failed"];

export type LeadDocumentRow = {
  id: string;
  category: string;
  original_name: string | null;
  mime_type: string | null;
  source: string | null;
  uploaded_at: string;
  note: string | null;
};

export type LeadGuardianRow = {
  id: string;
  full_name: string;
  phone: string;
  cpf: string | null;
  email: string | null;
  relationship: string | null;
};

export type LeadInsuranceRow = {
  card_number: string | null;
  is_private: boolean;
  plan_name: string | null;
  insurers: { name: string } | { name: string }[] | null;
};

export type LeadRequestRow = {
  id: string;
  status: string;
  created_at: string;
  is_private: boolean | null;
  card_number: string | null;
};

export type WhatsappLeadRow = {
  id: string;
  full_name: string;
  birth_date: string | null;
  cid: string | null;
  entry_source: string | null;
  first_contact_at: string | null;
  created_at: string;
  guardians: LeadGuardianRow[] | null;
  documents: LeadDocumentRow[] | null;
  patient_insurance: LeadInsuranceRow[] | null;
  anamnesis_scheduling_requests: LeadRequestRow[] | null;
};

export type DraftFileRow = {
  id: string;
  original_name: string | null;
  mime_type: string;
  detected_type: string | null;
  created_at: string;
};

export type WhatsappDraftRow = {
  id: string;
  status: string;
  created_at: string;
  source_phone: string | null;
  extracted: unknown;
  error: string | null;
  warnings: string[] | null;
  registration_draft_files: DraftFileRow[] | null;
};

export type WhatsappLeadsData = {
  leads: WhatsappLeadRow[];
  drafts: WhatsappDraftRow[];
  leadsTruncated: boolean;
  draftsTruncated: boolean;
  /** Mensagens curtas das consultas que falharam (o resto do painel segue). */
  errors: string[];
};

const LEAD_SELECT = `
  id, full_name, birth_date, cid, entry_source, first_contact_at, created_at,
  guardians(id, full_name, phone, cpf, email, relationship),
  documents(id, category, original_name, mime_type, source, uploaded_at, note),
  patient_insurance(card_number, is_private, plan_name, insurers(name)),
  anamnesis_scheduling_requests(id, status, created_at, is_private, card_number)
`;

const DRAFT_SELECT = `
  id, status, created_at, source_phone, extracted, error, warnings,
  registration_draft_files(id, original_name, mime_type, detected_type, created_at)
`;

const arrivalMs = (l: WhatsappLeadRow) => new Date(l.first_contact_at ?? l.created_at).getTime();

export async function fetchWhatsappLeads(client: SupabaseClient): Promise<WhatsappLeadsData> {
  const errors: string[] = [];
  // O limite +1 permite saber se havia mais do que o painel mostra.
  const fetchLimit = WHATSAPP_LEADS_LIMIT + 1;

  const [byEntrySource, byDocument, drafts] = await Promise.all([
    client
      .from("patients")
      .select(LEAD_SELECT)
      .eq("status", "interessado")
      .in("entry_source", ENTRY_SOURCES)
      .order("created_at", { ascending: false })
      .order("uploaded_at", { referencedTable: "documents", ascending: false })
      .limit(fetchLimit),
    // Alias `wa` só filtra QUAIS pacientes entram; `documents` continua trazendo todos os arquivos.
    client
      .from("patients")
      .select(`${LEAD_SELECT}, wa:documents!inner(id)`)
      .eq("status", "interessado")
      .eq("wa.source", "whatsapp")
      .order("created_at", { ascending: false })
      .order("uploaded_at", { referencedTable: "documents", ascending: false })
      .limit(fetchLimit),
    client
      .from("registration_drafts")
      .select(DRAFT_SELECT)
      .eq("source", "whatsapp")
      .is("patient_id", null)
      .in("status", DRAFT_OPEN_STATUSES)
      .order("created_at", { ascending: false })
      .limit(fetchLimit),
  ]);

  if (byEntrySource.error) errors.push("leads do chatbot");
  if (byDocument.error) errors.push("leads com documentos");
  if (drafts.error) errors.push("pré-cadastros");

  const merged = new Map<string, WhatsappLeadRow>();
  for (const list of [byEntrySource.data, byDocument.data]) {
    for (const row of (list ?? []) as unknown as WhatsappLeadRow[]) {
      if (!merged.has(row.id)) merged.set(row.id, row);
    }
  }
  const sorted = [...merged.values()].sort((a, b) => arrivalMs(b) - arrivalMs(a));
  const draftRows = (drafts.data ?? []) as unknown as WhatsappDraftRow[];

  return {
    leads: sorted.slice(0, WHATSAPP_LEADS_LIMIT),
    drafts: draftRows.slice(0, WHATSAPP_LEADS_LIMIT),
    leadsTruncated: sorted.length > WHATSAPP_LEADS_LIMIT,
    draftsTruncated: draftRows.length > WHATSAPP_LEADS_LIMIT,
    errors,
  };
}
