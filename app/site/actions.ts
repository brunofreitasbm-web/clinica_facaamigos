"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/document-extraction";
import type { TablesInsert } from "@/lib/database.types";
import { linkWhatsApp } from "./content";

/**
 * Recebe o formulário público de agendamento da landing page (app/site).
 *
 * Mesmo desenho de app/ficha/[token]/actions.ts: quem escreve aqui é um
 * visitante sem sessão, então a escrita passa por service-role — não existe
 * (e não deve existir) policy de insert para `anon` em `site_leads`. Toda a
 * validação e a trava anti-flood moram neste arquivo, não numa policy que
 * qualquer um poderia exercitar direto com a chave publicável.
 */

/**
 * `whatsappUrl` vem preenchido quando o formulário é o de consulta de plano:
 * o formulário grava o lead e, na sequência, joga a família na conversa com a
 * mensagem já escrita.
 *
 * O disparo do chatbot é justamente essa mensagem de entrada — quem escreve
 * primeiro é a família, então a conversa nasce como `kind='lead'` pelo webhook
 * (lib/twilio.ts) e o bot de FAQ já responde com a lista de convênios
 * (lib/twilio-faq-bot.ts). Iniciar a conversa do nosso lado exigiria template
 * aprovado pela Meta e falharia fora da janela de 24h; deixar a família mandar
 * o primeiro "oi" resolve isso sem nenhuma peça nova.
 */
export type LeadResult =
  | { success: true; whatsappUrl?: string }
  | { success: false; error: string };

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

  // ── Consulta de convênio ────────────────────────────────────────────
  // `convenio` chega como o id de um `insurers` ativo, "particular" ou
  // "outro". O id NUNCA é gravado direto: se a família (ou um bot) mandar um
  // uuid de outra clínica, ele tem que morrer aqui. Confirmamos contra a mesma
  // consulta que alimenta a lista da página.
  const convenioEscolhido = texto(formData, "convenio");
  const convenioOutro = texto(formData, "convenio_outro");
  let convenioId: string | null = null;
  let convenioNome: string | null = null;

  if (convenioEscolhido === "particular") {
    convenioNome = "Particular";
  } else if (convenioEscolhido === "outro") {
    convenioNome = convenioOutro?.slice(0, 120) ?? null;
    if (!convenioNome) {
      return { success: false, error: "Escreva o nome do seu plano para a gente confirmar a cobertura." };
    }
  } else if (convenioEscolhido) {
    const { data: convenio } = await admin
      .from("insurers")
      .select("id, name")
      .eq("id", convenioEscolhido)
      .eq("active", true)
      .maybeSingle();
    if (!convenio) {
      return { success: false, error: "Não reconhecemos esse plano. Escolha de novo na lista, por favor." };
    }
    convenioId = convenio.id;
    convenioNome = convenio.name.trim();
  }

  const guiaBruta = texto(formData, "tem_guia");
  const temGuia = guiaBruta === "sim" || guiaBruta === "nao" || guiaBruta === "nao_sei" ? guiaBruta : null;

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
    convenio_id: convenioId,
    convenio_nome: convenioNome,
    tem_guia: temGuia,
  };

  const { error } = await admin.from("site_leads").insert(insert);
  if (error) {
    console.error("Erro ao salvar lead do site:", error);
    return { success: false, error: "Não conseguimos enviar agora. Tente novamente ou chame no WhatsApp." };
  }

  // Sem convênio no formulário é o formulário de contato geral: nada de
  // empurrar a família para o WhatsApp, a recepção é quem liga.
  if (!convenioEscolhido) {
    return { success: true };
  }

  return { success: true, whatsappUrl: linkWhatsApp(mensagemWhatsApp({ nome, convenioNome, temGuia, idade })) };
}

/**
 * Texto que a família envia no WhatsApp depois de consultar o plano.
 *
 * Escrito na voz dela, não na nossa: é ela quem manda a mensagem, e é essa
 * mensagem de entrada que abre a conversa de lead e aciona o bot de FAQ. Cada
 * frase repete um dado do formulário de propósito — quem atender no WhatsApp
 * vê o caso inteiro sem precisar abrir a fila de leads.
 */
function mensagemWhatsApp(dados: {
  nome: string;
  convenioNome: string | null;
  temGuia: string | null;
  idade: string | null;
}): string {
  const partes = [`Olá! Vim pelo site. Aqui é ${dados.nome}.`];

  if (dados.convenioNome === "Particular") {
    partes.push("Não tenho plano de saúde e queria entender como funciona o atendimento particular.");
  } else if (dados.convenioNome) {
    partes.push(`Queria saber se vocês atendem o meu plano: ${dados.convenioNome}.`);
  } else {
    partes.push("Queria saber quais planos de saúde vocês atendem.");
  }

  if (dados.idade) {
    partes.push(`Minha criança tem ${dados.idade}.`);
  }

  if (dados.temGuia === "sim") {
    partes.push("Já tenho o pedido médico (guia) em mãos.");
  } else if (dados.temGuia === "nao") {
    partes.push("Ainda não tenho o pedido médico (guia).");
  } else if (dados.temGuia === "nao_sei") {
    partes.push("Não sei o que é a guia / pedido médico.");
  }

  return partes.join(" ");
}
