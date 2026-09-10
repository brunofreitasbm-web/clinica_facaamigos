import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getClinicIdentity, type ClinicIdentity } from "@/lib/clinic-identity";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { chronologicalAge, formatChronologicalAge } from "@/lib/age";
import { civilDateInTimeZone, todayInTimeZone } from "@/lib/timezone";

/**
 * TCLE — Termo de Consentimento Livre e Esclarecido, específico para clínica
 * de desenvolvimento infantil.
 *
 * É o último passo da 1ª avaliação (anamnese ampliada) e do acolhimento: a
 * família ouve o esclarecimento, o termo sai impresso no timbre já preenchido
 * com o que o sistema tem de cadastro, o responsável assina em papel e a via
 * assinada fica arquivada na clínica (a via digital continua sendo o próprio
 * cadastro + prontuário).
 *
 * Nada aqui inventa dado: campo que a clínica não cadastrou sai como linha
 * pontilhada para preencher à caneta — documento assinado não pode carregar
 * CPF, endereço ou parentesco chutado pelo sistema.
 */

type Supa = SupabaseClient<Database>;

/**
 * Versão do texto do termo. Sai impressa no rodapé para que a clínica saiba,
 * anos depois, qual redação o responsável assinou. Suba a versão sempre que
 * mudar o conteúdo das cláusulas (não a diagramação).
 */
export const TCLE_VERSION = "1.0 (2026-09)";

/** Marcador de campo que o sistema não tem — preencher à mão no papel. */
export const BLANK = "________________________";

export type TcleGuardian = {
  id: string;
  fullName: string;
  cpf: string | null;
  rg: string | null;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  isFinancial: boolean;
  isEmergencyContact: boolean;
};

export type TclePatient = {
  id: string;
  fullName: string;
  birthDate: string;
  /** Idade em anos e meses na data de emissão — conferência rápida no papel. */
  ageLabel: string | null;
  sexo: string | null;
  cpf: string | null;
  naturalidade: string | null;
  cid: string | null;
  endereco: string | null;
};

export type TcleContext = {
  clinic: ClinicIdentity;
  patient: TclePatient;
  guardians: TcleGuardian[];
  /** Data/hora da 1ª avaliação já registrada, quando existe. */
  anamnese: { conductedAt: string; conductedByName: string | null } | null;
  /** Ciclo de reavaliação cadastrado pela clínica (cláusula 4). */
  reassessmentCycleMonths: number;
  /** Profissional que está conduzindo o acolhimento e assina como testemunha técnica. */
  professional: { fullName: string; role: string | null } | null;
  issuedAt: string;
};

function formatPatientEndereco(row: {
  address_logradouro: string | null;
  address_numero: string | null;
  address_complemento: string | null;
  address_bairro: string | null;
  address_cidade: string | null;
  address_uf: string | null;
  address_cep: string | null;
}): string | null {
  const via = [row.address_logradouro, row.address_numero].filter(Boolean).join(", ");
  const linha = [via, row.address_complemento, row.address_bairro].filter(Boolean).join(" — ");
  const cidadeUf = [row.address_cidade, row.address_uf].filter(Boolean).join("/");
  const partes = [linha, cidadeUf, row.address_cep].filter(Boolean);
  return partes.length ? partes.join(" · ") : null;
}

/**
 * Idade da criança na data de emissão, no formato das telas ("5 anos e 8
 * meses"). Reaproveita `chronologicalAge` (lib/age.ts) — mesma semântica de
 * DATEDIF já usada nas planilhas da clínica — em vez de recontar meses aqui.
 *
 * Devolve null quando o cadastro tem data de nascimento implausível (ano
 * digitado errado, ex.: "0018-10-17"): num termo assinado é melhor o campo
 * sair em branco para conferência à mão do que sair "2008 anos".
 */
export function ageLabelFrom(birthDate: string, todayIso = todayInTimeZone(CLINIC_TIMEZONE)): string | null {
  const [y] = birthDate.slice(0, 10).split("-").map(Number);
  if (!y) return null;
  const age = chronologicalAge(birthDate, todayIso);
  if (age.years > 120) return null;
  return formatChronologicalAge(age);
}

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: CLINIC_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/**
 * Fecho do termo: "Belém, 9 de setembro de 2026". A data vem do instante de
 * emissão convertido para o fuso da clínica — emitir 21h em Belém não pode
 * datar o documento do dia seguinte (o instante em UTC já virou). Sem cidade
 * cadastrada, sai a linha para preencher à mão.
 */
export function fmtCityAndLongDate(city: string | null, instantIso: string): string {
  const [y, m, d] = civilDateInTimeZone(new Date(instantIso), CLINIC_TIMEZONE).split("-").map(Number);
  const extenso = `${d} de ${MESES[m - 1]} de ${y}`;
  return `${city ?? BLANK}, ${extenso}`;
}

/**
 * Junta tudo que o termo precisa. Responsável financeiro vem primeiro (é
 * quem costuma assinar o contrato), depois o contato de emergência, depois
 * os demais — a primeira posição vira o bloco de assinatura principal.
 */
export async function getTcleContext(
  supabase: Supa,
  patientId: string,
  professionalId?: string | null,
): Promise<TcleContext | null> {
  const { data: patient } = await supabase
    .from("patients")
    .select(
      "id, full_name, birth_date, sexo, cpf, naturalidade, cid, clinic_id, address_logradouro, address_numero, address_complemento, address_bairro, address_cidade, address_uf, address_cep",
    )
    .eq("id", patientId)
    .maybeSingle();

  if (!patient) return null;

  const [{ data: guardians }, { data: clinicRow }, { data: anamnese }] = await Promise.all([
    supabase
      .from("guardians")
      .select("id, full_name, cpf, rg, relationship, phone, email, is_financial, is_emergency_contact")
      .eq("patient_id", patientId),
    supabase.from("clinics").select("reassessment_cycle_months").eq("id", patient.clinic_id).maybeSingle(),
    supabase
      .from("anamneses")
      .select("conducted_at, profiles!conducted_by(full_name)")
      .eq("patient_id", patientId)
      .order("conducted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const clinic = await getClinicIdentity(supabase, patient.clinic_id);

  const { data: professional } = professionalId
    ? await supabase.from("profiles").select("full_name, role").eq("id", professionalId).maybeSingle()
    : { data: null };

  const ordered = [...(guardians ?? [])].sort((a, b) => {
    const score = (g: { is_financial: boolean; is_emergency_contact: boolean }) =>
      (g.is_financial ? 2 : 0) + (g.is_emergency_contact ? 1 : 0);
    return score(b) - score(a) || a.full_name.localeCompare(b.full_name, "pt-BR");
  });

  const anamneseProfile = anamnese
    ? Array.isArray(anamnese.profiles)
      ? anamnese.profiles[0]
      : anamnese.profiles
    : null;

  return {
    clinic,
    patient: {
      id: patient.id,
      fullName: patient.full_name,
      birthDate: patient.birth_date,
      ageLabel: ageLabelFrom(patient.birth_date),
      sexo: patient.sexo,
      cpf: patient.cpf,
      naturalidade: patient.naturalidade,
      cid: patient.cid,
      endereco: formatPatientEndereco(patient),
    },
    guardians: ordered.map((g) => ({
      id: g.id,
      fullName: g.full_name,
      cpf: g.cpf,
      rg: g.rg,
      relationship: g.relationship,
      phone: g.phone,
      email: g.email,
      isFinancial: g.is_financial,
      isEmergencyContact: g.is_emergency_contact,
    })),
    anamnese: anamnese
      ? { conductedAt: anamnese.conducted_at, conductedByName: anamneseProfile?.full_name ?? null }
      : null,
    reassessmentCycleMonths: clinicRow?.reassessment_cycle_months ?? 6,
    professional: professional ? { fullName: professional.full_name, role: professional.role } : null,
    issuedAt: new Date().toISOString(),
  };
}
