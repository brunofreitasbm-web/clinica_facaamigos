import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { ProfissionaisManager } from "./profissionais-manager";
import type { TherapistRow, ContractRow } from "./types";

export const dynamic = "force-dynamic";

/**
 * Cadastro de Honorário por Módulo Assistencial por terapeuta
 * (`therapist_contracts`, tabela real desde 20260904000001_core_identity.sql,
 * estendida em 20260910090000 pra pagamento por módulo em vez de hora —
 * cláusula 6ª do contrato-quadro PJ–PJ). Não existia tela nenhuma pra
 * gerenciar isso — a única versão anterior desta página (removida) era um
 * formulário com tiers inventados, sem nenhuma tabela por trás. O repasse
 * mensal (app/faturamento/repasses, close_monthly_payouts_for_month) lê
 * `module_price`/`attendances_per_module`/`doc_deadline_days`/
 * `noshow_compensation_pct` daqui; sem contrato cadastrado, o terapeuta não
 * recebe repasse nenhum.
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
        .select(
          "id, profile_id, tier, module_price, attendances_per_module, doc_deadline_days, noshow_compensation_pct, valid_from, valid_to",
        )
        .in("profile_id", therapistIds)
        .not("module_price", "is", null)
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
          modulePrice: Number(c.module_price),
          attendancesPerModule: c.attendances_per_module,
          docDeadlineDays: c.doc_deadline_days,
          noshowCompensationPct: Number(c.noshow_compensation_pct),
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
