import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAuthorizedGuideText } from "../lib/authorized-guide-parser.ts";

// Trecho real (unpdf) de Guia_Solicit_SPSADT_48592161 — texto linearizado.
const SAMPLE = `2- N° Guia no Prestador: 48592161
174321112 21/12/2026
1 22/09/2026
29/09/2026 17432111
22161197000183
31/10/2026 N
24-Tabela 25-Código do Procedimento
ou Item Assistencial
26-Descrição 27-Qtde. Solic. 28-Qtde. Aut.
1- TERAPIA OCUPACIONAL (08 SESSÕES) PREVENÇÃO - PACOTE - CLÍNICO00 80011197 1 1
2- PSICOLOGIA COMPORTAMENTAL MÉTODO ABA I 08 HORAS - SESSÃO - CLÍNICO00 80040061 2 2
3- FONOAUDIOLOGIA - MÉTODO ABA - CLÍNICO00 80040062 8 8
4-
5-`;

test("lê nº da guia, validade da senha e os 3 procedimentos", () => {
  const r = parseAuthorizedGuideText(SAMPLE);
  assert.equal(r.guideNumber, "48592161");
  assert.equal(r.validUntil, "2026-10-31");
  assert.deepEqual(
    r.procedures.map((p) => [p.code, p.quantity]),
    [
      ["80011197", 1],
      ["80040061", 2],
      ["80040062", 8],
    ],
  );
  assert.equal(r.procedures[0].description, "TERAPIA OCUPACIONAL (08 SESSÕES) PREVENÇÃO - PACOTE - CLÍNICO");
  assert.deepEqual(r.warnings, []);
});

test("texto sem guia devolve avisos em vez de palpite", () => {
  const r = parseAuthorizedGuideText("qualquer coisa");
  assert.equal(r.guideNumber, null);
  assert.equal(r.validUntil, null);
  assert.equal(r.procedures.length, 0);
  assert.equal(r.warnings.length, 3);
});
