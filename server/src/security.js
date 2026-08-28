import { createHash, createPublicKey, randomBytes, timingSafeEqual, verify } from "node:crypto";
import { isIP } from "node:net";

export const SIGNATURE_PREFIX = "rankpine-strapi-v1";
export const SIGNATURE_MAX_AGE_SECONDS = 5 * 60;
export const PAIRING_MAX_AGE_MS = 10 * 60 * 1_000;

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function createPairingToken() {
  return randomBytes(32).toString("base64url");
}

export function canonicalRequest(method, path, timestamp, nonce, body) {
  const digest = sha256(body ?? "");
  return [SIGNATURE_PREFIX, method.toUpperCase(), path, timestamp, nonce, digest].join("\n");
}

export function validateEd25519PublicKey(value) {
  if (typeof value !== "string" || value.length > 8_192) return false;
  try {
    return createPublicKey(value).asymmetricKeyType === "ed25519";
  } catch {
    return false;
  }
}

export function verifySignedRequest({
  method,
  path,
  body,
  publicKeyPem,
  expectedKeyId,
  headers,
  now = new Date(),
}) {
  const keyId = header(headers, "x-rankpine-key-id");
  const timestamp = header(headers, "x-rankpine-timestamp");
  const nonce = header(headers, "x-rankpine-nonce");
  const signature = header(headers, "x-rankpine-signature");
  if (!keyId || !safeEqual(keyId, expectedKeyId)) return { ok: false, reason: "unknown_key" };
  if (!/^\d{10,13}$/.test(timestamp ?? "")) return { ok: false, reason: "invalid_timestamp" };
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds)) return { ok: false, reason: "invalid_timestamp" };
  if (Math.abs(Math.floor(now.getTime() / 1_000) - seconds) > SIGNATURE_MAX_AGE_SECONDS) {
    return { ok: false, reason: "stale" };
  }
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(nonce ?? "")) return { ok: false, reason: "invalid_nonce" };
  if (!/^[A-Za-z0-9_-]{64,128}$/.test(signature ?? "")) {
    return { ok: false, reason: "invalid_signature" };
  }
  try {
    const canonical = canonicalRequest(method, path, timestamp, nonce, body);
    const valid = verify(
      null,
      Buffer.from(canonical),
      publicKeyPem,
      Buffer.from(signature, "base64url"),
    );
    return valid ? { ok: true, nonce } : { ok: false, reason: "invalid_signature" };
  } catch {
    return { ok: false, reason: "invalid_signature" };
  }
}

function header(headers, name) {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : typeof value === "string" ? value : undefined;
}

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isPrivateAddress(address) {
  const normalized = address.replace(/^::ffff:/, "").toLowerCase();
  if (!isIP(normalized)) return true;
  if (normalized.includes(":")) {
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      /^fe[89ab]/.test(normalized)
    );
  }
  const parts = normalized.split(".").map(Number);
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

export function redactError(error) {
  return (error instanceof Error ? error.message : String(error))
    .replace(/(authorization|token|private[-_ ]?key)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 300);
}
