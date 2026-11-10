// lib/draft-orphan-patient-pure.ts
// Regra PURA: um rascunho de WhatsApp SEM paciente (`patient_id` nulo) cujo telefone
// já pertence a uma criança cadastrada é a MESMA criança? Sem import com alias `@/`
// para rodar em `node --test --experimental-strip-types`
// (tests/draft-orphan-patient-pure.test.ts).
//
// Por quê: a mãe do Davi Átila mandou uma nova guia por WhatsApp quando a criança já
// tinha cadastro validado. O novo rascunho nasceu órfão, a recepção clicou "Plano
// autorizou" nele e, sem `patient_id`, a oferta automática de horários não disparou.
import { sameChildName } from "./patient-duplicates-pure.ts";

export type PatientCandidate = { id: string; full_name: string | null };

/**
 * Devolve o id do paciente já cadastrado a que o rascunho órfão pertence, ou null.
 * - Com nome da criança no rascunho: exige o mesmo primeiro nome (irmãos no mesmo
 *   telefone não se misturam) e exatamente UM candidato — ambíguo não adivinha.
 * - Sem nome: só aceita se o telefone tiver um único paciente.
 */
export function pickPatientForOrphanDraft(childName: string | null | undefined, candidates: PatientCandidate[]): string | null {
  if (candidates.length === 0) return null;
  const name = (childName ?? "").trim();
  if (!name) return candidates.length === 1 ? candidates[0].id : null;
  const matches = candidates.filter((c) => sameChildName(name, c.full_name));
  return matches.length === 1 ? matches[0].id : null;
}
