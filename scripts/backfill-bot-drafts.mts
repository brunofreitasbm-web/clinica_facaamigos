// scripts/backfill-bot-drafts.mts
//
// BACKFILL dos leads que passaram pelo bot de agendamento ANTES de o bot
// espelhar cada passo em `registration_drafts` (lib/registration-drafts-bot.ts)
// e que por isso não aparecem na fila de Pendências da recepção:
//   - sessões em andamento (`chatbot_sessions`, passo ≠ idle/completed, com algum dado);
//   - solicitações do bot ainda abertas (`anamnesis_scheduling_requests` em
//     pendente_supervisor / aprovado).
// Cada telefone sem rascunho aberto ganha um (com `bot_collected` + os
// documentos do paciente-lead como arquivos do rascunho).
//
// PRÉ-REQUISITO: migration 20260921060000_draft_bot_collected.sql aplicada
// (coluna bot_collected + índice único). O script confere e aborta se faltar.
//
// COMO RODAR (raiz do projeto; mesmo loader do backfill-whatsapp-leads.mts):
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --import ./scripts/register-alias.mjs scripts/backfill-bot-drafts.mts           # dry-run (padrão)
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --import ./scripts/register-alias.mjs scripts/backfill-bot-drafts.mts --apply   # executa
// Lê .env.local. IDEMPOTENTE (telefone com rascunho aberto é pulado). Nunca
// imprime CPF, e-mail ou telefone completo. Atenção: a primeira carga da fila
// depois do --apply cria os "dono + prazo" de cada novo item (SLA de 24h) e o
// badge de Pendências dá um salto único.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { isBotDatumPresent } from "@/lib/lead-pendencies";
import { registerBotDraftFiles, syncBotDraft } from "@/lib/registration-drafts-bot";

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

const maskPhone = (phone: string) => (phone.length > 6 ? `${phone.slice(0, 5)}…${phone.slice(-2)}` : "***");

type Candidate = {
  phone: string;
  origin: "sessao" | "solicitacao";
  step: string;
  data: Record<string, unknown>;
  patientId: string | null;
};

async function main() {
  loadEnvLocal();
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply") && !args.has("--dry-run");
  const db = createAdminClient() as unknown as SupabaseClient;

  const probe = await db.from("registration_drafts").select("bot_collected").limit(1);
  if (probe.error) {
    console.error("Coluna registration_drafts.bot_collected não existe — aplique a migration 20260921060000 antes.", probe.error.message);
    process.exit(1);
  }

  const candidates: Candidate[] = [];

  const { data: sessions } = await db
    .from("chatbot_sessions")
    .select("phone_number, current_step, collected_data")
    .not("current_step", "in", "(idle,completed)");
  for (const s of (sessions ?? []) as { phone_number: string; current_step: string; collected_data: Record<string, unknown> | null }[]) {
    if (!isBotDatumPresent(s.collected_data)) continue;
    const data = s.collected_data ?? {};
    candidates.push({
      phone: s.phone_number,
      origin: "sessao",
      step: s.current_step,
      data,
      patientId: typeof data.lead_patient_id === "string" ? data.lead_patient_id : null,
    });
  }

  const { data: requests } = await db
    .from("anamnesis_scheduling_requests")
    .select(
      "id, guardian_name, guardian_phone, guardian_cpf, child_name, child_birth_date, laudo_pdf_url, guia_pdf_url, carteirinha_frente_url, carteirinha_verso_url, card_number, is_private, patient_id, status",
    )
    .in("status", ["pendente_supervisor", "aprovado"]);
  for (const r of (requests ?? []) as Record<string, unknown>[]) {
    const phone = typeof r.guardian_phone === "string" ? r.guardian_phone : null;
    if (!phone || candidates.some((c) => c.phone === phone)) continue; // a sessão em andamento é mais recente
    const data: Record<string, unknown> = {
      guardian_name: r.guardian_name,
      guardian_cpf: r.guardian_cpf,
      child_name: r.child_name,
      child_birth_date: r.child_birth_date,
      laudo_pdf_url: r.laudo_pdf_url,
      guia_pdf_url: r.guia_pdf_url,
      carteirinha_frente_url: r.carteirinha_frente_url,
      carteirinha_verso_url: r.carteirinha_verso_url,
      card_number: r.card_number,
      is_private: r.is_private === true,
      request_id: r.id,
      lead_patient_id: r.patient_id,
    };
    candidates.push({
      phone,
      origin: "solicitacao",
      step: "pending_supervisor",
      data,
      patientId: typeof r.patient_id === "string" ? r.patient_id : null,
    });
  }

  let skipped = 0;
  let created = 0;
  for (const c of candidates) {
    const { data: open } = await db
      .from("registration_drafts")
      .select("id")
      .eq("source", "whatsapp")
      .eq("source_phone", c.phone)
      .in("status", ["pending", "processing", "extracted", "failed"])
      .limit(1)
      .maybeSingle();
    if (open) {
      skipped++;
      continue;
    }
    console.log(`${apply ? "CRIA " : "criaria"} rascunho · ${c.origin} · passo ${c.step} · ${maskPhone(c.phone)}`);
    if (!apply) continue;

    await syncBotDraft({ phone: c.phone, data: c.data, step: c.step });
    if (c.patientId) {
      const { data: docs } = await db.from("documents").select("id").eq("patient_id", c.patientId).eq("source", "whatsapp");
      await registerBotDraftFiles({ phone: c.phone, documentIds: ((docs ?? []) as { id: string }[]).map((d) => d.id) });
    }
    created++;
  }

  console.log(
    `\n${apply ? "APLICADO" : "DRY-RUN"}: ${candidates.length} candidato(s) · ${skipped} já com rascunho aberto · ${apply ? created : candidates.length - skipped} ${apply ? "criado(s)" : "a criar"}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
