import { redirect } from "next/navigation";

// A grade por sala foi unificada em /recepcao (alternância "Por sala" no
// agrupamento da agenda do dia) — essa rota some, mas fica como redirect pra
// não quebrar links/bookmarks existentes (ex.: app/recepcao/pacientes/[id]/page.tsx).
export default async function AgendaPageRedirect({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  redirect(date ? `/recepcao?date=${date}` : "/recepcao");
}
