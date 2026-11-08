import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cliente service-role SEM tipos do schema: as colunas de cobrança entram em
 * lib/database.types.ts quando a migration 20261105120000 for aplicada e os tipos regenerados
 * (`supabase gen types`). Até lá, as rotas de cobrança usam este cliente solto.
 */
export function createBillingDb(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient;
}

/** Autorização das rotas de cron (mesmo padrão de app/api/twilio/nps/trigger). */
export function isCronAuthorized(req: Request): boolean {
  const env = process.env.CRON_SECRET;
  const got = req.headers.get("x-cron-secret");
  return Boolean(env && got && got === env);
}
