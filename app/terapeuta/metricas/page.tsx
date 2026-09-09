import { redirect } from "next/navigation";
import Link from "next/link";
import { Clock, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyTherapistMetrics, type TherapistMetricRow } from "@/lib/therapist-metrics";
import { BackToTodayShortcut } from "./back-shortcut";

export const dynamic = "force-dynamic";

function metricEmptyState(m: TherapistMetricRow) {
  if (!m.computed) {
    return {
      Icon: Info,
      text: "Ainda não calculado nesta versão do sistema",
    };
  }
  return {
    Icon: Clock,
    text: "Aguardando fechamento do período — cálculo sai no dia 1",
  };
}

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
      <BackToTodayShortcut />
      <header
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        className="flex flex-col gap-2.5 px-5 pb-4 pt-7 sm:px-10"
      >
        <Link
          href="/terapeuta"
          className="w-fit rounded text-[13px] no-underline opacity-80 transition-opacity hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          style={{ color: "inherit" }}
        >
          ← Hoje
        </Link>
        <p className="m-0 text-[11px] uppercase tracking-wide opacity-70" aria-hidden="true">
          Terapeuta / Minhas métricas
        </p>
        <h1
          style={{ fontFamily: "var(--font-heading)" }}
          className="m-0 text-3xl font-semibold leading-tight text-inherit"
        >
          Minhas métricas
        </h1>
        <p className="text-sm opacity-70">Último mês fechado, calculado no dia 1.</p>
      </header>

      <div className="mx-auto grid w-full max-w-[640px] grid-cols-1 gap-3 p-5 sm:p-10 md:max-w-[900px] md:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => {
          const empty = m.valueLabel ? null : metricEmptyState(m);
          return (
            <div
              key={m.key}
              role="region"
              aria-label={`Indicador: ${m.label}`}
              className="card flex items-center justify-between gap-3 border border-[var(--color-neutral-200)]"
            >
              <div className="flex flex-col gap-1">
                <div className="text-base font-semibold text-ink">{m.label}</div>
                {m.periodLabel ? (
                  <div className="text-sm text-ink-soft">Referente a {m.periodLabel}</div>
                ) : (
                  empty && (
                    <div className="flex items-center gap-1.5 text-sm text-ink-faint">
                      <empty.Icon size={13} aria-hidden="true" />
                      <span>{empty.text}</span>
                    </div>
                  )
                )}
              </div>
              <div
                className="text-xl font-semibold"
                style={{
                  fontFamily: "var(--font-heading)",
                  color: m.valueLabel ? "var(--color-accent)" : "var(--color-ink-faint)",
                }}
                aria-label={m.valueLabel ? undefined : "Sem valor calculado"}
              >
                {m.valueLabel ?? "—"}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
