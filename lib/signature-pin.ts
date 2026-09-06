// lib/signature-pin.ts
// Hash/verificação do PIN de assinatura digital (PRD §9.4). Usa scrypt do
// Node (sem dependência nova) — nunca grava o PIN em texto puro, só
// `salt:hash` em profiles.signature_pin_hash.
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const PIN_PATTERN = /^\d{4,6}$/;

export function isValidPinFormat(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = scryptSync(pin, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
