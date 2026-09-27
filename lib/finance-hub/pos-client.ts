import { createClient } from "@supabase/supabase-js";

/**
 * Cliente service-role para o projeto Supabase do PDV (Playground/Circuito
 * — projeto "controle-caixa", ivjvpdzsfjdpyabbzzuj), separado do projeto
 * desta clínica (vththexblpxwocbowhsv). É um projeto Supabase diferente,
 * então não dá pra usar view/FDW local — o número mensal é lido ao vivo
 * por aqui, dentro de uma Server Action/Server Component, nunca no client.
 *
 * Requer POS_SUPABASE_URL e POS_SUPABASE_SERVICE_ROLE_KEY nas env vars
 * (Vercel > Settings > Environment Variables deste projeto — o service
 * role key é o do projeto ivjvpdzsfjdpyabbzzuj, pegue em
 * supabase.com/dashboard/project/ivjvpdzsfjdpyabbzzuj/settings/api-keys).
 * Sem elas, os fetchers em pos-data.ts devolvem null e a tela do módulo
 * financeiro mostra "não disponível" em vez de quebrar a página.
 */
export function createPosAdminClient() {
  const url = process.env.POS_SUPABASE_URL;
  const serviceRoleKey = process.env.POS_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
