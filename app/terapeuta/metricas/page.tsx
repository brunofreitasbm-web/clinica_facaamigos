import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMyTherapistMetrics } from "@/lib/therapist-metrics";

export const dynamic = "force-dynamic";

export default async function TerapeutaMetricasPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  // Métricas pessoais: só o próprio terapeuta enxerga as suas (mesma regra
  // da RLS de metric_snapshots). Gestor/supervisor já têm sua própria
  // visão por cargo em /gestor/metas — não é "ver como" aqui.
  if (!profile || (profile.role !== "terapeuta" && profile.role !== "gestor")) {
    redirect("/");
  }

  const metrics = await getMyTherapistMetrics(supabase, profile.id);

  return (
    <main className="flex flex-1 flex-col">
      <header
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        className="flex flex-col gap-2.5 px-5 pb-4 pt-7 sm:px-10"
      >
        <Link href="/terapeuta" className="text-[13px] no-underline opacity-80" style={{ color: "inherit" }}>
          ← Hoje
        </Link>
        <h1
          style={{ fontFamily: "var(--font-heading)" }}
          className="m-0 text-2xl font-semibold leading-tight text-inherit"
        >
          Minhas métricas
        </h1>
        <p className="text-xs opacity-70">Último mês fechado, calculado no dia 1 (PRD §10.3).</p>
      </header>

      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-3 p-5 sm:p-10">
        {metrics.map((m) => (
          <div key={m.key} className="card flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-ink">{m.label}</div>
              <div className="text-xs text-ink-soft">
                {m.periodLabel ? `Referente a ${m.periodLabel}` : "Ainda sem cálculo para este indicador"}
              </div>
            </div>
            <div
              className="text-lg font-semibold"
              style={{ fontFamily: "var(--font-heading)", color: m.valueLabel ? "var(--color-accent)" : "var(--color-ink-faint)" }}
            >
              {m.valueLabel ?? "—"}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
