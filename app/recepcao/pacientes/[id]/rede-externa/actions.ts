"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

const KINDS = ["escola", "medico", "outro_profissional"] as const;
const CHANNELS = ["telefone", "email", "reuniao", "relatorio_compartilhado", "outro"] as const;

/** Cadastro de contato externo (escola/médico/outro profissional) de um paciente. RLS restringe a gestor/supervisor/terapeuta com acesso ao paciente. */
export async function createExternalContact(patientId: string, formData: FormData): Promise<ActionResult> {
  const kind = String(formData.get("kind") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const roleTitle = String(formData.get("roleTitle") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!KINDS.includes(kind as (typeof KINDS)[number])) return { success: false, error: "Selecione o tipo de contato." };
  if (!name) return { success: false, error: "Dê um nome ao contato." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada." };

  const { error } = await supabase.from("external_contacts").insert({
    clinic_id: DEV_CLINIC_ID,
    patient_id: patientId,
    kind,
    name,
    role_title: roleTitle || null,
    phone: phone || null,
    email: email || null,
    notes: notes || null,
    created_by: user.id,
  });

  if (error) {
    return { success: false, error: "Não foi possível cadastrar o contato — verifique sua permissão." };
  }

  revalidatePath(`/recepcao/pacientes/${patientId}/rede-externa`);
  return { success: true };
}

export async function logExternalContact(patientId: string, formData: FormData): Promise<ActionResult> {
  const externalContactId = String(formData.get("externalContactId") ?? "").trim();
  const channel = String(formData.get("channel") ?? "");
  const summary = String(formData.get("summary") ?? "").trim();

  if (!externalContactId) return { success: false, error: "Contato não encontrado." };
  if (!CHANNELS.includes(channel as (typeof CHANNELS)[number])) return { success: false, error: "Selecione o canal de contato." };
  if (!summary) return { success: false, error: "Descreva o que foi tratado." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada." };

  const { error } = await supabase.from("external_contact_logs").insert({
    external_contact_id: externalContactId,
    contacted_by: user.id,
    channel,
    summary,
  });

  if (error) {
    return { success: false, error: "Não foi possível registrar o contato." };
  }

  revalidatePath(`/recepcao/pacientes/${patientId}/rede-externa`);
  return { success: true };
}
