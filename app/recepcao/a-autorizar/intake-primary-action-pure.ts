// Fila de entrada: o único botão principal de cada caso, conforme a etapa e o robô do portal.
// PURO, sem import com alias `@/` (roda em node:test).
//
// Etapa 1 nunca tem botão principal (documento faltando não bloqueia).
// Etapa 2: robô ligado envia pelo robô; robô desligado vira "Marcar guia como enviada".
// Etapa 3: subir a guia autorizada em PDF. Etapa 4: caso concluído, sem botão.

import { intakeStage, type IntakeInput } from "../../../lib/intake-queue-pure.ts";

export type PrimaryActionKind = "none" | "send_via_robot" | "mark_sent" | "upload_authorized_pdf";

export type PrimaryAction = { kind: PrimaryActionKind; label: string };

export function primaryAction(i: IntakeInput, robotOnline: boolean): PrimaryAction {
  switch (intakeStage(i)) {
    case 1:
      return { kind: "none", label: "" };
    case 2:
      return robotOnline
        ? { kind: "send_via_robot", label: "Enviar guia ao plano" }
        : { kind: "mark_sent", label: "Marcar guia como enviada" };
    case 3:
      return { kind: "upload_authorized_pdf", label: "Subir guia autorizada (PDF)" };
    case 4:
      return { kind: "none", label: "" };
  }
}
