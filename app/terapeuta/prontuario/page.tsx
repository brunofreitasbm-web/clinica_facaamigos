import { redirect } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import { History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { logRecordAccess } from "@/lib/record-access-log";
import { getPatientTimeline, fmt } from "@/lib/patient-timeline";
import { PageHeader } from "@/components/page-header";
import { AuditoriaPanel } from "./auditoria-panel";

export const dynamic = "force-dynamic";

/**
 * Prontuário Unificado & Auditoria do portal do terapeuta. Deliberadamente
 * NÃO é /supervisao/prontuario-unificado liberado pro papel terapeuta: aquela
 * tela lista todos os pacientes da clínica (não é o que o terapeuta deve
 * ver) e tem layout desktop. Aqui a lista é escopada por patient_access
 * (mesma query de app/terapeuta/pacientes/page.tsx) e o layout é mobile-first.
 */
export default async function TerapeutaProntuarioPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; q?: string }>;
}) {
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

  const canChooseTherapist = profile?.role === "gestor" || profile?.role === "supervisor";
  if (!profile || (profile.role !== "terapeuta" && !canChooseTherapist)) {
    redirect("/");
  }

  const therapistId = profile.id;
  const { p: selectedPatientId, q } = await searchParams;

  // Mesma query de app/terapeuta/pacientes/page.tsx — nunca a lista da
  // clínica inteira (essa é a diferença deliberada em relação à tela de
  // supervisão).
  const { data: access } = await supabase
    .from("patient_access")
    .select("patient_id, patients(id, full_name, status)")
    .eq("profile_id", therapistId)
    .eq("access_type", "terapeuta")
    .is("revoked_at", null);

  let patients = (access ?? [])
    .map((a) => (Array.isArray(a.patients) ? a.patients[0] : a.patients))
    .filter((p): p is { id: string; full_name: string; status: string } => !!p)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  if (q && q.trim()) {
    const needle = q.trim().toLowerCase();
    patients = patients.filter((p) => p.full_name.toLowerCase().includes(needle));
  }

  const selectedPatient = selectedPatientId ? patients.find((p) => p.id === selectedPatientId) ?? null : null;

  let timelineResult: Awaited<ReturnType<typeof getPatientTimeline>> | null = null;
  let accessTrail: { accessed_at: string; accessor_name: string; accessor_role: string; reason: string }[] | null = null;

  if (selectedPatient) {
    await logRecordAccess(supabase, selectedPatient.id, "prontuario_terapeuta");

    const [timeline, trailRes] = await Promise.all([
      getPatientTimeline(supabase, selectedPatient.id),
      supabase.rpc("patient_record_access_trail", { p_patient_id: selectedPatient.id, p_days: 30 }),
    ]);
    timelineResult = timeline;
    accessTrail = trailRes.data ?? null;
  }

  return (
    <main className="flex flex-1 flex-col pb-24 md:pb-0">
      <PageHeader
        axisLabel="Terapeuta"
        title="Prontuário & Auditoria"
        description="Histórico unificado e trilha de acesso dos seus pacientes."
      />

      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-6 px-5 sm:max-w-[1100px] sm:px-10">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[280px_1fr]">
          {/* No mobile: lista ocupa a tela até um paciente ser escolhido, e
              colapsa num chip "trocar paciente" depois. No desktop (sm+): as
              duas colunas ficam lado a lado sempre. */}
          <div className={selectedPatient ? "hidden sm:block" : "block"}>
            <div className="rounded-xl border p-4 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
              <h4 className="mb-3">Meus pacientes</h4>
              <form method="get" className="relative mb-3">
                <Search className="absolute left-3 top-2.5 text-ink-faint" size={16} />
                <input type="text" name="q" defaultValue={q ?? ""} placeholder="Buscar por nome..." className="input pl-9 text-sm" />
              </form>
              <div className="flex flex-col gap-2">
                {patients.length === 0 && <p className="text-sm text-ink-faint">Nenhum paciente vinculado a você ainda.</p>}
                {patients.map((pt) => {
                  const isActive = selectedPatient?.id === pt.id;
                  return (
                    <Link
                      key={pt.id}
                      href={`/terapeuta/prontuario?p=${pt.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                      aria-selected={isActive}
                      className={`block rounded-lg border p-3 text-left text-sm no-underline transition-all ${
                        isActive ? "font-semibold" : "border-neutral-200 hover:bg-neutral-50"
                      }`}
                      style={
                        isActive
                          ? { borderColor: "var(--color-neutral-200)", borderLeft: "4px solid var(--color-accent)", background: "var(--color-accent-100)" }
                          : undefined
                      }
                    >
                      {pt.full_name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {!selectedPatient ? (
              <div className="hidden rounded-xl border p-8 text-center text-base text-ink-faint sm:block" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
                Selecione um paciente à esquerda para ver o histórico unificado.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 sm:hidden">
                  <span className="text-base font-semibold text-ink">{selectedPatient.full_name}</span>
                  <Link href="/terapeuta/prontuario" className="btn btn-ghost text-sm">
                    Trocar paciente
                  </Link>
                </div>

                <AuditoriaPanel
                  patientId={selectedPatient.id}
                  signedNotesCount={timelineResult?.signedNotesCount ?? 0}
                  totalNotesCount={timelineResult?.totalNotesCount ?? 0}
                  versionedNotesCount={timelineResult?.versionedNotesCount ?? 0}
                  accessTrail={accessTrail}
                />

                <div className="rounded-xl border p-5 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
                  <h5 className="mb-4 flex items-center gap-2" style={{ color: "var(--color-accent-2-600)" }}>
                    <History size={16} /> Histórico unificado
                  </h5>

                  {(timelineResult?.timeline.length ?? 0) === 0 ? (
                    <p className="text-base text-ink-faint">Nenhum registro clínico encontrado para este paciente ainda.</p>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {timelineResult!.timeline.map((item) => (
                        <div key={item.id} className="rounded-lg border p-3.5 bg-neutral-50/50" style={{ borderColor: "var(--color-neutral-200)" }}>
                          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                            <span className="text-base font-bold">{item.type}</span>
                            <span className="tabular-figure text-sm text-ink-faint">{fmt(item.date)}</span>
                          </div>
                          <div className="mb-2 text-sm font-medium text-amber-800">{item.author}</div>
                          <p className="mb-2 text-sm text-ink-soft">{item.summary}</p>
                          <div className="flex items-center justify-between border-t pt-2 text-[11px] text-ink-faint" style={{ borderColor: "var(--color-neutral-200)" }}>
                            <span>{item.detail}</span>
                            {item.appointmentId && (
                              <Link
                                href={`/terapeuta/evolucao/${item.appointmentId}`}
                                className="font-semibold text-accent hover:underline"
                              >
                                Ver evolução →
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
