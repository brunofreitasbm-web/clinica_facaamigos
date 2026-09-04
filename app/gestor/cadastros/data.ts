import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Supa = SupabaseClient<Database>;

export type TherapistRow = {
  id: string;
  name: string;
  discipline: string;
  tier: string;
  contractLabel: string;
  certifications: string;
  active: boolean;
};

export async function getTherapistRows(supabase: Supa, clinicId: string): Promise<TherapistRow[]> {
  const { data: therapists } = await supabase
    .from("profiles")
    .select("id, full_name, council_type, esdm_certified, active")
    .eq("clinic_id", clinicId)
    .eq("role", "terapeuta")
    .order("full_name");
  const list = therapists ?? [];
  if (list.length === 0) return [];

  const ids = list.map((t) => t.id);
  const { data: contracts } = await supabase
    .from("therapist_contracts")
    .select("profile_id, tier, hourly_rate, valid_from, valid_to")
    .in("profile_id", ids);
  const now = Date.now();
  const currentContractByTherapist = new Map<string, { tier: string; validFrom: string }>();
  for (const c of contracts ?? []) {
    const from = new Date(c.valid_from).getTime();
    const to = c.valid_to ? new Date(c.valid_to).getTime() : null;
    if (from <= now && (to == null || to >= now)) currentContractByTherapist.set(c.profile_id, { tier: c.tier, validFrom: c.valid_from });
  }

  return list.map((t) => {
    const contract = currentContractByTherapist.get(t.id);
    return {
      id: t.id,
      name: t.full_name,
      discipline: t.council_type ?? "—",
      tier: contract?.tier ?? "sem contrato vigente",
      contractLabel: contract ? `vigente desde ${new Date(contract.validFrom).toLocaleDateString("pt-BR")}` : "—",
      certifications: t.esdm_certified ? "ESDM certificado" : "—",
      active: t.active,
    };
  });
}

export type InsurerRow = {
  id: string;
  name: string;
  ansCode: string | null;
  hasCurrentPriceTable: boolean;
  priceCount: number;
  openGlosasCount: number;
};

export async function getInsurerRows(supabase: Supa, clinicId: string): Promise<InsurerRow[]> {
  const { data: insurers } = await supabase.from("insurers").select("id, name, ans_code").eq("clinic_id", clinicId).order("name");
  const list = insurers ?? [];
  if (list.length === 0) return [];
  const ids = list.map((i) => i.id);

  const { data: prices } = await supabase.from("insurer_price_tables").select("insurer_id, valid_to").in("insurer_id", ids);
  const priceCountByInsurer = new Map<string, number>();
  const currentPriceByInsurer = new Map<string, boolean>();
  const today = new Date().toISOString().slice(0, 10);
  for (const p of prices ?? []) {
    priceCountByInsurer.set(p.insurer_id, (priceCountByInsurer.get(p.insurer_id) ?? 0) + 1);
    if (p.valid_to == null || p.valid_to >= today) currentPriceByInsurer.set(p.insurer_id, true);
  }

  const { data: periods } = await supabase.from("billing_periods").select("id, insurer_id").in("insurer_id", ids);
  const periodIds = (periods ?? []).map((p) => p.id);
  const insurerByPeriod = new Map((periods ?? []).map((p) => [p.id, p.insurer_id]));
  const openGlosasByInsurer = new Map<string, number>();
  if (periodIds.length > 0) {
    const { data: items } = await supabase
      .from("billing_items")
      .select("id, billing_period_id, status")
      .in("billing_period_id", periodIds)
      .eq("status", "glosado");
    const itemIds = (items ?? []).map((i) => i.id);
    const insurerByItem = new Map((items ?? []).map((i) => [i.id, insurerByPeriod.get(i.billing_period_id)]));
    if (itemIds.length > 0) {
      const { data: glosas } = await supabase.from("glosas").select("billing_item_id").in("billing_item_id", itemIds);
      for (const g of glosas ?? []) {
        const insurerId = insurerByItem.get(g.billing_item_id);
        if (insurerId) openGlosasByInsurer.set(insurerId, (openGlosasByInsurer.get(insurerId) ?? 0) + 1);
      }
    }
  }

  return list.map((i) => ({
    id: i.id,
    name: i.name,
    ansCode: i.ans_code,
    hasCurrentPriceTable: currentPriceByInsurer.get(i.id) ?? false,
    priceCount: priceCountByInsurer.get(i.id) ?? 0,
    openGlosasCount: openGlosasByInsurer.get(i.id) ?? 0,
  }));
}

export type ProtocolRow = {
  id: string;
  name: string;
  version: string | null;
  licensePurchasedAtLabel: string;
  riskAcceptedLabel: string;
  itemCount: number;
};

export const PROTOCOL_LABEL: Record<string, string> = {
  vbmapp: "VB-MAPP",
  ablls_r: "ABLLS-R",
  esdm: "Denver / ESDM",
};

export async function getProtocolRows(supabase: Supa, clinicId: string): Promise<ProtocolRow[]> {
  const { data: protocols } = await supabase
    .from("protocols")
    .select("id, name, version, license_purchased_at, digitization_risk_accepted_at, digitization_risk_accepted_by")
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
