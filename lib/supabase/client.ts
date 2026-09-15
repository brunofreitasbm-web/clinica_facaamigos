import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

let clientInstance: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  if (typeof window === "undefined") {
    return createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }

  if (!clientInstance) {
    clientInstance = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      },
    );
  }

  return clientInstance;
}

export function isJwtExpiredError(error: any): boolean {
  if (!error) return false;
  const msg = typeof error === "string" ? error : error.message || "";
  const code = error.code || "";
  const status = error.status || error.statusCode || 0;

  return (
    code === "PGRST303" ||
    msg.toLowerCase().includes("jwt expired") ||
    msg.toLowerCase().includes("jwt is expired") ||
    (status === 401 && (msg.toLowerCase().includes("jwt") || msg.toLowerCase().includes("token")))
  );
}

export async function handleJwtExpiration(error: any): Promise<boolean> {
  if (!isJwtExpiredError(error)) return false;

  if (typeof window !== "undefined") {
    try {
      const client = createClient();
      const { data, error: refreshError } = await client.auth.refreshSession();
      if (!refreshError && data.session) {
        return true;
      }
    } catch {
      // Falha ao renovar
    }
    window.location.href = "/login?expired=true";
  }
  return false;
}

