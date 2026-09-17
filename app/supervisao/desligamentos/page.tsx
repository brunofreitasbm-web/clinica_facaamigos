import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { PageContainer } from "@/components/page-container";

export const dynamic = "force-dynamic";

/**
 * Lista de pacientes desligados automaticamente por 2 faltas consecutivas
 * sem justificativa aprovada (FASE 5 — apply_auto_discharge, ver
 * supabase/migrations/20260917170500_auto_discharge_consecutive_faltas.sql).
 * Cada linha leva pra ficha de gestão do paciente, onde vive o painel de
 * detalhe + reativação (app/recepcao/pacientes/[id]/gestao/discharge-panel.tsx).
 */
export default async function DesligamentosPage() {
  const supabase = await createClient();

  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name, discharged_at, discharge_reason")
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("discharged_auto", true)
    .order("discharged_at", { ascending: false });

  return (
    <PageContainer>
      <div>
        <h1 style={{ fontFamily: "var(--font-heading)" }} className="text-xl font-semibold text-ink">
          Desligamentos automáticos
        </h1>
        <p className="text-sm text-ink-soft">
          Pacientes desligados automaticamente por 2 faltas consecutivas sem justificativa aprovada.
        </p>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Paciente</th>
            <th>Desligado em</th>
            <th>Motivo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(patients ?? []).map((p) => (
            <tr key={p.id}>
              <td className="font-semibold">{p.full_name}</td>
              <td>{fmtDateTime(p.discharged_at, CLINIC_TIMEZONE)}</td>
              <td>{p.discharge_reason ?? "—"}</td>
              <td className="text-right">
                <Link href={`/recepcao/pacientes/${p.id}/gestao`} className="btn btn-secondary text-xs">
                  Ver / reativar
                </Link>
              </td>
            </tr>
          ))}
          {(patients ?? []).length === 0 && (
            <tr>
              <td colSpan={4} className="text-ink-faint">
                Nenhum desligamento automático registrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </PageContainer>
  );
}
