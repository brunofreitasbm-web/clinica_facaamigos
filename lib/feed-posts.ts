import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

export type FeedPostView = {
  id: string;
  body: string | null;
  createdAt: string;
  authorName: string;
  media: { id: string; url: string; mimeType: string }[];
};

// Mesmo teto usado em app/recepcao/pacientes/[id]/documents-actions.ts (PRD §11).
const SIGNED_URL_TTL_SECONDS = 900;

/**
 * Lê o mural (feed_posts + feed_media) de um paciente e já resolve signed
 * URLs de mídia — usado tanto pela ficha da recepção (staff, que também
 * posta) quanto pelo portal da família (só leitura). RLS de feed_posts/
 * feed_media (20260904000022_family_feed.sql) é o portão real de quem pode
 * ver o quê; aqui só formatamos o que a query já devolveu.
 */
export async function getFeedPosts(
  supabase: SupabaseClient<Database>,
  patientId: string,
): Promise<FeedPostView[]> {
  const { data: rows } = await supabase
    .from("feed_posts")
    .select("id, body, created_at, profiles(full_name), feed_media(id, storage_path, mime_type)")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (!rows?.length) return [];

  let admin: ReturnType<typeof createAdminClient> | null = null;
  try {
    admin = createAdminClient();
  } catch {
    admin = null;
  }

  return Promise.all(
    rows.map(async (row) => {
      const authorName =
        (Array.isArray(row.profiles) ? row.profiles[0]?.full_name : row.profiles?.full_name) ?? "Equipe";
      const mediaRows = row.feed_media ?? [];
      const media = admin
        ? (
            await Promise.all(
              mediaRows.map(async (m) => {
                const { data: signed } = await admin!.storage
                  .from("family-feed-media")
                  .createSignedUrl(m.storage_path, SIGNED_URL_TTL_SECONDS);
                return signed ? { id: m.id, url: signed.signedUrl, mimeType: m.mime_type } : null;
              }),
            )
          ).filter((m): m is { id: string; url: string; mimeType: string } => m !== null)
        : [];
      return { id: row.id, body: row.body, createdAt: row.created_at, authorName, media };
    }),
  );
}
