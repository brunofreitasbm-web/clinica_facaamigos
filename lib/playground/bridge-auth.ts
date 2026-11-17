import { createHmac, timingSafeEqual } from "node:crypto";
import { BRIDGE_SIGNATURE_TOLERANCE_SECONDS } from "./constants.ts";

export const BRIDGE_TIMESTAMP_HEADER = "x-fa-bridge-timestamp";
export const BRIDGE_SIGNATURE_HEADER = "x-fa-bridge-signature";

/** Assinatura HMAC-SHA256 (hex) de `${timestamp}.${corpo}`. */
export function signBridgeBody(secret: string, timestampSeconds: number, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestampSeconds}.${rawBody}`).digest("hex");
}

export type BridgeVerifyResult = { ok: true } | { ok: false; reason: "missing" | "expired" | "invalid" };

export function verifyBridgeSignature(args: {
  secret: string | undefined;
  timestampHeader: string | null;
  signatureHeader: string | null;
  rawBody: string;
  nowSeconds: number;
}): BridgeVerifyResult {
  const { secret, timestampHeader, signatureHeader, rawBody, nowSeconds } = args;
  if (!secret || !timestampHeader || !signatureHeader) return { ok: false, reason: "missing" };

  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) return { ok: false, reason: "invalid" };
  if (Math.abs(nowSeconds - ts) > BRIDGE_SIGNATURE_TOLERANCE_SECONDS) return { ok: false, reason: "expired" };

  const expected = Buffer.from(signBridgeBody(secret, ts, rawBody), "hex");
  let given: Buffer;
  try {
    given = Buffer.from(signatureHeader, "hex");
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (given.length !== expected.length) return { ok: false, reason: "invalid" };
  return timingSafeEqual(given, expected) ? { ok: true } : { ok: false, reason: "invalid" };
}
