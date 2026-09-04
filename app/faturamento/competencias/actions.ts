"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { computeCompetenceEligibility } from "@/lib/billing-eligibility";
import { CLINIC_TIMEZONE } from "@/lib/constants";

type CloseCompetenceResult =
  | { success: true; billingPeriodId: string }
  | { success: false; error: string };

type ExportCsvResult =
  | { success: true; csv: string; filename: string }
  | { success: false; error: string };

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function mapPostgresError(message: string): string {
  if (message.includes("realizada")) {
    return "Sessão não está com status realizada — não pode entrar na competência.";
  }
  if (message.includes("session_notes existente")) {
    return "Sessão sem evolução assinada — não pode entrar na competência.";
  }
  return "Não foi possível concluir a operação de faturamento. Tente de novo.";
}

/**
 * Fecha (ou reabre/reprocessa) a competência de um convênio+mês: cria a
 * linha em `billing_periods` se ainda não existir (idempotente — reusa a
 * existente pra esse par convênio+mês) e insere em `billing_items` toda
 * sessão elegível que ainda não tinha item (também idempotente: chamar de
 * novo só adiciona o que faltava, útil quando uma evolução foi assinada
 * depois do primeiro fechamento).
 */
export async function closeCompetence(
  insurerId: string,
  monthStr: string,
): Promise<CloseCompetenceResult> {
  if (!insurerId) {
    return { success: false, error: "Selecione um convênio." };
  }
  if (!MONTH_RE.test(monthStr)) {
    return { success: false, error: "Informe um mês de competência válido." };
  }

  const competenceMonth = `${monthStr}-01`;
  const supabase = await createClient();

  const { data: existingPeriod, error: lookupError } = await supabase
    .from("billing_periods")
    .select("id")
    .eq("insurer_id", insurerId)
    .eq("competence_month", competenceMonth)
    .maybeSingle();

  if (lookupError) {
    return { success: false, error: "Não foi possível verificar a competência. Tente de novo." };
  }

  let billingPeriodId = existingPeriod?.id ?? null;

  if (!billingPeriodId) {
    const { data: created, error: insertError } = await supabase
      .from("billing_periods")
      .insert({ insurer_id: insurerId, competence_month: competenceMonth })
      .select("id")
      .single();

    if (insertError) {
      // Corrida: outra chamada já criou a competência entre o select e o
      // insert acima — busca de novo em vez de falhar.
      if (insertError.code === "23505") {
        const { data: raceWinner } = await supabase
          .from("billing_periods")
          .select("id")
          .eq("insurer_id", insurerId)
          .eq("competence_month", competenceMonth)
          .maybeSingle();
        billingPeriodId = raceWinner?.id ?? null;
      }
      if (!billingPeriodId) {
        return {
          success: false,
          error: "Não foi possível abrir a competência. Verifique se você tem permissão de faturamento.",
        };
      }
    } else {
      billingPeriodId = created.id;
    }
  }

  // Narrow pro TS: toda ramificação acima ou retornou cedo ou atribuiu um
  // id de verdade — este guard só documenta isso pro compilador.
  if (!billingPeriodId) {
    return { success: false, error: "Não foi possível abrir a competência. Tente de novo." };
  }

  const { eligible } = await computeCompetenceEligibility(supabase, insurerId, monthStr);

  const { data: existingItems } = await supabase
    .from("billing_items")
    .select("appointment_id")
    .eq("billing_period_id", billingPeriodId);

  const alreadyBilled = new Set((existingItems ?? []).map((i) => i.appointment_id));
  const toInsert = eligible.filter((e) => !alreadyBilled.has(e.appointmentId));

  if (toInsert.length > 0) {
    const { error: itemsError } = await supabase.from("billing_items").insert(
      toInsert.map((e) => ({
        billing_period_id: billingPeriodId,
        appointment_id: e.appointmentId,
        procedure_code: e.procedureCode,
        amount: e.amount,
      })),
    );

    if (itemsError) {
      return { success: false, error: mapPostgresError(itemsError.message ?? "") };
    }
  }

  revalidatePath("/faturamento/competencias");
  revalidatePath(`/faturamento/competencias/${billingPeriodId}`);

  return { success: true, billingPeriodId };
}

function escapeCsvField(value: string): string {
  if (value.includes(";") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// NFD separa acento de letra base ("é" -> "e" + marca combinante); o
// replace seguinte descarta a marca (não é a-z0-9) e sobra só "e" — não
// precisa de uma regex de intervalo Unicode dedicada pra acento.
function sanitizeForFilename(value: string): string {
  return (
    value
      .normalize("NFD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "convenio"
  );
}

function formatAmountBr(amount: number): string {
  return amount.toFixed(2).replace(".", ",");
}

/**
 * Gera o CSV de exportação pro faturista (PRD §9.8: "paciente, carteirinha,
 * guia, procedimento, data, hora, profissional, conselho, valor") a partir
 * dos `billing_items` já gerados pelo fechamento, e marca a competência como
 * exportada (`status='enviada'`, `exported_at=now()`).
 */
export async function exportCompetenceCsv(billingPeriodId: string): Promise<ExportCsvResult> {
  if (!billingPeriodId) {
    return { success: false, error: "Competência inválida." };
  }

  const supabase = await createClient();

  const { data: period } = await supabase
    .from("billing_periods")
    .select("id, competence_month, insurers(name)")
    .eq("id", billingPeriodId)
    .maybeSingle();

  if (!period) {
    return { success: false, error: "Competência não encontrada." };
  }

  const { data: rawItems, error: itemsError } = await supabase
    .from("billing_items")
    .select(
      "procedure_code, amount, appointments(starts_at, patients(full_name), therapist:profiles!therapist_id(full_name, council_number, council_type), authorizations(guide_number, patient_insurance(card_number)))",
    )
    .eq("billing_period_id", billingPeriodId)
    .order("procedure_code");

  if (itemsError) {
    return { success: false, error: "Não foi possível ler os itens da competência. Tente de novo." };
  }

  const header = "Paciente;Carteirinha;Guia;Procedimento;Data;Hora;Profissional;Conselho;Valor";

  const rows = (rawItems ?? []).map((item) => {
    const appt = item.appointments as {
      starts_at: string;
      patients: { full_name: string } | null;
      therapist: { full_name: string; council_number: string | null; council_type: string | null } | null;
      authorizations: {
        guide_number: string | null;
        patient_insurance: { card_number: string | null } | null;
      } | null;
    } | null;

    const startsAt = appt?.starts_at ? new Date(appt.starts_at) : null;
    const dateStr = startsAt
      ? startsAt.toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE })
      : "";
    const timeStr = startsAt
      ? startsAt.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: CLINIC_TIMEZONE,
        })
      : "";

    const council = [appt?.therapist?.council_type, appt?.therapist?.council_number]
      .filter(Boolean)
      .join(" ");

    const fields = [
      appt?.patients?.full_name ?? "",
      appt?.authorizations?.patient_insurance?.card_number ?? "",
      appt?.authorizations?.guide_number ?? "",
      item.procedure_code,
      dateStr,
      timeStr,
      appt?.therapist?.full_name ?? "",
      council,
      formatAmountBr(Number(item.amount)),
    ];

    return fields.map(escapeCsvField).join(";");
  });

  // BOM UTF-8 (U+FEFF): garante que o Excel PT-BR abra nomes acentuados
  // corretamente. `String.fromCharCode` em vez de um literal no source pra
  // evitar depender de um caractere invisível no arquivo.
  const bom = String.fromCharCode(0xfeff);
  const csv = bom + [header, ...rows].join("\n");

  const insurerName = (period.insurers as { name: string } | null)?.name ?? "convenio";
  const monthStr = period.competence_month.slice(0, 7);
  const filename = `competencia-${sanitizeForFilename(insurerName)}-${monthStr}.csv`;

  const { error: updateError } = await supabase
    .from("billing_periods")
    .update({ status: "enviada", exported_at: new Date().toISOString() })
    .eq("id", billingPeriodId);

  if (updateError) {
    return { success: false, error: "CSV gerado, mas não foi possível marcar a competência como exportada." };
  }

  revalidatePath("/faturamento/competencias");
  revalidatePath(`/faturamento/competencias/${billingPeriodId}`);

  return { success: true, csv, filename };
}
