import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  NATIVE_INSTRUMENTS,
  isNativeInstrumentKey,
  type NativeInstrument,
  type NativeInstrumentKey,
} from "@/lib/native-instruments";

type Supa = SupabaseClient<Database>;

export type ClinicInstrument = NativeInstrument & {
  enabled: boolean;
  licensePurchasedAt: string | null;
  licenseNote: string | null;
};

/**
 * Ausência de linha em `clinic_instruments` significa HABILITADO — a clínica
 * já usava ADL/ADL-2/PROC antes deste cadastro existir, e fazer o padrão ser
 * "desligado" apagaria o acesso a instrumentos em uso no dia em que a
 * migração rodasse. Desabilitar é uma decisão explícita do gestor, que grava
 * a linha com `enabled = false`.
 */
const DEFAULT_ENABLED = true;

/** Catálogo inteiro com o estado de cada instrumento — a tela do gestor. */
export async function listClinicInstruments(supabase: Supa, clinicId: string): Promise<ClinicInstrument[]> {
  const { data } = await supabase
    .from("clinic_instruments")
    .select("instrument, enabled, license_purchased_at, license_note")
    .eq("clinic_id", clinicId);

  const byKey = new Map((data ?? []).map((row) => [row.instrument, row]));

  return NATIVE_INSTRUMENTS.map((instrument) => {
    const row = byKey.get(instrument.key);
    return {
      ...instrument,
      enabled: row ? row.enabled : DEFAULT_ENABLED,
      licensePurchasedAt: row?.license_purchased_at ?? null,
      licenseNote: row?.license_note ?? null,
    };
  });
}

/**
 * Só as chaves habilitadas — para esconder atalhos no prontuário e barrar as
 * telas do instrumento. Em caso de falha na leitura devolve o padrão
 * (todos habilitados) em vez de trancar o prontuário inteiro: um erro de rede
 * na configuração não pode virar perda de acesso clínico.
 */
export async function getEnabledInstrumentKeys(supabase: Supa, clinicId: string): Promise<Set<NativeInstrumentKey>> {
  const { data, error } = await supabase
    .from("clinic_instruments")
    .select("instrument, enabled")
    .eq("clinic_id", clinicId)
    .eq("enabled", false);

  const enabled = new Set<NativeInstrumentKey>(NATIVE_INSTRUMENTS.map((i) => i.key));
  if (error) return enabled;

  for (const row of data ?? []) {
    if (isNativeInstrumentKey(row.instrument)) enabled.delete(row.instrument);
  }
  return enabled;
}

/** Conveniência para as telas de um instrumento específico. */
export async function isInstrumentEnabled(
  supabase: Supa,
  clinicId: string,
  key: NativeInstrumentKey,
): Promise<boolean> {
  const enabled = await getEnabledInstrumentKeys(supabase, clinicId);
  return enabled.has(key);
}
