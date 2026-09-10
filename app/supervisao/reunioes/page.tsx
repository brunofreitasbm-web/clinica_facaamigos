import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE, DEV_CLINIC_ID } from "@/lib/constants";
import { PageContainer } from "@/components/page-container";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  interdisciplinar: "Reunião técnica multidisciplinar",
  devolutiva: "Devolutiva à família",
  revisao_pts: "Revisão do PTS",
  visita_escolar: "Visita escolar",
};

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function ReunioesPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("meetings")
    .select("id, patient_id, kind, held_at, minutes, family_present, patients!inner(full_name, clinic_id), profiles!conducted_by(full_name)")
    .eq("patients.clinic_id", DEV_CLINIC_ID)
    .order("held_at", { ascending: false })
    .limit(50);

  return (
    <main className="flex flex-1 flex-col">
      <PageContainer>
      <div>
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
          Supervisão
        </h6>
        <h1 className="m-0">Reuniões registradas</h1>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Paciente</th>
            <th>Tipo</th>
            <th>Data</th>
            <th>Conduzida por</th>
            <th>Família presente</th>
            <th>Resumo</th>
          </tr>
        </thead>
        <tbody>
          {(rows ?? []).map((r) => {
            const patient = Array.isArray(r.patients) ? r.patients[0] : r.patients;
            const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
            return (
              <tr key={r.id}>
                <td>
                  <Link href={`/recepcao/pacientes/${r.patient_id}`}>{patient?.full_name ?? "—"}</Link>
                </td>
                <td>{KIND_LABEL[r.kind] ?? r.kind}</td>
                <td>{fmtDateTime(r.held_at)}</td>
                <td>{profile?.full_name ?? "—"}</td>
                <td>{r.family_present ? "Sim" : "Não"}</td>
                <td className="max-w-[360px] truncate">{r.minutes}</td>
              </tr>
            );
          })}
          {(rows ?? []).length === 0 && (
            <tr>
              <td colSpan={6} className="text-ink-faint">
                Nenhuma reunião registrada ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </PageContainer>
    </main>
  );
}
