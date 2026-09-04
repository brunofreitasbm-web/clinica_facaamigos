import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Cliente service-role: ignora RLS. Só para uso em Server Actions/Server
 * Components, nunca em código client-side. Débito técnico registrado em
 * docs/superpowers/specs/2026-09-04-cadastro-continuo-design.md —
 * substituir por escrita autenticada quando o login existir.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
