"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { TablesUpdate } from "@/lib/database.types";
import { normalizeCpf, normalizePhone } from "@/lib/document-extraction";
import { resolveIntakeToken } from "@/lib/patient-intake-form";

/**
 * Grava a ficha preenchida pela família direto em `patients` e `guardians`.
 *
 * Usa service-role de propósito: a RLS (`patients_update_recepcao_supervisor`,
 * `guardians_write_recepcao_*`) só deixa recepção/supervisor/gestor escreverem,
 * e aqui quem escreve é a família, sem sessão. Foi uma decisão de produto —
 * a alternativa era passar por `registration_drafts` e revisão da recepção.
 * Como não há revisão, duas travas ficam por conta deste arquivo:
 *
 *   1. nada é apagado — campo em branco no formulário não sobrescreve dado
 *      já existente na ficha (`putIfFilled`);
 *   2. tudo que a família enviou fica em `submitted_payload`, junto com o
 *      carimbo de envio, como única trilha de auditoria da alteração.
 */

export type FichaResult = { success: true } | { success: false; error: string };

type PatientUpdate = TablesUpdate<"patients">;
type GuardianUpdate = TablesUpdate<"guardians">;

/**
 * Só entra no update o que a família realmente preencheu — campo em branco
 * nunca apaga dado que já está na ficha. A chave é restrita às colunas de
 * texto da tabela, então errar um nome de coluna quebra na compilação.
 */
function putIfFilled<T extends object>(target: T, column: keyof T, value: string | null) {
  if (value && value.trim()) target[column] = value.trim() as T[keyof T];
}

function text(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

const MAX_TEXT = 2000;

export async function submitFicha(token: string, formData: FormData): Promise<FichaResult> {
  // O token chega do cliente: revalidamos do zero, sem confiar no que a
  // página resolveu antes. É aqui que uso único e expiração são impostos.
  const resolved = await resolveIntakeToken(token);
  if (!resolved.ok) {
    return { success: false, error: "Este link não está mais válido. Fale com a recepção da clínica." };
  }
  const { tokenId, patientId } = resolved.target;

  const queixa = text(formData, "queixa");
  if (!queixa) return { success: false, error: "Conte para a gente o motivo da busca pelo atendimento." };
  if (queixa.length > MAX_TEXT) {
    return { success: false, error: "O texto do motivo ficou muito longo. Resuma em até 2000 caracteres." };
  }

  const admin = createAdminClient();

  // ── Ficha do paciente ──────────────────────────────────────────────────
  const patientUpdate: PatientUpdate = { complaint: queixa };

  const nascimento = text(formData, "data_nascimento");
  // `patients.birth_date` é NOT NULL: em branco não pode virar update.
  if (nascimento && /^\d{4}-\d{2}-\d{2}$/.test(nascimento)) {
    const hoje = new Date().toISOString().slice(0, 10);
    if (nascimento < "1900-01-01" || nascimento > hoje) {
      return { success: false, error: "Confira a data de nascimento: ela não pode ser no futuro." };
    }
    patientUpdate.birth_date = nascimento;
  }

  putIfFilled(patientUpdate, "sexo", text(formData, "sexo"));
  putIfFilled(patientUpdate, "naturalidade", text(formData, "naturalidade"));
  putIfFilled(patientUpdate, "address_cep", text(formData, "cep"));
  putIfFilled(patientUpdate, "address_logradouro", text(formData, "logradouro"));
  putIfFilled(patientUpdate, "address_numero", text(formData, "numero"));
  putIfFilled(patientUpdate, "address_complemento", text(formData, "complemento"));
  putIfFilled(patientUpdate, "address_bairro", text(formData, "bairro"));
  putIfFilled(patientUpdate, "address_cidade", text(formData, "cidade"));
  putIfFilled(patientUpdate, "address_uf", text(formData, "uf"));

  const cpfPaciente = normalizeCpf(text(formData, "cpf_paciente"));
  if (cpfPaciente) patientUpdate.cpf = cpfPaciente;

  const { error: patientError } = await admin.from("patients").update(patientUpdate).eq("id", patientId);
  if (patientError) {
    console.error("[ficha] falha ao gravar paciente", patientError);
    return { success: false, error: "Não conseguimos salvar agora. Tente de novo em instantes." };
  }

  // ── Responsáveis ───────────────────────────────────────────────────────
  // Casamos por telefone normalizado (E.164), não por nome: "Mãe"/"Maria"
  // mudam de grafia entre cadastros, o número não. Sem telefone não dá para
  // identificar nem para criar (`guardians.phone` é NOT NULL), então a
  // entrada é simplesmente ignorada em vez de virar responsável duplicado.
  const { data: existentes } = await admin
    .from("guardians")
    .select("id, phone")
    .eq("patient_id", patientId);

  const responsaveis = [1, 2].map((n) => ({
    nome: text(formData, `resp${n}_nome`),
    telefone: normalizePhone(text(formData, `resp${n}_telefone`)),
    email: text(formData, `resp${n}_email`),
    parentesco: text(formData, `resp${n}_parentesco`),
  }));

  for (const resp of responsaveis) {
    if (!resp.nome || !resp.telefone) continue;

    const jaExiste = existentes?.find((g) => normalizePhone(g.phone) === resp.telefone);

    if (jaExiste) {
      const update: GuardianUpdate = { full_name: resp.nome, phone: resp.telefone };
      putIfFilled(update, "email", resp.email);
      putIfFilled(update, "relationship", resp.parentesco);
      const { error } = await admin.from("guardians").update(update).eq("id", jaExiste.id);
      if (error) console.error("[ficha] falha ao atualizar responsável", error);
    } else {
      const { error } = await admin.from("guardians").insert({
        patient_id: patientId,
        full_name: resp.nome,
        phone: resp.telefone,
        email: resp.email,
        relationship: resp.parentesco,
      });
      if (error) console.error("[ficha] falha ao criar responsável", error);
    }
  }

  // ── Fecha o token e guarda a trilha ────────────────────────────────────
  // Só depois da escrita: se algo acima falhar, o link continua aberto e a
  // família pode reenviar em vez de ficar travada com a ficha pela metade.
  const { error: tokenError } = await admin
    .from("patient_intake_form_tokens")
    .update({
      submitted_at: new Date().toISOString(),
      submitted_payload: {
        paciente: patientUpdate,
        responsaveis: responsaveis.filter((r) => r.nome && r.telefone),
      },
    })
    .eq("id", tokenId);

  if (tokenError) console.error("[ficha] falha ao fechar token", tokenError);

  return { success: true };
}
