// tests/pts-templates.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractAutocompleteSuggestions, type PtsTemplate } from "../lib/pts-templates.ts";

const mockTemplates: PtsTemplate[] = [
  {
    id: "1",
    clinic_id: "c1",
    discipline: "aba",
    domain: "Comunicação Verbal (Mando)",
    title: "Mando de 2 palavras",
    description: "Emitir pedido com 2 palavras",
    baseline: "Vocalizações isoladas",
    strategy: "Treino DTT com esvanecimento de dicas",
    criterion: "80% de acertos",
    horizon: "curto",
    methodology: "dtt",
    programs_default: [{ name: "Programa 1", targetType: "tentativa", masteryCriterion: "80%" }],
    sort_order: 1,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "2",
    clinic_id: "c1",
    discipline: "fonoaudiologia",
    domain: "Compreensão",
    title: "Ordens de 2 comandos",
    description: "Compreender ordens de 2 comandos",
    baseline: "Vocalizações isoladas", // duplicado para testar deduplicação
    strategy: "Atividades lúdicas estruturadas",
    criterion: "85% de acertos",
    horizon: "curto",
    methodology: "misto",
    programs_default: [],
    sort_order: 2,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

test("extractAutocompleteSuggestions extrai e deduplica Domínios, Linhas de Base e Estratégias", () => {
  const { domains, baselines, strategies } = extractAutocompleteSuggestions(mockTemplates);

  assert.deepEqual(domains, ["Comunicação Verbal (Mando)", "Compreensão"]);
  assert.deepEqual(baselines, ["Vocalizações isoladas"]);
  assert.deepEqual(strategies, [
    "Treino DTT com esvanecimento de dicas",
    "Atividades lúdicas estruturadas",
  ]);
});

test("extractAutocompleteSuggestions ignora valores nulos ou vazios", () => {
  const emptyTemplate: PtsTemplate = {
    ...mockTemplates[0],
    domain: "   ",
    baseline: null,
    strategy: "",
  };
  const { domains, baselines, strategies } = extractAutocompleteSuggestions([emptyTemplate]);

  assert.deepEqual(domains, []);
  assert.deepEqual(baselines, []);
  assert.deepEqual(strategies, []);
});
