"use server";

// Ocupação de um slot de psicoterapia em grupo — usado pelo diálogo "Nova
// sessão" (app/recepcao/nova-sessao-dialog.tsx) pra mostrar "2/3 — Ana (7a),
// Bia (8a)" e desabilitar o botão de agendar ANTES de bater no guard do
// banco (trigger `appointments_group_capacity_guard`,
// 20260917170400_group_psychotherapy_guard.sql, que continua sendo a
// autoridade final contra condição de corrida entre dois cliques
// simultâneos).

import { createClient } from "@/lib/supabase/server";

export type GroupSlotOccupancy = {
  occupied: number;
  maxSize: number;
  minBirth: string | null;
  maxBirth: string | null;
  patientNames: string[];
};

export async function getGroupSlotOccupancy(
  therapistId: string,
  startsAtIso: string,
  endsAtIso: string,
): Promise<{ success: true; data: GroupSlotOccupancy } | { success: false; error: string }> {
  if (!therapistId || !startsAtIso || !endsAtIso) {
    return { success: false, error: "Selecione terapeuta, data e horário para ver a ocupação do grupo." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("group_slot_occupancy", {
    p_therapist_id: therapistId,
    p_starts_at: startsAtIso,
    p_ends_at: endsAtIso,
  });

  if (error) {
    return { success: false, error: "Não foi possível consultar a ocupação do grupo." };
  }

  const row = (data ?? [])[0];
  if (!row) {
    return { success: true, data: { occupied: 0, maxSize: 3, minBirth: null, maxBirth: null, patientNames: [] } };
  }

  return {
    success: true,
    data: {
      occupied: row.occupied ?? 0,
      maxSize: row.max_size ?? 3,
      minBirth: row.min_birth,
      maxBirth: row.max_birth,
      patientNames: row.patient_names ?? [],
    },
  };
}
