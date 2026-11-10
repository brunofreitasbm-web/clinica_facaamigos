// lib/cron-auth.ts — comparação em tempo constante do segredo dos crons.
import { createHash, timingSafeEqual } from "node:crypto";

/** Falha fechada: sem env ou sem header = inválido. Hash antes de comparar para igualar o tamanho. */
export function safeSecretEqual(received: string | null | undefined, expected: string | null | undefined): boolean {
  if (!received || !expected) return false;
  const a = createHash("sha256").update(received).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function isValidCronSecret(received: string | null | undefined): boolean {
  return safeSecretEqual(received, process.env.CRON_SECRET);
}
