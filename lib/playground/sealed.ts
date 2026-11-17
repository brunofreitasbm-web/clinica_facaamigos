import { constants, createPrivateKey, createDecipheriv, privateDecrypt } from "node:crypto";

/**
 * Envelope cifrado da fila de reenvio do PDV. O PDV cifra com a chave pública
 * da clínica e NÃO consegue ler o conteúdo; só a clínica decifra, com
 * `PLAYGROUND_BRIDGE_PRIVATE_KEY`. Formato (híbrido, WebCrypto no PDV):
 *   "v1." + b64url(RSA-OAEP-SHA256(chave AES)) + "." + b64url(iv 12 bytes)
 *        + "." + b64url(AES-256-GCM ciphertext || tag 16 bytes)
 * O texto claro é um JSON `{ action, body }`.
 */
export type SealedPayload = { action: "visit" | "entries" | "conclude"; body: Record<string, unknown> };

const b64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

/** Aceita PEM (com ou sem \n literais) ou o DER PKCS8 em base64. */
function loadPrivateKey(raw: string) {
  const text = raw.replace(/\\n/g, "\n").trim();
  if (text.includes("BEGIN")) return createPrivateKey(text);
  return createPrivateKey({ key: Buffer.from(text, "base64"), format: "der", type: "pkcs8" });
}

export function decryptSealed(privateKeyRaw: string | undefined, envelope: string): SealedPayload | null {
  if (!privateKeyRaw) return null;
  try {
    const parts = envelope.split(".");
    if (parts.length !== 4 || parts[0] !== "v1") return null;
    const wrapped = b64url(parts[1]);
    const iv = b64url(parts[2]);
    const data = b64url(parts[3]);
    if (iv.length !== 12 || data.length < 17) return null;

    const key = privateDecrypt(
      { key: loadPrivateKey(privateKeyRaw), padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
      wrapped,
    );
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(data.subarray(data.length - 16));
    const plain = Buffer.concat([decipher.update(data.subarray(0, data.length - 16)), decipher.final()]).toString("utf8");

    const parsed = JSON.parse(plain) as Partial<SealedPayload>;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.action !== "visit" && parsed.action !== "entries" && parsed.action !== "conclude") return null;
    if (!parsed.body || typeof parsed.body !== "object" || Array.isArray(parsed.body)) return null;
    return { action: parsed.action, body: parsed.body as Record<string, unknown> };
  } catch {
    return null;
  }
}
