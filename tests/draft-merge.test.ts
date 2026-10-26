// tests/draft-merge.test.ts
//
// Testes unitários do motor de comparação e mesclagem de rascunhos de pacientes
// enviados por múltiplas conversas (lib/draft-merge.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  areDraftsSameCase,
  areNamesConflicting,
  areNamesMatching,
  arePhonesMatching,
  extractDraftIdentity,
  groupMatchingDrafts,
  mergeBotCollected,
  mergeExtractedData,
  mergeRegistrationDraftGroup,
  normalizeName,
  normalizePhoneDigits,
  type DraftIdentity,
  type DraftPendencySources,
  type PendingRegistrationDraft,
} from "../lib/draft-merge.ts";

test("normalizeName: remove acentos, pontuação e espaços extras", () => {
  assert.equal(normalizeName("  João   de  Almeida  "), "joao de almeida");
  assert.equal(normalizeName("Ágatha Maria da Silva-Santos!"), "agatha maria da silva santos");
});

test("areNamesMatching: reconhece variações e extensões do mesmo nome", () => {
  assert.equal(areNamesMatching("Arthur Miguel Silva", "Arthur Miguel da Silva"), true);
  assert.equal(areNamesMatching("Arthur Miguel", "Arthur Miguel Silva Rocha"), true);
  assert.equal(areNamesMatching("Mariana Costa", "Mariana Costa"), true);
  assert.equal(areNamesMatching("João Silva", "Pedro Santos"), false);
});

test("areNamesConflicting: impede que irmãos no mesmo WhatsApp sejam mesclados", () => {
  assert.equal(areNamesConflicting("João da Silva", "Pedro da Silva"), true);
  assert.equal(areNamesConflicting("Lucas Ferreira", "Gabriel Ferreira"), true);
  assert.equal(areNamesConflicting("Arthur Miguel Silva", "Arthur Miguel"), false);
  assert.equal(areNamesConflicting("Lucas", "Lucas Gabriel"), false);
});

test("arePhonesMatching: compara dígitos úteis ignorando formatação e DDI", () => {
  assert.equal(arePhonesMatching("+55 11 98888-7777", "11988887777"), true);
  assert.equal(arePhonesMatching("(91) 98888-7777", "+5591988887777"), true);
  assert.equal(arePhonesMatching("11988887777", "11911112222"), false);
});

const makeIdentity = (overrides: Partial<DraftIdentity> = {}): DraftIdentity => ({
  id: "draft-1",
  patientId: null,
  patientName: "Lucas Ferreira",
  patientBirthDate: "2019-05-10",
  patientCpf: "12345678901",
  guardianName: "Juliana Ferreira",
  guardianCpf: "98765432100",
  guardianPhone: "11988887777",
  sourcePhone: "+5511988887777",
  cardNumber: "0011223344",
  ...overrides,
});

test("areDraftsSameCase: mescla quando nome da criança e do responsável batem, mesmo com telefones diferentes", () => {
  const draftA = makeIdentity({ id: "a", sourcePhone: "+5511988887777" });
  const draftB = makeIdentity({ id: "b", sourcePhone: "+5511977776666", guardianPhone: "11977776666" });

  assert.equal(areDraftsSameCase(draftA, draftB), true);
});

test("areDraftsSameCase: mescla quando nome da criança e telefone batem", () => {
  const draftA = makeIdentity({ id: "a", guardianName: null });
  const draftB = makeIdentity({ id: "b", guardianName: "Juliana" });

  assert.equal(areDraftsSameCase(draftA, draftB), true);
});

test("areDraftsSameCase: mescla quando CPF da criança é o mesmo", () => {
  const draftA = makeIdentity({ id: "a", patientName: null, patientCpf: "12345678901" });
  const draftB = makeIdentity({ id: "b", patientName: "Lucas", patientCpf: "12345678901" });

  assert.equal(areDraftsSameCase(draftA, draftB), true);
});

test("areDraftsSameCase: NUNCA mescla irmãos com nomes diferentes do mesmo telefone", () => {
  const draftFilho1 = makeIdentity({
    id: "f1",
    patientName: "João Ferreira",
    patientBirthDate: "2018-02-01",
    sourcePhone: "+5511988887777",
  });
  const draftFilho2 = makeIdentity({
    id: "f2",
    patientName: "Pedro Ferreira",
    patientBirthDate: "2020-08-15",
    sourcePhone: "+5511988887777",
  });

  assert.equal(areDraftsSameCase(draftFilho1, draftFilho2), false);
});

test("areDraftsSameCase: NUNCA mescla quando datas de nascimento são conflitantes", () => {
  const draftA = makeIdentity({ id: "a", patientBirthDate: "2019-05-10" });
  const draftB = makeIdentity({ id: "b", patientBirthDate: "2021-12-01" });

  assert.equal(areDraftsSameCase(draftA, draftB), false);
});

test("mergeExtractedData: unifica dados sem sobrescrever campos preenchidos", () => {
  const extA = {
    patient: { full_name: "Lucas Ferreira", birth_date: null, cpf: "12345678901" },
    guardian: { full_name: "Juliana Ferreira", email: null },
    insurance: { insurer_name: "Unimed", card_number: null },
  };
  const extB = {
    patient: { full_name: "Lucas Ferreira", birth_date: "2019-05-10", cpf: null },
    guardian: { full_name: "Juliana Ferreira", email: "juliana@exemplo.com" },
    insurance: { insurer_name: "Unimed", card_number: "99887766" },
  };

  const merged = mergeExtractedData(extA, extB);
  const patient = merged.patient as Record<string, unknown>;
  const guardian = merged.guardian as Record<string, unknown>;
  const insurance = merged.insurance as Record<string, unknown>;

  assert.equal(patient.full_name, "Lucas Ferreira");
  assert.equal(patient.birth_date, "2019-05-10");
  assert.equal(patient.cpf, "12345678901");
  assert.equal(guardian.email, "juliana@exemplo.com");
  assert.equal(insurance.card_number, "99887766");
});

test("groupMatchingDrafts e mergeRegistrationDraftGroup: unem conversas do mesmo paciente", () => {
  const pendencySources: DraftPendencySources = {
    botByDraft: new Map([
      ["d1", { child_name: "Lucas Ferreira", guardian_name: "Juliana Ferreira" }],
      ["d2", { child_name: "Lucas Ferreira", child_birth_date: "2019-05-10" }],
    ]),
    docCategoriesByPatient: new Map(),
    insuredPatients: new Set(),
    insuredPhones: new Set(),
  };

  const draft1: PendingRegistrationDraft = {
    id: "d1",
    patientId: null,
    patientName: "Lucas Ferreira",
    sourcePhone: "+5511988887777",
    source: "whatsapp",
    status: "extracted",
    pipeline: {
      authorization: "pendente",
      guideSentAt: null,
      guideSentByName: null,
      authorizedAt: null,
      authorizedByName: null,
      authorizedGuide: null,
      authorizationId: null,
      schedulingEnabledAt: null,
      suggestedGuide: null,
      registered: false,
    },
    createdAt: "2026-09-20T10:00:00Z",
    guardianMessage: "Segue a certidão do Lucas",
    files: [{ id: "f1", name: "certidao.pdf", mimeType: "application/pdf", detectedType: "certidao_nascimento" }],
    facts: [{ label: "Criança", value: "Lucas Ferreira" }],
    warnings: [],
    error: null,
    messages: [{ direction: "inbound", body: "Olá, quero cadastrar meu filho", sentAt: "2026-09-20T10:00:00Z", hasMedia: false }],
    documentRequests: [],
    pendencies: { pills: [], missingCount: 2, summary: "Faltam 2 documentos" },
  };

  const draft2: PendingRegistrationDraft = {
    id: "d2",
    patientId: null,
    patientName: "Lucas Ferreira",
    sourcePhone: "+5511988887777",
    source: "whatsapp",
    status: "extracted",
    pipeline: {
      authorization: "pendente",
      guideSentAt: null,
      guideSentByName: null,
      authorizedAt: null,
      authorizedByName: null,
      authorizedGuide: null,
      authorizationId: null,
      schedulingEnabledAt: null,
      suggestedGuide: null,
      registered: false,
    },
    createdAt: "2026-09-20T11:00:00Z",
    guardianMessage: "Agora o laudo médico",
    files: [{ id: "f2", name: "laudo.pdf", mimeType: "application/pdf", detectedType: "laudo" }],
    facts: [{ label: "Criança", value: "Lucas Ferreira" }],
    warnings: [],
    error: null,
    messages: [{ direction: "inbound", body: "Enviando o laudo dele", sentAt: "2026-09-20T11:00:00Z", hasMedia: false }],
    documentRequests: [],
    pendencies: { pills: [], missingCount: 1, summary: "Falta 1 documento" },
  };

  const groups = groupMatchingDrafts([draft1, draft2], pendencySources.botByDraft);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].length, 2);

  const merged = mergeRegistrationDraftGroup(groups[0], pendencySources);
  assert.equal(merged.id, "d1");
  assert.equal(merged.files.length, 2);
  assert.equal(merged.messages.length, 2);
  assert.equal(merged.mergedDraftsCount, 2);
  assert.match(merged.guardianMessage ?? "", /certidão/);
  assert.match(merged.guardianMessage ?? "", /laudo/);
});
