// Script temporário, não faz parte do repositório — cria um paciente
// fictício com avaliações ADL/ADL-2/PROC preenchidas para demonstrar a
// funcionalidade em um navegador real. Apagar após o uso.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { chronologicalAge } from "./lib/age.ts";
import { ADL_BANDS, ADL_DOUBLE_COUNT_EXPRESSIVE_BAND_KEY } from "./lib/fono-instruments/adl.ts";
import { ADL2_BANDS } from "./lib/fono-instruments/adl2.ts";
import { FONOLOGIA_WORDS, FONOLOGIA_BANDS } from "./lib/fono-instruments/adl2-fonologia.ts";
import { PROC_CATALOG } from "./lib/fono-instruments/proc.ts";
import { computeAdlResults, computeFonologiaResults, computeProcResults } from "./lib/fono-instruments/scoring.ts";
import type { AdlManualScores, AdlResponses, FonologiaResponses, FonoBand, ProcResponses } from "./lib/fono-instruments/types.ts";

function loadEnvLocal(): Record<string, string> {
  const text = readFileSync(".env.local", "utf8");
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}
const env = loadEnvLocal();

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY!;
const CLINIC_ID = "c0000000-0000-0000-0000-000000000001";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function fillBands(bands: FonoBand[], currentBandIndex: number): AdlResponses {
  const responses: AdlResponses = {};
  bands.forEach((band, i) => {
    for (const item of [...band.receptive, ...band.expressive]) {
      if (i < currentBandIndex - 3) {
        responses[item.key] = "1";
      } else if (i < currentBandIndex) {
        // faixas recentes: majoritariamente adquirido, alguns em aquisição
        responses[item.key] = item.num % 5 === 0 ? "0" : "1";
      } else if (i === currentBandIndex) {
        // faixa da idade atual: emergente — mistura de acerto/erro/NR
        const m = item.num % 3;
        responses[item.key] = m === 0 ? "1" : m === 1 ? "0" : "NR";
      } else if (i === currentBandIndex + 1) {
        responses[item.key] = item.num % 4 === 0 ? "1" : "0";
      }
      // faixas bem acima da idade: não administradas (sem resposta)
    }
  });
  return responses;
}

const TODAY = new Date().toISOString().slice(0, 10);
const BIRTH_DATE = "2023-07-07"; // ~3 anos e 2 meses em relação a TODAY

const age = chronologicalAge(BIRTH_DATE, TODAY);
console.log("Idade calculada:", age);

// --- ADL ---
const adlCurrentBand = 4; // "3 anos até 3 anos e 5 meses"
const adlResponses = fillBands(ADL_BANDS, adlCurrentBand);
const adlManual: AdlManualScores = {
  ultimaTarefaCorretaReceptiva: 18,
  ultimaTarefaCorretaExpressiva: 17,
  escorePadraoReceptivo: 78,
  escorePadraoExpressivo: 76,
  escorePadraoGlobal: 80,
};
const adlResults = computeAdlResults(ADL_BANDS, adlResponses, adlManual, {
  doubleCountExpressiveBandKey: ADL_DOUBLE_COUNT_EXPRESSIVE_BAND_KEY,
});
console.log("ADL classificação:", adlResults.classificacao, "objetivos LR:", adlResults.objetivosPrioritariosReceptivo.length, "LE:", adlResults.objetivosPrioritariosExpressivo.length);

// Rascunho ADL mais antigo (3 meses antes), menos itens preenchidos, sem concluir.
const adlDraftResponses = fillBands(ADL_BANDS, adlCurrentBand - 1);

// --- ADL-2 ---
const adl2CurrentBand = 4; // "3 anos a 3 anos e 5 meses"
const adl2Responses = fillBands(ADL2_BANDS, adl2CurrentBand);
const fonologiaResponses: FonologiaResponses = {};
for (const w of FONOLOGIA_WORDS) {
  if (w.bandKey !== "f1") continue; // só a 1ª faixa fonológica (3a-3a5m) é administrada
  const codes = ["+", "+", "-", "N", "R"] as const;
  fonologiaResponses[String(w.number)] = codes[w.number % codes.length];
}
const adl2Manual: AdlManualScores = {
  ultimaTarefaCorretaReceptiva: 22,
  ultimaTarefaCorretaExpressiva: 24,
  escorePadraoReceptivo: 95,
  escorePadraoExpressivo: 92,
  escorePadraoGlobal: 93,
};
const adl2Results = computeAdlResults(ADL2_BANDS, adl2Responses, adl2Manual, {});
const fonologiaResults = computeFonologiaResults(FONOLOGIA_WORDS, FONOLOGIA_BANDS, fonologiaResponses);
console.log("ADL-2 classificação:", adl2Results.classificacao);

// --- PROC ---
const procResponses: ProcResponses = {
  "1a-intencao_comunicativa": "2",
  "1a-inicia_conversacao": "2",
  "1a-responde_interlocutor": "2",
  "1a-aguarda_turno": "1",
  "1a-participa_dialogica": "2",
  "1b-instrumental": "2",
  "1b-protesto": "1",
  "1b-interativa": "2",
  "1b-nomeacao": "1",
  "1b-informativa": "1",
  "1b-heuristica": "1",
  "1b-narrativa": "0",
  "1c-vocalizacoes": "articuladas_jargao",
  "1c-gestos": "simbolicos",
  "1c-verbais": "frases_3",
  "1d-nivel": "descreve_acao",
  "2a-nivel": "ordem_1_sem_gesto",
  "3a-diversificado_um_a_um": "on",
  "3b-bonecos_parceiros": "on",
  "3c-enfileira": "on",
  "3d-sonora_palavras": "on",
  "3d-gestual_visivel": "on",
  "gc-habilidades_comunicativas-comunicação intencional plurifuncional, ampla participação em atividade dialógica por meios simbólicos e não verbais": "on",
};
const procResults = computeProcResults(PROC_CATALOG, procResponses);
console.log("PROC total:", procResults.totalScore, "/", procResults.totalMax);

async function main() {
  const email = `terapeuta.demo.fono+${Date.now()}@teste.local`;
  const password = "DemoFono#2026!";

  const { data: userData, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userErr || !userData.user) throw userErr ?? new Error("createUser falhou sem erro");
  const therapistId = userData.user.id;

  const { error: profileErr } = await admin.from("profiles").insert({
    id: therapistId,
    clinic_id: CLINIC_ID,
    role: "terapeuta",
    full_name: "Terapeuta Demo (Fono)",
  });
  if (profileErr) throw profileErr;

  const { data: patient, error: patientErr } = await admin
    .from("patients")
    .insert({
      clinic_id: CLINIC_ID,
      full_name: "Paciente Fictício DEMO (Fono)",
      birth_date: BIRTH_DATE,
      status: "ativo",
      entry_source: "demo",
    })
    .select("id")
    .single();
  if (patientErr || !patient) throw patientErr;

  const { error: accessErr } = await admin.from("patient_access").insert({
    patient_id: patient.id,
    profile_id: therapistId,
    access_type: "terapeuta",
  });
  if (accessErr) throw accessErr;

  const threeMonthsAgo = new Date(TODAY);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const draftDate = threeMonthsAgo.toISOString().slice(0, 10);
  const draftAge = chronologicalAge(BIRTH_DATE, draftDate);

  const rows = [
    {
      clinic_id: CLINIC_ID,
      patient_id: patient.id,
      instrument: "adl",
      status: "rascunho",
      test_date: draftDate,
      birth_date: BIRTH_DATE,
      age_years: draftAge.years,
      age_months: draftAge.months,
      assessed_by: therapistId,
      responses: adlDraftResponses,
      manual_scores: {},
      results: {},
      observations: "Primeira aplicação — sessão interrompida, retomar na próxima consulta.",
    },
    {
      clinic_id: CLINIC_ID,
      patient_id: patient.id,
      instrument: "adl",
      status: "concluida",
      test_date: TODAY,
      birth_date: BIRTH_DATE,
      age_years: age.years,
      age_months: age.months,
      assessed_by: therapistId,
      responses: adlResponses,
      manual_scores: adlManual,
      results: adlResults,
      observations: "Reaplicação completa. Criança colaborativa, boa atenção compartilhada.",
    },
    {
      clinic_id: CLINIC_ID,
      patient_id: patient.id,
      instrument: "adl2",
      status: "concluida",
      test_date: TODAY,
      birth_date: BIRTH_DATE,
      age_years: age.years,
      age_months: age.months,
      assessed_by: therapistId,
      responses: { ...adl2Responses, ...Object.fromEntries(Object.entries(fonologiaResponses).map(([k, v]) => [`fono-${k}`, v])) },
      manual_scores: adl2Manual,
      results: { ...adl2Results, fonologia: fonologiaResults },
      observations: "Vocabulário expressivo em bom desenvolvimento; atenção a sons finais em fala conectada.",
    },
    {
      clinic_id: CLINIC_ID,
      patient_id: patient.id,
      instrument: "proc",
      status: "concluida",
      test_date: TODAY,
      birth_date: BIRTH_DATE,
      age_years: age.years,
      age_months: age.months,
      assessed_by: therapistId,
      responses: procResponses,
      manual_scores: {},
      results: procResults,
      observations: "Boa iniciativa comunicativa; brincadeira simbólica em desenvolvimento típico para a idade.",
    },
  ];

  const { data: inserted, error: insErr } = await admin.from("fono_assessments").insert(rows).select("id, instrument, status");
  if (insErr) throw insErr;

  console.log("\n=== Dados de teste criados ===");
  console.log("Paciente ID:", patient.id);
  console.log("Terapeuta email:", email);
  console.log("Terapeuta senha:", password);
  console.log("Avaliações:", inserted);
  console.log(`\nURL: http://localhost:3000/terapeuta/paciente/${patient.id}/fono`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
