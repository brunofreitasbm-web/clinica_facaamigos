import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { listClinicInstruments } from "@/lib/clinic-instruments";
import { DISCIPLINES } from "@/app/supervisao/planos/novo/disciplines";
import { InstrumentosManager, type InstrumentRow } from "./instrumentos-manager";

export const dynamic = "force-dynamic";

const DISCIPLINE_LABEL: Record<string, string> = Object.fromEntries(DISCIPLINES.map((d) => [d.value, d.label]));

export default async function InstrumentosConfigPage() {
  const supabase = await createClient();
  const instruments = await listClinicInstruments(supabase, DEV_CLINIC_ID);

  const rows: InstrumentRow[] = instruments.map((i) => ({
    key: i.key,
    shortLabel: i.shortLabel,
    label: i.label,
    description: i.description,
    disciplineLabel: DISCIPLINE_LABEL[i.discipline] ?? i.discipline,
    enabled: i.enabled,
  }));

  return <InstrumentosManager instruments={rows} />;
}
