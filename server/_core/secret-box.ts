import crypto from "node:crypto";

/**
 * Encryption at rest for secrets this app has to be able to read back.
 *
 * Webhook credentials are hashed, because verifying an inbound secret only needs a
 * comparison. Connector credentials are the opposite problem: the app must present the
 * actual Salesforce client secret to Salesforce, so it has to be able to decrypt it. That
 * means a real key and a real cipher, not a hash and not base64.
 *
 * AES-256-GCM, so the ciphertext is authenticated — a row edited in the database fails to
 * decrypt rather than silently yielding different bytes.
 *
 * ── On the missing-key case ──────────────────────────────────────────────────────────
 *
 * With no CREDENTIALS_KEY set, this REFUSES to encrypt rather than storing plaintext or
 * quietly skipping the feature. Storing a customer's Salesforce secret in a column that
 * merely looks encrypted is the exact failure this codebase keeps finding, and it is far
 * worse here than elsewhere: the thing that looks fine is a credential to someone else's
 * CRM. An operator who has not set a key gets told to set one.
 */

const KEY_BYTES = 32;
const IV_BYTES = 12;
const PREFIX = "v1";

export class MissingCredentialsKeyError extends Error {}
export class SecretDecryptError extends Error {}

/**
 * The key, from CREDENTIALS_KEY: 32 bytes, base64 or hex.
 *
 * Deliberately not derived from JWT_SECRET. They have different lifetimes — rotating a
 * session secret signs everyone out, which is cheap; rotating this one makes every stored
 * credential unreadable, which is not. Tying them together means you cannot do the cheap
 * one without the expensive one.
 */
export function credentialsKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = (env.CREDENTIALS_KEY ?? "").trim();
  if (!raw) {
    throw new MissingCredentialsKeyError(
      "CREDENTIALS_KEY is not set, so connector credentials cannot be encrypted. " +
        "Generate one with `openssl rand -base64 32` and set it before storing any. " +
        "Refusing rather than writing a customer's vendor secret in the clear."
    );
  }
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== KEY_BYTES) {
    throw new MissingCredentialsKeyError(
      `CREDENTIALS_KEY must decode to ${KEY_BYTES} bytes, got ${buf.length}. ` +
        "Generate one with `openssl rand -base64 32`."
    );
  }
  return buf;
}

/** Whether storing a credential is possible at all. Lets a caller say so before trying. */
export function canEncrypt(env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    credentialsKey(env);
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plaintext: string, env: NodeJS.ProcessEnv = process.env): string {
  const key = credentialsKey(env);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decryptSecret(blob: string, env: NodeJS.ProcessEnv = process.env): string {
  const key = credentialsKey(env);
  const parts = String(blob ?? "").split(".");
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new SecretDecryptError("Stored credential is not in the expected format.");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Wrong key, or tampered ciphertext. Both mean "do not use this", and the caller
    // must not be able to tell them apart from the message.
    throw new SecretDecryptError(
      "Stored credential could not be decrypted — CREDENTIALS_KEY may have changed since it was saved."
    );
  }
}

/**
 * What to show a person who already saved a credential.
 *
 * Never the value. A settings page that renders the secret back is a secret that leaks
 * into screenshots, support tickets and shoulder-surfing, and there is no reason to: the
 * only question a person has is "is the right one saved", which four characters answers.
 */
export function maskSecret(plaintext: string): string {
  const s = String(plaintext ?? "");
  if (s.length <= 4) return "••••";
  return `••••${s.slice(-4)}`;
}
