import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { ProfissionaisManager } from "./profissionais-manager";
import type { TherapistRow, ContractRow } from "./types";

export const dynamic = "force-dynamic";

/**
 * Cadastro de valor-hora por terapeuta (`therapist_contracts`, tabela real
 * desde 20260904000001_core_identity.sql). Não existia tela nenhuma pra
 * gerenciar isso — a única versão anterior desta página (removida) era um
 * formulário com tiers inventados, sem nenhuma tabela por trás. O repasse
 * mensal (app/faturamento/repasses, close_monthly_payouts) lê `hourly_rate`
 * daqui; sem contrato cadastrado, o terapeuta não recebe repasse nenhum.
 */
export default async function ProfissionaisConfigPage() {
  const supabase = await createClient();

  const { data: therapists } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("role", "terapeuta")
    .eq("active", true)
    .order("full_name");

  const therapistIds = (therapists ?? []).map((t) => t.id);

  const { data: contracts } = therapistIds.length
    ? await supabase
        .from("therapist_contracts")
        .select("id, profile_id, tier, hourly_rate, valid_from, valid_to")
        .in("profile_id", therapistIds)
        .order("valid_from", { ascending: false })
    : { data: [] };

  const today = new Date().toISOString().slice(0, 10);

  const rows: TherapistRow[] = (therapists ?? []).map((t) => {
    const own = (contracts ?? [])
      .filter((c) => c.profile_id === t.id)
      .map(
        (c): ContractRow => ({
          id: c.id,
          tier: c.tier,
          hourlyRate: Number(c.hourly_rate),
          validFrom: c.valid_from,
          validTo: c.valid_to,
        }),
      );

    const current = own.find((c) => c.validFrom <= today && (!c.validTo || c.validTo >= today)) ?? null;
    const history = own.filter((c) => c.id !== current?.id);

    return { id: t.id, fullName: t.full_name, current, history };
  });

  return <ProfissionaisManager therapists={rows} />;
}
