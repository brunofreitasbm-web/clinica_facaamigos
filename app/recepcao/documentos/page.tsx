import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getClinicIdentity } from "@/lib/clinic-identity";
import { DocumentosManager, type ClinicInfo, type PatientOption } from "./documentos-manager";

export const dynamic = "force-dynamic";

export default async function DocumentosRecepcaoPage() {
  const supabase = await createClient();

  // Fetch patients list
  const { data: rawPatients } = await supabase
    .from("patients")
    .select("id, full_name, birth_date, status")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("full_name");

  const patientIds = (rawPatients ?? []).map((p) => p.id);

  // Fetch guardians list to map guardian info to patients
  const { data: rawGuardians } = patientIds.length
    ? await supabase
        .from("guardians")
        .select("patient_id, full_name, phone, cpf, is_financial, is_emergency_contact")
        .in("patient_id", patientIds)
    : {
        data: [] as {
          patient_id: string;
          full_name: string;
          phone: string;
          cpf: string | null;
          is_financial: boolean;
          is_emergency_contact: boolean;
        }[],
      };

  // Map primary guardian per patient
  const guardianByPatient = new Map<
    string,
    { fullName: string; phone: string; cpf: string | null }
  >();
  for (const g of rawGuardians ?? []) {
    if (!guardianByPatient.has(g.patient_id) || g.is_financial || g.is_emergency_contact) {
      guardianByPatient.set(g.patient_id, {
        fullName: g.full_name,
        phone: g.phone,
        cpf: g.cpf,
      });
    }
  }

  // Quem está emitindo é quem está logado (antes era um perfil fixo de teste).
  // A assinatura impressa no documento é sempre a dessa pessoa.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).maybeSingle()
    : { data: null };

  // Lida à parte: sem a migration 20261118120000_profiles_signature a coluna
  // não existe e a tela segue funcionando, só sem assinatura.
  let signatureUrl: string | null = null;
  if (user) {
    const { data: sig, error: sigError } = await supabase
      .from("profiles")
      .select("signature_path")
      .eq("id", user.id)
      .maybeSingle();
    const path = sigError ? null : (sig as { signature_path?: string | null } | null)?.signature_path;
    if (path) {
      const { data: signed } = await createAdminClient().storage.from("clinic-documents").createSignedUrl(path, 60 * 60);
      signatureUrl = signed?.signedUrl ?? null;
    }
  }

  // Dados institucionais reais (app/gestor/configuracoes/dados-da-clinica) —
  // documento impresso não pode sair com endereço/CNPJ inventado, então só
  // preenche o que a clínica cadastrou; o resto fica em branco no timbre.
  const clinic = await getClinicIdentity(supabase, DEV_CLINIC_ID);
  const clinicInfo: ClinicInfo = {
    nomeFantasia: clinic.nomeFantasia,
    razaoSocial: clinic.razaoSocial ?? "",
    cnpj: clinic.cnpj ?? "",
    telefone: clinic.telefone ?? "",
    email: clinic.email ?? "",
    endereco: clinic.endereco ?? "",
  };

  const patients: PatientOption[] = (rawPatients ?? []).map((p) => {
    const guardian = guardianByPatient.get(p.id);
    return {
      id: p.id,
      fullName: p.full_name,
      birthDate: p.birth_date,
      status: p.status,
      guardianName: guardian?.fullName || null,
      guardianPhone: guardian?.phone || null,
      guardianCpf: guardian?.cpf || null,
    };
  });

  return (
    <DocumentosManager
      patients={patients}
      currentProfile={
        profile
          ? {
              id: profile.id,
              fullName: profile.full_name,
              role: profile.role,
            }
          : null
      }
      clinicInfo={clinicInfo}
      signatureUrl={signatureUrl}
    />
  );
}
