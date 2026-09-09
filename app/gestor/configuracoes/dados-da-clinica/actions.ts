"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

const UF_RE = /^[A-Za-z]{2}$/;

function field(formData: FormData, name: string): string | null {
  const v = String(formData.get(name) ?? "").trim();
  return v.length ? v : null;
}

/**
 * Grava os dados institucionais da clínica (tabela `clinics`, colunas de
 * 20260909120000_clinic_letterhead_identity.sql) — é o que alimenta o timbre
 * de todo PDF exportado (lib/letterhead-pdf.tsx) e os documentos impressos
 * da recepção (app/recepcao/documentos). RLS (clinics_update_by_gestor) só
 * libera escrita pra gestor, então falha de permissão chega aqui como erro
 * de update, não como 403 explícito.
 *
 * Cada campo é opcional (menos o nome fantasia): documento não pode sair com
 * dado inventado, então o que a clínica não preencher aqui simplesmente não
 * aparece no timbre (ver getClinicIdentity em lib/clinic-identity.ts).
 */
export async function updateClinicIdentity(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { success: false, error: "Informe o nome fantasia da clínica." };

  const uf = field(formData, "endereco_uf");
  if (uf && !UF_RE.test(uf)) {
    return { success: false, error: "UF deve ter 2 letras (ex.: SP)." };
  }

  const email = field(formData, "email");
  if (email && !email.includes("@")) {
    return { success: false, error: "Informe um e-mail válido." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("clinics")
    .update({
      name,
      razao_social: field(formData, "razao_social"),
      cnpj: field(formData, "cnpj"),
      endereco_logradouro: field(formData, "endereco_logradouro"),
      endereco_numero: field(formData, "endereco_numero"),
      endereco_complemento: field(formData, "endereco_complemento"),
      endereco_bairro: field(formData, "endereco_bairro"),
      endereco_cidade: field(formData, "endereco_cidade"),
      endereco_uf: uf ? uf.toUpperCase() : null,
      endereco_cep: field(formData, "endereco_cep"),
      telefone: field(formData, "telefone"),
      whatsapp: field(formData, "whatsapp"),
      email,
      site: field(formData, "site"),
      responsavel_tecnico: field(formData, "responsavel_tecnico"),
      responsavel_tecnico_conselho: field(formData, "responsavel_tecnico_conselho"),
    })
    .eq("id", DEV_CLINIC_ID);

  if (error) {
    return { success: false, error: "Não foi possível salvar — verifique se você tem permissão de gestor." };
  }

  revalidatePath("/gestor/configuracoes/dados-da-clinica");
  revalidatePath("/recepcao/documentos");
  return { success: true };
}
