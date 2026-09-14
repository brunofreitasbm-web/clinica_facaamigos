import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/page-container";
import { DEV_CLINIC_ID } from "@/lib/constants";

export const dynamic = "force-dynamic";

type PatientRow = { id: string; fullName: string; hasSchool: boolean; sessionCount: number };

export default async function AtPatientsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .maybeSingle();

  const isOversight = profile?.role === "gestor" || profile?.role === "supervisor";

  // Terapeuta de AT vê só os pacientes que tem vínculo ativo (patient_access);
  // gestor/supervisor acompanham todos os pacientes da clínica com algum
  // registro de AT — RLS de at_sessions/external_contacts já limita o que
  // cada papel pode ler, esta query só decide o que listar na tela.
  let patientIds: string[] = [];
  if (isOversight) {
    const { data } = await supabase.from("patients").select("id").eq("clinic_id", DEV_CLINIC_ID);
    patientIds = (data ?? []).map((p) => p.id);
  } else {
    const { data } = await supabase
      .from("patient_access")
      .select("patient_id")
      .eq("profile_id", user!.id)
      .eq("access_type", "terapeuta")
      .is("revoked_at", null);
    patientIds = [...new Set((data ?? []).map((a) => a.patient_id))];
  }

  let patients: PatientRow[] = [];
  if (patientIds.length > 0) {
    const [{ data: patientRows }, { data: schoolRows }, { data: sessionRows }] = await Promise.all([
      supabase.from("patients").select("id, full_name").in("id", patientIds).order("full_name"),
      supabase.from("external_contacts").select("patient_id").eq("kind", "escola").in("patient_id", patientIds),
      supabase.from("at_sessions").select("patient_id").in("patient_id", patientIds),
    ]);

    const schoolByPatient = new Set((schoolRows ?? []).map((r) => r.patient_id));
    const sessionCountByPatient = new Map<string, number>();
    for (const s of sessionRows ?? []) {
      sessionCountByPatient.set(s.patient_id, (sessionCountByPatient.get(s.patient_id) ?? 0) + 1);
    }

    patients = (patientRows ?? []).map((p) => ({
      id: p.id,
      fullName: p.full_name,
      hasSchool: schoolByPatient.has(p.id),
      sessionCount: sessionCountByPatient.get(p.id) ?? 0,
    }));
  }

  return (
    <div className="flex flex-1">
      <PageContainer>
        <h1 className="mb-1">Acompanhamento Terapêutico</h1>
        <p className="mb-6 text-sm text-ink-soft">
          Pacientes em atendimento de AT em campo — escola, domicílio ou comunidade. Abra um
          paciente para cadastrar a escola, registrar reunião de visita escolar, registrar sessão
          em campo, orientar professores ou emitir o relatório para a escola.
        </p>

        <table className="table">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Escola cadastrada</th>
              <th>Sessões de AT registradas</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p.id}>
                <td>{p.fullName}</td>
                <td className={p.hasSchool ? "" : "text-ink-faint"}>{p.hasSchool ? "Sim" : "Não cadastrada"}</td>
                <td className="tabular-nums">{p.sessionCount}</td>
                <td className="text-right">
                  <Link href={`/at/pacientes/${p.id}`} className="btn btn-ghost text-xs">
                    Abrir
                  </Link>
                </td>
              </tr>
            ))}
            {patients.length === 0 && (
              <tr>
                <td colSpan={4} className="text-ink-faint">
                  Nenhum paciente vinculado a você em Acompanhamento Terapêutico ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </PageContainer>
    </div>
  );
}
