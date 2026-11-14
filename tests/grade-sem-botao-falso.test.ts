// tests/grade-sem-botao-falso.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// AGD-01: botão que só mostra "enviado" sem chamar ação nenhuma engana o coordenador.
// Se um dia o lembrete for real, este teste deve ser trocado por um que valide a ação.
test("a grade da Supervisão não finge enviar lembrete nem abrir PTS", () => {
  const src = readFileSync("app/supervisao/grade-panel.tsx", "utf8");
  assert.ok(!/Lembrete de .* enviado/.test(src), "voltou um aviso de lembrete enviado sem ação real");
  assert.ok(!src.includes("Visualização de PTS acionada"), "voltou o aviso de PTS acionada sem ação real");
  assert.ok(!/>\s*Lembrar\s*</.test(src), "voltou um botão Lembrar");
});

test("PTS atrasado leva ao prontuário do paciente por link real", () => {
  const src = readFileSync("app/supervisao/grade-panel.tsx", "utf8");
  assert.ok(src.includes("/supervisao/prontuario-unificado?p=${p.patientId}"));
});
