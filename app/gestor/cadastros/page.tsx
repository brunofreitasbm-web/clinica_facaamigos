import { GestorNav } from "@/components/gestor-nav";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getTherapistRows, getInsurerRows, getProtocolRows, getPatientRows, getAppointmentTypeRows } from "./data";
import { CadastrosTabs } from "./cadastros-tabs";

export const dynamic = "force-dynamic";

export default async function CadastrosPage() {
  const supabase = await createClient();

  const [therapists, insurers, protocols, patients, appointmentTypes] = await Promise.all([
    getTherapistRows(supabase, DEV_CLINIC_ID),
    getInsurerRows(supabase, DEV_CLINIC_ID),
    getProtocolRows(supabase, DEV_CLINIC_ID),
    getPatientRows(supabase, DEV_CLINIC_ID),
    getAppointmentTypeRows(supabase, DEV_CLINIC_ID),
  ]);

  return (
    <main className="flex flex-1 flex-col">
      <GestorNav active="cadastros" />

      <div className="px-10 pt-9">
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
          Cadastros
        </h6>
        <h1 className="m-0">Cadastros</h1>
      </div>

      <CadastrosTabs
        therapists={therapists}
        insurers={insurers}
        protocols={protocols}
        patients={patients}
        appointmentTypes={appointmentTypes}
      />
    </main>
  );
}
