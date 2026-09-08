import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { PROTOCOL_LABEL as CATALOG_PROTOCOL_LABEL, AREA_LABEL } from "@/lib/protocol-catalog";

type Supa = SupabaseClient<Database>;

export type ProtocolRow = {
  id: string;
  name: string;
  area: string | null;
  version: string | null;
  licensePurchasedAtLabel: string;
  riskAcceptedLabel: string;
  itemCount: number;
};

// Reexportado do catálogo compartilhado (lib/protocol-catalog.ts) — desde a
// migration 20260906000005 `protocols.name` não tem mais CHECK fixo em 3
// valores, então este mapa cobre a lista de protocolos do Módulo 3 MAAIS
// (slide 25), não só os 3 originais.
export const PROTOCOL_LABEL = CATALOG_PROTOCOL_LABEL;

export async function getProtocolRows(supabase: Supa, clinicId: string): Promise<ProtocolRow[]> {
  const { data: protocols } = await supabase
    .from("protocols")
    .select("id, name, area, version, license_purchased_at, digitization_risk_accepted_at, digitization_risk_accepted_by")
    .eq("clinic_id", clinicId)
    .order("name");
  const list = protocols ?? [];
  if (list.length === 0) return [];

  const acceptedByIds = [...new Set(list.map((p) => p.digitization_risk_accepted_by))];
  const { data: acceptedByProfiles } = await supabase.from("profiles").select("id, full_name").in("id", acceptedByIds);
  const nameById = new Map((acceptedByProfiles ?? []).map((p) => [p.id, p.full_name]));

  const ids = list.map((p) => p.id);
  const { data: items } = await supabase.from("protocol_items").select("protocol_id").in("protocol_id", ids);
  const itemCountByProtocol = new Map<string, number>();
  for (const i of items ?? []) itemCountByProtocol.set(i.protocol_id, (itemCountByProtocol.get(i.protocol_id) ?? 0) + 1);

  return list.map((p) => ({
    id: p.id,
    name: PROTOCOL_LABEL[p.name] ?? p.name,
    area: p.area ? (AREA_LABEL[p.area] ?? p.area) : null,
    version: p.version,
    licensePurchasedAtLabel: p.license_purchased_at ? new Date(`${p.license_purchased_at}T00:00:00`).toLocaleDateString("pt-BR") : "—",
    riskAcceptedLabel: `${nameById.get(p.digitization_risk_accepted_by) ?? "—"} · ${new Date(p.digitization_risk_accepted_at).toLocaleDateString("pt-BR")}`,
    itemCount: itemCountByProtocol.get(p.id) ?? 0,
  }));
}

export type PatientRow = {
  id: string;
  name: string;
  guardianName: string;
  birthDateLabel: string;
  insurerName: string;
  primaryTherapistName: string;
  status: string;
};

export async function getPatientRows(supabase: Supa, clinicId: string): Promise<PatientRow[]> {
  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name, birth_date, status")
    .eq("clinic_id", clinicId)
    .order("full_name");
  const list = patients ?? [];
  if (list.length === 0) return [];
  const ids = list.map((p) => p.id);

  const [{ data: guardians }, { data: insuranceRows }, { data: accessRows }] = await Promise.all([
    supabase.from("guardians").select("patient_id, full_name, is_financial").in("patient_id", ids),
    supabase.from("patient_insurance").select("patient_id, is_private, insurers(name)").in("patient_id", ids),
    supabase
      .from("patient_access")
      .select("patient_id, profiles!profile_id(full_name)")
      .in("patient_id", ids)
      .eq("access_type", "terapeuta")
      .is("revoked_at", null),
  ]);

  const guardianByPatient = new Map<string, string>();
  for (const g of guardians ?? []) {
    const existing = guardianByPatient.get(g.patient_id);
    if (!existing || g.is_financial) guardianByPatient.set(g.patient_id, g.full_name);
  }

  const insurerByPatient = new Map<string, string>();
  for (const row of insuranceRows ?? []) {
    if (insurerByPatient.has(row.patient_id)) continue;
    const insurerName = Array.isArray(row.insurers) ? row.insurers[0]?.name : row.insurers?.name;
    insurerByPatient.set(row.patient_id, row.is_private ? "Particular" : (insurerName ?? "Convênio"));
  }

  const therapistByPatient = new Map<string, string>();
  for (const a of accessRows ?? []) {
    if (therapistByPatient.has(a.patient_id)) continue;
    const name = Array.isArray(a.profiles) ? a.profiles[0]?.full_name : a.profiles?.full_name;
    if (name) therapistByPatient.set(a.patient_id, name);
  }

  return list.map((p) => ({
    id: p.id,
    name: p.full_name,
    guardianName: guardianByPatient.get(p.id) ?? "—",
    birthDateLabel: new Date(`${p.birth_date}T00:00:00`).toLocaleDateString("pt-BR"),
    insurerName: insurerByPatient.get(p.id) ?? "Particular",
    primaryTherapistName: therapistByPatient.get(p.id) ?? "—",
    status: p.status,
  }));
}
