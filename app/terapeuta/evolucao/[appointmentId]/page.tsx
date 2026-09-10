import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PatientIdentityBar } from "@/components/patient-identity-bar";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { getPatientIdentitySummary } from "@/lib/patient-identity";
import { getProgramsForAppointment } from "@/lib/trial-data";
import { getActiveGoalsForPatient, getPreviousSessionMetaIds } from "@/lib/session-note-goals";
import { getBehaviorCatalog } from "@/lib/behavior-catalog";
import { getInterventionCatalog } from "@/lib/intervention-catalog";
import { PROTOCOL_LABEL, getEnabledProtocolsForClinic } from "@/lib/protocol-catalog";
import { getEnabledInstrumentKeys } from "@/lib/clinic-instruments";
import type { NativeInstrumentKey } from "@/lib/native-instruments";
import { EvolutionForm, type EditingContext } from "./evolution-form";
import { TrialDataPanel } from "./trial-data-panel";
import { getMetasTrabalhadas, type GoalResultLevel, type SessionNoteStructured } from "@/lib/session-note-fields";

export default async function EvolucaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ appointmentId: string }>;
  searchParams: Promise<{ editar?: string; voltar?: string; date?: string }>;
}) {
  const { appointmentId } = await params;
  const { editar, voltar, date } = await searchParams;
  const supabase = await createClient();

  // Vindo da agenda (?voltar=agenda&date=), o "← voltar" retorna pra lá em
  // vez de forçar uma parada na ficha do paciente — ver plano "evolução
  // mobile", assimetria do back-link.
  const agendaBackHref = voltar === "agenda" ? `/terapeuta/agenda?view=dia${date ? `&date=${date}` : ""}` : null;

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

  // A RLS de `appointments` (appointments_read) permite que qualquer
  // terapeuta da clínica leia qualquer sessão (não só as suas), pra que
  // qualquer terapeuta possa abrir e assinar a evolução de um colega.
  const { data: appointment } = await supabase
    .from("appointments")
    .select(
      "id, patient_id, starts_at, ends_at, discipline, status, therapist_id, attendance_started_at, patients(full_name, clinic_id), profiles!therapist_id(full_name)",
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

  const patientRecord = appointment.patients as { full_name: string; clinic_id: string } | null;
  const patientName = patientRecord?.full_name ?? "";
  const therapistName =
    (appointment.profiles as { full_name: string } | null)?.full_name ?? "";

  // Qualquer terapeuta da clínica pode assinar a evolução, não só o dono
  // original da sessão (RLS de appointments_read/session_notes_insert
  // espelha a mesma regra — ver migração 20260907_open_session_note_signing).
  const canSign = profile.role === "terapeuta" || profile.role === "gestor";

  // Quem pode editar (criar nova versão) espelha a permissão do terapeuta, supervisor e gestor.
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

  const enabledProtocols = patientRecord
    ? await getEnabledProtocolsForClinic(supabase, patientRecord.clinic_id)
    : [];

  if (canSign && appointment.status === "realizada" && !existingNote) {
    // Metas trabalhadas (PRD §9.4): checkbox das metas ativas do plano
    // aprovado, pré-marcadas com as da sessão anterior; e catálogo de
    // comportamentos configurável pelo supervisor (behavior_catalog).
    // Consentimento de imagem via patient_contact_summary — mesma RPC que
    // alimenta a barra de identidade acima, "nenhum guardian com
    // image_consent=false" (o trigger no INSERT em session_note_media
    // reforça a mesma regra, esta é só a UI condicional).
    const [activeGoals, preCheckedGoalIds, behaviorCatalog, interventionCatalog, contacts, enabledInstruments] =
      await Promise.all([
        getActiveGoalsForPatient(supabase, appointment.patient_id),
        getPreviousSessionMetaIds(supabase, appointment.patient_id, appointmentId),
        getBehaviorCatalog(supabase, { activeOnly: true }),
        getInterventionCatalog(supabase, { activeOnly: true }),
        supabase.rpc("patient_contact_summary", { p_patient_id: appointment.patient_id }),
        patientRecord ? getEnabledInstrumentKeys(supabase, patientRecord.clinic_id) : Promise.resolve(new Set<NativeInstrumentKey>()),
      ]);
    const imageConsent = (contacts.data ?? []).every((g) => g.image_consent !== false);
    const showFono = ["adl", "adl2", "proc"].some((key) => enabledInstruments.has(key as NativeInstrumentKey));
    const showSociallySavvy = enabledInstruments.has("socially_savvy");

    return (
      <main className="flex flex-1 flex-col">
        <EvolutionForm
          appointmentId={appointment.id}
          patientId={appointment.patient_id}
          patientName={patientName}
          discipline={appointment.discipline}
          sessionTime={sessionTime}
          attendanceStartedAt={appointment.attendance_started_at}
          pinConfigured={!!profile.signature_pin_hash}
          activeGoals={activeGoals}
          preCheckedGoalIds={preCheckedGoalIds}
          behaviorTypes={behaviorCatalog}
          interventionCatalog={interventionCatalog}
          imageConsent={imageConsent}
          backHref={agendaBackHref ?? undefined}
          topContent={
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Instrumentos de Avaliação
                </h3>
                <div className="flex flex-wrap gap-2">
                  {enabledProtocols.map((protocol) => (
                    <Link
                      key={protocol.name}
                      href={`/terapeuta/paciente/${appointment.patient_id}/avaliacao?protocolo=${protocol.name}`}
                      className="btn btn-secondary w-fit text-sm"
                    >
                      📋 {PROTOCOL_LABEL[protocol.name] ?? protocol.displayName}
                    </Link>
                  ))}
                  {showFono && (
                    <Link href={`/terapeuta/paciente/${appointment.patient_id}/fono`} className="btn btn-secondary w-fit text-sm">
                      🗣️ Fono (ADL/ADL-2/PROC)
                    </Link>
                  )}
                  {showSociallySavvy && (
                    <Link
                      href={`/terapeuta/paciente/${appointment.patient_id}/socially-savvy`}
                      className="btn btn-secondary w-fit text-sm"
                    >
                      🤝 Socially Savvy
                    </Link>
                  )}
                </div>
              </div>
              <TrialDataPanel appointmentId={appointment.id} programs={programs} />
            </>
          }
        />
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
    const initialMetas: Record<string, GoalResultLevel> = {};
    for (const m of getMetasTrabalhadas(structured)) {
      initialMetas[m.plan_goal_id] = m.resultado;
    }
    const editing: EditingContext = {
      previousVersion: existingNote.version,
      initialPresence: structured?.presenca_engajamento ?? null,
      initialBehaviors,
      initialIntensities,
      initialOrientations,
      initialMetas,
      initialFreeText: existingNote.free_text ?? "",
    };

    const [activeGoals, behaviorCatalog, interventionCatalog, contacts] = await Promise.all([
      getActiveGoalsForPatient(supabase, appointment.patient_id),
      getBehaviorCatalog(supabase, { activeOnly: true }),
      getInterventionCatalog(supabase, { activeOnly: true }),
      supabase.rpc("patient_contact_summary", { p_patient_id: appointment.patient_id }),
    ]);
    const imageConsent = (contacts.data ?? []).every((g) => g.image_consent !== false);

    return (
      <main className="flex flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-[640px] md:max-w-[760px] flex-col gap-6 p-5 sm:p-10">
          <EvolutionForm
            appointmentId={appointment.id}
            patientId={appointment.patient_id}
            patientName={patientName}
            discipline={appointment.discipline}
            sessionTime={sessionTime}
            attendanceStartedAt={appointment.attendance_started_at}
            editing={editing}
            pinConfigured={!!profile.signature_pin_hash}
            activeGoals={activeGoals}
            preCheckedGoalIds={[]}
            behaviorTypes={behaviorCatalog}
            interventionCatalog={interventionCatalog}
            imageConsent={imageConsent}
            backHref={agendaBackHref ?? undefined}
          />
        </div>
      </main>
    );
  }

  const readOnlyBackHref = agendaBackHref ?? `/terapeuta/paciente/${appointment.patient_id}`;

  return (
    <main className="flex flex-1 flex-col pb-24 md:pb-0">
      <header
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        className="flex flex-col gap-2.5 px-5 pb-4 pt-7 sm:px-10"
      >
        <Link href={readOnlyBackHref} className="text-[13px] no-underline opacity-90 hover:opacity-100 transition font-medium" style={{ color: "inherit" }}>
          ← {agendaBackHref ? "Voltar para a agenda" : `Prontuário de ${patientName.split(" ")[0]}`}
        </Link>
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-white/20 px-2 py-0.5 text-sm font-bold text-white uppercase tracking-wider">
              {appointment.discipline}
            </span>
            <span className="rounded-md bg-white/15 px-2 py-0.5 text-sm font-medium text-white/90">
              {sessionTime}
            </span>
            {therapistName && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-normal text-white/80">
                {therapistName}
              </span>
            )}
          </div>
          <h1
            style={{ fontFamily: "var(--font-heading)" }}
            className="m-0 text-3xl font-bold leading-tight text-white drop-shadow-sm mt-0.5"
          >
            {patientName}
          </h1>
        </div>
      </header>
      <PatientIdentityBar patientName={patientName} insurance={insurance} emergencyContact={emergencyContact} />
      <div className="mx-auto w-full max-w-[640px] md:max-w-[760px] p-5 sm:p-10">
        {appointment.status !== "realizada" ? (
          <div className="card">
            <span className="tag-status st-cancelada w-fit">Não realizada</span>
            <p className="text-base text-ink-soft">
              Esta sessão ainda não foi realizada — não é possível registrar evolução.
            </p>
          </div>
        ) : existingNote ? (
          <div className="card">
            <span className="tag-status st-realizada w-fit">
              Evolução assinada{existingNote.version > 1 ? ` · versão ${existingNote.version}` : ""}
            </span>
            <p className="text-base text-ink-soft">
              Assinada em{" "}
              {existingNote.signed_at
                ? new Date(existingNote.signed_at).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE })
                : "—"}
              .
            </p>
            {/* 3 primários (mobile já cabe sem quebrar em ~9 linhas) + o
                resto (relatórios, gráficos, instrumentos) atrás de um
                <details> — mesmo gate de showFono/showSociallySavvy que a
                sessão nova usa (ver bloco canSign acima), só que aqui o
                catálogo de protocolo é sempre exibido porque a nota já foi
                assinada e pode ter havido avaliação em paralelo. */}
            <div className="flex flex-wrap gap-2">
              <Link href={`/terapeuta/paciente/${appointment.patient_id}`} className="btn btn-secondary w-fit">
                Ficha do paciente
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
            <details className="mt-1">
              <summary className="cursor-pointer text-sm font-semibold text-accent">Mais opções</summary>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link href={`/terapeuta/paciente/${appointment.patient_id}/relatorio`} className="btn btn-secondary w-fit text-sm">
                  Relatório devolutivo (IA)
                </Link>
                <Link href={`/terapeuta/paciente/${appointment.patient_id}/metricas`} className="btn btn-secondary w-fit text-sm">
                  Evolução (gráficos)
                </Link>
                {enabledProtocols.map((protocol) => (
                  <Link
                    key={protocol.name}
                    href={`/terapeuta/paciente/${appointment.patient_id}/avaliacao?protocolo=${protocol.name}`}
                    className="btn btn-secondary w-fit text-sm"
                  >
                    📋 {PROTOCOL_LABEL[protocol.name] ?? protocol.displayName}
                  </Link>
                ))}
                <Link href={`/terapeuta/paciente/${appointment.patient_id}/fono`} className="btn btn-secondary w-fit text-sm">
                  Fono (ADL/ADL-2/PROC)
                </Link>
              </div>
            </details>
          </div>
        ) : (
          <div className="card">
            <span className="tag-status st-agendada w-fit">Pendente</span>
            <p className="text-base text-ink-soft">
              Evolução pendente — só {therapistName || "o terapeuta responsável"} pode assiná-la.
            </p>
          </div>
        )}
      </div>

    </main>
  );
}
