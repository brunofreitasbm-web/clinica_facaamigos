/**
 * Helpers de dados e formatação para preços particulares por especialidade
 * (specialty_prices) — usados pelo cadastro de gestor
 * (app/gestor/cadastros/precos-particulares) e pelo chatbot de FAQ
 * (lib/twilio-faq-bot.ts) para citar valores atualizados.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type SpecialtyPriceRow = Database["public"]["Tables"]["specialty_prices"]["Row"];

/**
 * Formata um valor em reais (número, ex.: 150 ou 150.5) como moeda BRL —
 * "R$ 150,00". Repete o padrão já usado em lib/format.ts (`fmtCurrency`),
 * mas sem tolerar nulo: aqui o chamador sempre tem um preço numérico em mãos.
 */
export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Total do pacote mensal: preço unitário da sessão × número de sessões. */
export function packageTotal(unitPrice: number, sessions: number): number {
  return unitPrice * sessions;
}

/**
 * Formata o bloco "VALORES PARTICULARES" citado pelo chatbot de WhatsApp
 * (lib/twilio-faq-bot.ts) — uma linha por especialidade com preço e
 * duração, mais uma linha explicando como o pacote mensal adiantado é
 * calculado (preço da especialidade × N sessões). Fica aqui (função pura,
 * sem I/O) em vez de em lib/twilio-faq-bot.ts para poder ser importada
 * direto pelos testes (node --experimental-strip-types) sem arrastar os
 * imports de runtime desse módulo (gemini, admin client etc.).
 */
export function formatPricesBlock(
  rows: { label: string; price: number; duration_minutes: number }[],
  defaultSessions: number,
): string {
  if (rows.length === 0) {
    return "(nenhum preço particular cadastrado ainda)";
  }

  const lines = rows.map(
    (r) => `${r.label}: ${formatBRL(r.price)} / sessão de ${r.duration_minutes} min`,
  );

  lines.push(
    `Pacote mensal adiantado = preço da especialidade × N sessões (hoje N = ${defaultSessions}).`,
  );

  return lines.join("\n");
}

export async function listSpecialtyPrices(
  supabase: SupabaseClient<Database>,
  clinicId: string,
): Promise<SpecialtyPriceRow[]> {
  const { data } = await supabase
    .from("specialty_prices")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("specialty_value");

  return data ?? [];
}

export async function getSpecialtyPrice(
  supabase: SupabaseClient<Database>,
  clinicId: string,
  specialtyValue: string,
): Promise<SpecialtyPriceRow | null> {
  const { data } = await supabase
    .from("specialty_prices")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("specialty_value", specialtyValue)
    .maybeSingle();

  return data ?? null;
}
