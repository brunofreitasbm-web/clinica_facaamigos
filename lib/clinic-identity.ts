import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Identidade oficial da marca — fonte única de verdade para qualquer texto
 * estático que exiba o nome da instituição (metadata, manifest, títulos de
 * tela, e-mails, WhatsApp). Nome oficial: "FaçaAmigos - Centro de Terapia
 * Comportamental". Nunca escreva o nome à mão: importe daqui.
 *
 * Para o nome que vem cadastrado por clínica (timbre de documento, com CNPJ
 * e endereço reais), use `getClinicIdentity` abaixo — ele busca da tabela
 * `clinics` e cai no nome oficial só como fallback.
 */
export const CLINIC_BRAND = "FaçaAmigos";
export const CLINIC_TAGLINE = "Centro de Terapia Comportamental";
export const CLINIC_NAME = `${CLINIC_BRAND} - ${CLINIC_TAGLINE}`;
export const CLINIC_NAME_DISPLAY = `${CLINIC_BRAND} — ${CLINIC_TAGLINE}`;
export const CLINIC_SUPPORT_EMAIL = "contato@clinicafacaamigos.com.br";
export const CLINIC_WEBSITE = "https://facaamigos.com.br";

/**
 * Identidade institucional da clínica para uso em timbre de documento
 * (PDF exportado, tela de impressão, calendário do PTS). Fonte: tabela
 * `clinics` (ver supabase/migrations/20260909120000_clinic_letterhead_identity.sql).
 *
 * Tudo aqui é opcional de propósito: documento fiscal/clínico não pode
 * inventar endereço ou CNPJ que a clínica não cadastrou. Quem renderiza o
 * timbre (ex.: lib/letterhead-pdf.tsx) só mostra a linha cujo dado existe.
 */
export type ClinicIdentity = {
  nomeFantasia: string;
  razaoSocial: string | null;
  cnpj: string | null;
  endereco: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  site: string | null;
  responsavel: string | null;
};

function formatCnpj(raw: string | null): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  if (d.length !== 14) return raw;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatEndereco(row: {
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  endereco_cep: string | null;
}): string | null {
  const via = [row.endereco_logradouro, row.endereco_numero].filter(Boolean).join(", ");
  const linha1 = [via, row.endereco_complemento, row.endereco_bairro].filter(Boolean).join(" — ");
  const cidadeUf = [row.endereco_cidade, row.endereco_uf].filter(Boolean).join("/");
  const linha2 = [cidadeUf, row.endereco_cep].filter(Boolean).join(" · ");
  const linhas = [linha1, linha2].filter(Boolean);
  return linhas.length ? linhas.join(" · ") : null;
}

/**
 * Busca a identidade da clínica pelo `clinicId`. Se `clinicId` faltar (ou a
 * linha não existir), devolve um objeto só com `nomeFantasia: "FaçaAmigos"` —
 * o timbre continua funcionando, só sem os dados institucionais.
 */
export async function getClinicIdentity(
  supabase: SupabaseClient<Database>,
  clinicId: string | null | undefined,
): Promise<ClinicIdentity> {
  const fallback: ClinicIdentity = {
    // Só a marca — não o nome oficial completo (CLINIC_NAME): quem renderiza
    // o timbre mostra a assinatura "Centro de Terapia Comportamental" como
    // linha separada (ver app/recepcao/documentos/documentos-manager.tsx),
    // então nomeFantasia com o nome completo duplicaria a assinatura.
    nomeFantasia: CLINIC_BRAND,
    razaoSocial: null,
    cnpj: null,
    endereco: null,
    telefone: null,
    whatsapp: null,
    email: null,
    site: null,
    responsavel: null,
  };
  if (!clinicId) return fallback;

  const { data } = await supabase
    .from("clinics")
    .select(
      "name, razao_social, cnpj, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_uf, endereco_cep, telefone, whatsapp, email, site, responsavel_tecnico, responsavel_tecnico_conselho",
    )
    .eq("id", clinicId)
    .maybeSingle();
  if (!data) return fallback;

  const responsavel = data.responsavel_tecnico
    ? [data.responsavel_tecnico, data.responsavel_tecnico_conselho].filter(Boolean).join(" · ")
    : null;

  return {
    nomeFantasia: data.name || fallback.nomeFantasia,
    razaoSocial: data.razao_social,
    cnpj: formatCnpj(data.cnpj),
    endereco: formatEndereco(data),
    telefone: data.telefone,
    whatsapp: data.whatsapp,
    email: data.email,
    site: data.site,
    responsavel,
  };
}
