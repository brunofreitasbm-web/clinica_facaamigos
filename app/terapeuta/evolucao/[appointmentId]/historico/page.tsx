import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import {
  BEHAVIOR_TYPES,
  FAMILY_GUIDANCE_OPTIONS,
  type SessionNoteStructured,
} from "@/lib/session-note-fields";

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
  // gestor/supervisor da clínica, ou o terapeuta dono do appointment.
  // Se vier vazio para alguém sem acesso, tratamos como "sem histórico".
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

  function behaviorLabel(value: string) {
    return BEHAVIOR_TYPES.find((b) => b.value === value)?.label ?? value;
  }

  function orientationLabel(value: string) {
    return FAMILY_GUIDANCE_OPTIONS.find((g) => g.value === value)?.label ?? value;
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
          <div className="text-xs opacity-70">
            Histórico de evolução · {appointment.discipline} · {sessionDate}
          </div>
          <h1
            style={{ fontFamily: "var(--font-heading)" }}
            className="m-0 text-2xl font-semibold leading-tight text-inherit"
          >
            {patientName}
          </h1>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4 p-5 sm:p-10">
        {!versions || versions.length === 0 ? (
          <div className="card">
            <p className="text-sm text-ink-soft">Nenhuma versão de evolução visível para este acesso.</p>
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
                  <span className="text-xs text-ink-soft">{therapistName}</span>
                </div>
                <div className="text-xs text-ink-soft">
                  Dispositivo:{" "}
                  {new Date(v.created_at_device).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE })} · Servidor:{" "}
                  {new Date(v.created_at_server).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE })}
                </div>
                {v.edit_justification && (
                  <div className="rounded-md border border-divider bg-paper/40 p-2.5 text-sm">
                    <span className="font-semibold text-ink">Motivo da edição: </span>
                    <span className="text-ink-soft">{v.edit_justification}</span>
                  </div>
                )}
                <div className="flex flex-col gap-1 text-sm text-ink">
                  <span>Presença/engajamento: {structured?.presenca_engajamento ?? "—"}/5</span>
                  <span>
                    Comportamentos-alvo:{" "}
                    {structured?.comportamentos?.length
                      ? structured.comportamentos.map((c) => behaviorLabel(c.tipo)).join(", ")
                      : "nenhum registrado"}
                  </span>
                  <span>
                    Orientações à família:{" "}
                    {structured?.orientacoes?.length
                      ? structured.orientacoes.map(orientationLabel).join(", ")
                      : "nenhuma registrada"}
                  </span>
                  {v.free_text && <span className="whitespace-pre-wrap">{v.free_text}</span>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
