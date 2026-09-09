import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { getMetasTrabalhadas, type SessionNoteStructured } from "@/lib/session-note-fields";
import { getBehaviorCatalog } from "@/lib/behavior-catalog";
import { SessionNoteStructuredView } from "@/components/prontuario/session-note-structured";

export default async function EvolucaoHistoricoPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, patient_id, starts_at, discipline, patients(full_name)")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) notFound();

  // A RLS de session_notes já restringe o retorno a quem pode ver:
  // gestor/supervisor da clínica, a equipe vinculada ao paciente (patient_
  // access, 20260907170000_terapeuta_prontuario_rls.sql), ou o terapeuta
  // dono do appointment. Se vier vazio para alguém sem acesso, tratamos
  // como "sem histórico".
  const { data: versions } = await supabase
    .from("session_notes")
    .select(
      "id, version, supersedes_id, structured, free_text, edit_justification, signed_at, created_at_device, created_at_server, therapist_id, profiles!therapist_id(full_name)",
    )
    .eq("appointment_id", appointmentId)
    .order("version", { ascending: false });

  const patientName = (appointment.patients as { full_name: string } | null)?.full_name ?? "";
  const sessionDate = new Date(appointment.starts_at).toLocaleString("pt-BR", {
    timeZone: CLINIC_TIMEZONE,
    dateStyle: "short",
    timeStyle: "short",
  });

  const behaviorCatalog = await getBehaviorCatalog(supabase, { activeOnly: false });

  // Resolve plan_goal_id → descrição pra todas as versões de uma vez — a
  // meta pode não existir mais (plano revisado), por isso o fallback dentro
  // de SessionNoteStructuredView.
  const allMetaGoalIds = Array.from(
    new Set(
      (versions ?? []).flatMap((v) => getMetasTrabalhadas(v.structured as SessionNoteStructured | null).map((m) => m.plan_goal_id)),
    ),
  );
  const goalDescriptionById = new Map<string, string>();
  if (allMetaGoalIds.length > 0) {
    const { data: goals } = await supabase.from("plan_goals").select("id, description").in("id", allMetaGoalIds);
    for (const g of goals ?? []) goalDescriptionById.set(g.id, g.description);
  }

  return (
    <main className="flex flex-1 flex-col">
      <header
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        className="flex flex-col gap-2.5 px-5 pb-4 pt-7 sm:px-10"
      >
        <Link
          href={`/terapeuta/evolucao/${appointmentId}`}
          className="text-[13px] no-underline opacity-80"
          style={{ color: "inherit" }}
        >
          ← Voltar
        </Link>
        <div>
          <div className="text-sm opacity-70">
            Histórico de evolução · {appointment.discipline} · {sessionDate}
          </div>
          <h1
            style={{ fontFamily: "var(--font-heading)" }}
            className="m-0 text-3xl font-semibold leading-tight text-inherit"
          >
            {patientName}
          </h1>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[640px] md:max-w-[760px] flex-col gap-4 p-5 sm:p-10">
        {!versions || versions.length === 0 ? (
          <div className="card">
            <p className="text-base text-ink-soft">Nenhuma versão de evolução visível para este acesso.</p>
          </div>
        ) : (
          versions.map((v) => {
            const structured = v.structured as SessionNoteStructured | null;
            const therapistName =
              (v.profiles as { full_name: string } | null)?.full_name ?? "—";
            return (
              <div key={v.id} className="card flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="tag-status st-realizada w-fit">Versão {v.version}</span>
                  <span className="text-sm text-ink-soft">{therapistName}</span>
                </div>
                <div className="text-sm text-ink-soft">
                  Dispositivo:{" "}
                  {new Date(v.created_at_device).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE })} · Servidor:{" "}
                  {new Date(v.created_at_server).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE })}
                </div>
                <SessionNoteStructuredView
                  structured={structured}
                  freeText={v.free_text}
                  behaviorCatalog={behaviorCatalog}
                  goalDescriptionById={goalDescriptionById}
                  editJustification={v.edit_justification}
                />
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
