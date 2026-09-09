"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/document-extraction";
import type { TablesInsert } from "@/lib/database.types";

/**
 * Recebe o formulário público de agendamento da landing page (app/site).
 *
 * Mesmo desenho de app/ficha/[token]/actions.ts: quem escreve aqui é um
 * visitante sem sessão, então a escrita passa por service-role — não existe
 * (e não deve existir) policy de insert para `anon` em `site_leads`. Toda a
 * validação e a trava anti-flood moram neste arquivo, não numa policy que
 * qualquer um poderia exercitar direto com a chave publicável.
 */

export type LeadResult = { success: true } | { success: false; error: string };

const NOME_MIN = 2;
const NOME_MAX = 120;
const MENSAGEM_MAX = 2000;
const IDADE_MAX = 60;

// Mesmo telefone não pode reenviar em menos de um minuto — o suficiente pra
// barrar duplo-clique e bot ingênuo, sem incomodar quem só quer confirmar
// algo esquecido no formulário.
const JANELA_ANTIFLOOD_MS = 60_000;

function texto(formData: FormData, chave: string): string | null {
  const v = formData.get(chave);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function submitLead(formData: FormData): Promise<LeadResult> {
  // Honeypot: campo invisível para humanos, preenchido só por bots que
  // completam todo input do form. Se veio preenchido, finge sucesso — não
  // dá pista pro bot de que foi barrado.
  if (texto(formData, "website")) {
    return { success: true };
  }

  const nome = texto(formData, "nome");
  if (!nome || nome.length < NOME_MIN || nome.length > NOME_MAX) {
    return { success: false, error: "Conte pra gente o seu nome, para sabermos com quem estamos falando." };
  }

  const telefoneOriginal = texto(formData, "telefone");
  if (!telefoneOriginal) {
    return { success: false, error: "Informe um telefone com DDD para a recepção te chamar." };
  }
  const telefoneNormalizado = normalizePhone(telefoneOriginal);
  const telefone = telefoneNormalizado ?? telefoneOriginal;
  if (telefone.replace(/\D/g, "").length < 10) {
    return { success: false, error: "Confira o telefone: falta o DDD ou algum dígito." };
  }

  const idade = texto(formData, "idade");
  if (idade && idade.length > IDADE_MAX) {
    return { success: false, error: "A idade da criança ficou muito longa — resuma em poucas palavras." };
  }

  const mensagem = texto(formData, "mensagem");
  if (mensagem && mensagem.length > MENSAGEM_MAX) {
    return { success: false, error: "A mensagem ficou muito longa. Resuma em até 2000 caracteres." };
  }

  const origem = texto(formData, "origem") ?? "site";

  const admin = createAdminClient();

  // Anti-flood: mesmo telefone, últimos 60s. Não bloqueia por IP (a família
  // pode estar na mesma rede de uma clínica/escola) nem por nome (pode
  // haver homônimos) — telefone é o identificador estável aqui.
  const desde = new Date(Date.now() - JANELA_ANTIFLOOD_MS).toISOString();
  const { count } = await admin
    .from("site_leads")
    .select("id", { count: "exact", head: true })
    .eq("telefone", telefone)
    .gte("created_at", desde);

  if (count && count > 0) {
    return { success: true };
  }

  const insert: TablesInsert<"site_leads"> = {
    responsavel_nome: nome,
    telefone,
    crianca_idade: idade,
    mensagem,
    origem: origem.slice(0, 120),
  };

  const { error } = await admin.from("site_leads").insert(insert);
  if (error) {
    console.error("Erro ao salvar lead do site:", error);
    return { success: false, error: "Não conseguimos enviar agora. Tente novamente ou chame no WhatsApp." };
  }

  return { success: true };
}
