import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PatientIdentityBar } from "@/components/patient-identity-bar";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { getPatientIdentitySummary } from "@/lib/patient-identity";
import { getProgramsForAppointment } from "@/lib/trial-data";
import { EvolutionForm, type EditingContext } from "./evolution-form";
import { TrialDataPanel } from "./trial-data-panel";
import type { SessionNoteStructured } from "@/lib/session-note-fields";

export default async function EvolucaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ appointmentId: string }>;
  searchParams: Promise<{ editar?: string }>;
}) {
  const { appointmentId } = await params;
  const { editar } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, signature_pin_hash")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/");

  // A RLS de `appointments` (appointments_read) já garante que um terapeuta
  // só enxerga sessões onde therapist_id = auth.uid() — se a sessão for de
  // outro terapeuta, a query abaixo simplesmente não retorna linha (não é
  // preciso filtrar manualmente por therapist_id aqui).
  const { data: appointment } = await supabase
    .from("appointments")
    .select(
      "id, patient_id, starts_at, ends_at, discipline, status, therapist_id, attendance_started_at, patients(full_name), profiles!therapist_id(full_name)",
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) notFound();

  const { insurance, emergencyContact } = await getPatientIdentitySummary(
    supabase,
    appointment.patient_id,
  );

  const { data: existingNote } = await supabase
    .from("session_notes")
    .select("id, version, signed_at, structured, free_text")
    .eq("appointment_id", appointmentId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const patientName = (appointment.patients as { full_name: string } | null)?.full_name ?? "";
  const therapistName =
    (appointment.profiles as { full_name: string } | null)?.full_name ?? "";

  // Só o terapeuta dono da sessão assina a evolução. Gestor/supervisor
  // enxergam a sessão (RLS permite leitura ampla), mas não veem o
  // formulário de assinatura — só quem está com a sessão vinculada.
  const canSign = profile.role === "terapeuta" && appointment.therapist_id === user.id;

  // Quem pode editar (criar nova versão) espelha exatamente a RLS de
  // session_notes_insert: o terapeuta dono da sessão, ou um supervisor.
  const canEdit = canSign || profile.role === "supervisor";

  // coleta ABA: programas do plano aprovado do paciente, pra registrar
  // tentativas discretas durante a sessão.
  const programs = canSign
    ? await getProgramsForAppointment(supabase, appointmentId, appointment.patient_id)
    : [];

  const sessionTime = new Date(appointment.starts_at).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CLINIC_TIMEZONE,
  });

  if (canSign && appointment.status === "realizada" && !existingNote) {
    return (
      <main className="flex flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6 p-5 sm:p-10">
          <TrialDataPanel appointmentId={appointment.id} programs={programs} />
          <EvolutionForm
            appointmentId={appointment.id}
            patientName={patientName}
            discipline={appointment.discipline}
            sessionTime={sessionTime}
            attendanceStartedAt={appointment.attendance_started_at}
            pinConfigured={!!profile.signature_pin_hash}
          />
        </div>
      </main>
    );
  }

  if (canEdit && existingNote && editar === "1") {
    const structured = existingNote.structured as SessionNoteStructured | null;
    const initialBehaviors: Record<string, boolean> = {};
    const initialIntensities: Record<string, string> = {};
    for (const c of structured?.comportamentos ?? []) {
      initialBehaviors[c.tipo] = true;
      initialIntensities[c.tipo] = c.intensidade;
    }
    const initialOrientations: Record<string, boolean> = {};
    for (const o of structured?.orientacoes ?? []) {
      initialOrientations[o] = true;
    }
    const editing: EditingContext = {
      previousVersion: existingNote.version,
      initialPresence: structured?.presenca_engajamento ?? null,
      initialBehaviors,
      initialIntensities,
      initialOrientations,
      initialFreeText: existingNote.free_text ?? "",
    };

    return (
      <main className="flex flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6 p-5 sm:p-10">
          <EvolutionForm
            appointmentId={appointment.id}
            patientName={patientName}
            discipline={appointment.discipline}
            sessionTime={sessionTime}
            attendanceStartedAt={appointment.attendance_started_at}
            editing={editing}
            pinConfigured={!!profile.signature_pin_hash}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <header
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        className="flex flex-col gap-2.5 px-5 pb-4 pt-7 sm:px-10"
      >
        <Link href="/terapeuta" className="text-[13px] no-underline opacity-80" style={{ color: "inherit" }}>
          ← Hoje
        </Link>
        <div>
          <div className="text-xs opacity-70">
            Evolução · {appointment.discipline} · {sessionTime}
          </div>
          <h1
            style={{ fontFamily: "var(--font-heading)" }}
            className="m-0 text-2xl font-semibold leading-tight text-inherit"
          >
            {patientName}
          </h1>
          <div className="text-xs opacity-70">{therapistName}</div>
        </div>
      </header>
      <PatientIdentityBar patientName={patientName} insurance={insurance} emergencyContact={emergencyContact} />
      <div className="mx-auto w-full max-w-[640px] p-5 sm:p-10">
        {appointment.status !== "realizada" ? (
          <div className="card">
            <span className="tag-status st-cancelada w-fit">Não realizada</span>
            <p className="text-sm text-ink-soft">
              Esta sessão ainda não foi realizada — não é possível registrar evolução.
            </p>
          </div>
        ) : existingNote ? (
          <div className="card">
            <span className="tag-status st-realizada w-fit">
              Evolução assinada{existingNote.version > 1 ? ` · versão ${existingNote.version}` : ""}
            </span>
            <p className="text-sm text-ink-soft">
              Assinada em{" "}
              {existingNote.signed_at
                ? new Date(existingNote.signed_at).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE })
                : "—"}
              .
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/terapeuta/paciente/${appointment.patient_id}/relatorio`} className="btn btn-secondary w-fit">
                Relatório devolutivo (IA)
              </Link>
              <Link href={`/terapeuta/paciente/${appointment.patient_id}/metricas`} className="btn btn-secondary w-fit">
                Evolução (gráficos)
              </Link>
              <Link href={`/terapeuta/paciente/${appointment.patient_id}/avaliacao`} className="btn btn-secondary w-fit">
                Avaliação de protocolo
              </Link>
              <Link href={`/terapeuta/paciente/${appointment.patient_id}/fono`} className="btn btn-secondary w-fit">
                Fono (ADL/ADL-2/PROC)
              </Link>
              {canEdit && (
                <Link href={`/terapeuta/evolucao/${appointment.id}?editar=1`} className="btn btn-secondary w-fit">
                  Editar evolução (nova versão)
                </Link>
              )}
              {(canEdit || profile.role === "gestor") && (
                <Link href={`/terapeuta/evolucao/${appointment.id}/historico`} className="btn btn-secondary w-fit">
                  Ver histórico
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="card">
            <span className="tag-status st-agendada w-fit">Pendente</span>
            <p className="text-sm text-ink-soft">
              Evolução pendente — só {therapistName || "o terapeuta responsável"} pode assiná-la.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
