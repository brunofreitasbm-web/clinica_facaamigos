import { createClient } from "@/lib/supabase/server";

/**
 * Contagem de alertas de NPS em aberto, exibida no item "NPS" do GestorNav.
 *
 * Vive num componente próprio porque o GestorNav é `"use client"` e não pode
 * ter filho async — ele recebe este server component como prop `ReactNode`.
 * Antes a contagem era buscada em app/gestor/nps/page.tsx e passada por prop,
 * então o badge só aparecia pra quem já estava na tela de NPS: justamente
 * quem não precisava do aviso.
 *
 * Renderizado dentro de um <Suspense> em app/gestor/layout.tsx — a query não
 * pode atrasar a barra de navegação (`loading.tsx` não cobre o layout).
 */
export async function NpsAlertsBadge() {
  const supabase = await createClient();

  const { count } = await supabase
    .from("nps_surveys")
    .select("id", { count: "exact", head: true })
    .in("alert_status", ["pending_contact", "em_atendimento"]);

  if (!count) return null;

  return (
    <span
      className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold"
      style={{ background: "var(--color-status-negative, #d92d20)", color: "#fff" }}
    >
      {count}
    </span>
  );
}
