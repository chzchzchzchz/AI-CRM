import {
  createHash,
  createPublicKey,
  randomUUID,
  sign,
  verify,
} from "node:crypto";
import { readFileSync } from "node:fs";
import type { AccountBrief } from "./brief";

/**
 * BoundaryAttest Interop Profile v0.2 adapter for TargetDash account-brief handoffs.
 *
 * The signature commits only to the signed claim. The claim, in turn, binds the exact
 * UTF-8 artifact bytes emitted by buildAccountBriefHandoffArtifact(). TargetDash remains
 * authoritative for signal computation, judgement validation, and what the brief means.
 *
 * RFC 8785/JCS canonicalization below is adapted from BoundaryAttest's MIT-licensed v0.2
 * reference implementation so the emitted envelope is compatible with its shared vectors:
 * https://github.com/cullenmeyers/BoundaryAttest/blob/main/src/jcs.ts
 */

export const TARGETDASH_HANDOFF_SCHEMA = "targetdash/account-brief-handoff/v1";
export const TARGETDASH_HANDOFF_ACTION = "targetdash.account_brief_handoff";
export const TARGETDASH_HANDOFF_MEDIA_TYPE =
  "application/vnd.targetdash.account-brief-handoff+json";

export type BoundaryAttestV02Receipt = {
  claim: Record<string, unknown>;
  signature: string;
  public_key_id: string;
};

export type AccountBriefHandoff = {
  artifact: string;
  receipt: BoundaryAttestV02Receipt;
};

export type HandoffVerification =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "invalid_receipt"
        | "unsupported_version"
        | "unsupported_receipt_role"
        | "wrong_action_type"
        | "public_key_id_mismatch"
        | "invalid_signature"
        | "invalid_targetdash_extension"
        | "artifact_digest_mismatch"
        | "artifact_length_mismatch"
        | "artifact_semantics_mismatch";
    };

function assertWellFormedUnicode(value: string, path: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new TypeError(`${path}: lone high surrogate is not I-JSON`);
      }
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new TypeError(`${path}: lone low surrogate is not I-JSON`);
    }
  }
}

function compareUtf16(a: string, b: string): number {
  const shared = Math.min(a.length, b.length);
  for (let index = 0; index < shared; index += 1) {
    const difference = a.charCodeAt(index) - b.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return a.length - b.length;
}

function canonicalize(value: unknown, path: string, ancestors: Set<object>): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "string":
      assertWellFormedUnicode(value, path);
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) {
        throw new TypeError(`${path}: non-finite number is not JSON`);
      }
      return JSON.stringify(value);
    case "undefined":
    case "bigint":
    case "function":
    case "symbol":
      throw new TypeError(`${path}: unsupported non-JSON value (${typeof value})`);
  }

  if (ancestors.has(value)) throw new TypeError(`${path}: cyclic value is not JSON`);
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const elements: string[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          throw new TypeError(`${path}[${index}]: sparse array holes are not JSON values`);
        }
        elements.push(canonicalize(value[index], `${path}[${index}]`, ancestors));
      }
      const extraKeys = Reflect.ownKeys(value).filter(
        key =>
          key !== "length" &&
          !(
            typeof key === "string" &&
            /^(0|[1-9]\d*)$/.test(key) &&
            Number(key) < value.length
          )
      );
      if (extraKeys.length > 0) {
        throw new TypeError(`${path}: arrays with extra properties are unsupported`);
      }
      return `[${elements.join(",")}]`;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`${path}: unsupported non-JSON object type`);
    }
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some(key => typeof key === "symbol")) {
      throw new TypeError(`${path}: symbol property keys are unsupported`);
    }
    const keys = (ownKeys as string[]).sort(compareUtf16);
    const members = keys.map(key => {
      assertWellFormedUnicode(key, `${path} property name`);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !("value" in descriptor)) {
        throw new TypeError(
          `${path}.${key}: accessors and non-enumerable properties are unsupported`
        );
      }
      return `${JSON.stringify(key)}:${canonicalize(
        descriptor.value,
        `${path}.${key}`,
        ancestors
      )}`;
    });
    return `{${members.join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

function jcsCanonicalBytes(value: unknown): Buffer {
  return Buffer.from(canonicalize(value, "$", new Set<object>()), "utf8");
}

function sha256Hex(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function publicKeyId(publicKeyPem: string): string {
  const der = createPublicKey(publicKeyPem).export({ type: "spki", format: "der" });
  return `sha256:${sha256Hex(der)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function targetDashExtension(receipt: BoundaryAttestV02Receipt): Record<string, unknown> | null {
  const extension = receipt.claim.targetdash_account_brief;
  return isRecord(extension) ? extension : null;
}

/**
 * Exact artifact delivered to the relying party. The trailing newline is intentional and
 * covered by the digest. The artifact contains the same validated brief surface TargetDash
 * already returns, including its SignalPack, so evidence strings remain inspectable after
 * handoff without inventing a second evidence model.
 */
export function buildAccountBriefHandoffArtifact(
  brief: AccountBrief,
  options: { eventId: string; timestamp: string }
): string {
  return (
    JSON.stringify(
      {
        schema: TARGETDASH_HANDOFF_SCHEMA,
        eventId: options.eventId,
        exportedAt: options.timestamp,
        accountId: brief.accountId,
        accountName: brief.accountName,
        briefVersion: brief.version,
        generatedAt: brief.generatedAt,
        signalHash: brief.signalHash,
        cached: brief.cached,
        degraded: brief.degraded,
        degradedReason: brief.degradedReason,
        validation: brief.validation,
        markdown: brief.markdown,
        judgement: brief.judgement,
        metrics: brief.metrics,
        signals: brief.signals,
      },
      null,
      2
    ) + "\n"
  );
}

export function createAccountBriefHandoff(
  brief: AccountBrief,
  privateKeyPem: string,
  options: { eventId?: string; timestamp?: string } = {}
): AccountBriefHandoff {
  const eventId = options.eventId ?? randomUUID();
  const timestamp = options.timestamp ?? new Date().toISOString();
  const artifact = buildAccountBriefHandoffArtifact(brief, { eventId, timestamp });
  const artifactBytes = Buffer.from(artifact, "utf8");
  const publicKeyPem = createPublicKey(privateKeyPem)
    .export({ type: "spki", format: "pem" })
    .toString();

  const claim: Record<string, unknown> = {
    receipt_version: "0.2",
    receipt_role: "server_attested",
    event_id: eventId,
    timestamp,
    action_type: TARGETDASH_HANDOFF_ACTION,
    status: "exported",
    targetdash_account_brief: {
      artifact: {
        schema: TARGETDASH_HANDOFF_SCHEMA,
        media_type: TARGETDASH_HANDOFF_MEDIA_TYPE,
        representation: "raw_utf8_bytes",
        sha256: sha256Hex(artifactBytes),
        bytes: artifactBytes.byteLength,
      },
      brief: {
        account_id: brief.accountId,
        signal_hash: brief.signalHash,
        brief_version: brief.version,
        generated_at: brief.generatedAt,
        markdown_sha256: sha256Hex(Buffer.from(brief.markdown, "utf8")),
        dropped_claim_count: brief.validation.dropped.length,
        degraded: brief.degraded,
      },
      adapter: {
        identity: "targetdash-boundaryattest-account-brief-v0.2",
        scope:
          "attest exact exported TargetDash account-brief handoff bytes and correlate native brief metadata only",
      },
    },
  };

  return {
    artifact,
    receipt: {
      claim,
      signature: sign(null, jcsCanonicalBytes(claim), privateKeyPem).toString("base64"),
      public_key_id: publicKeyId(publicKeyPem),
    },
  };
}

/**
 * Relying-party verification for this adapter. The expected public key must come from
 * trusted configuration; receiving a public key beside an untrusted receipt is not a trust
 * decision. Passing this check proves only expected-key possession, claim integrity, and
 * exact artifact-byte binding.
 */
export function verifyAccountBriefHandoff(
  handoff: AccountBriefHandoff,
  expectedPublicKeyPem: string
): HandoffVerification {
  const { receipt, artifact } = handoff;
  if (
    !isRecord(receipt) ||
    !isRecord(receipt.claim) ||
    typeof receipt.signature !== "string" ||
    typeof receipt.public_key_id !== "string"
  ) {
    return { ok: false, reason: "invalid_receipt" };
  }
  const topLevelKeys = Object.keys(receipt).sort();
  if (
    topLevelKeys.length !== 3 ||
    topLevelKeys[0] !== "claim" ||
    topLevelKeys[1] !== "public_key_id" ||
    topLevelKeys[2] !== "signature" ||
    typeof receipt.claim.event_id !== "string" ||
    typeof receipt.claim.timestamp !== "string" ||
    typeof receipt.claim.action_type !== "string" ||
    typeof receipt.claim.status !== "string"
  ) {
    return { ok: false, reason: "invalid_receipt" };
  }

  if (receipt.claim.receipt_version !== "0.2") {
    return { ok: false, reason: "unsupported_version" };
  }
  if (receipt.claim.receipt_role !== "server_attested") {
    return { ok: false, reason: "unsupported_receipt_role" };
  }
  if (receipt.claim.action_type !== TARGETDASH_HANDOFF_ACTION) {
    return { ok: false, reason: "wrong_action_type" };
  }

  let expectedKeyId: string;
  try {
    expectedKeyId = publicKeyId(expectedPublicKeyPem);
  } catch {
    return { ok: false, reason: "public_key_id_mismatch" };
  }
  if (receipt.public_key_id !== expectedKeyId) {
    return { ok: false, reason: "public_key_id_mismatch" };
  }

  try {
    const valid = verify(
      null,
      jcsCanonicalBytes(receipt.claim),
      expectedPublicKeyPem,
      Buffer.from(receipt.signature, "base64")
    );
    if (!valid) return { ok: false, reason: "invalid_signature" };
  } catch {
    return { ok: false, reason: "invalid_signature" };
  }

  const extension = targetDashExtension(receipt);
  const artifactClaim = extension && isRecord(extension.artifact) ? extension.artifact : null;
  if (
    !artifactClaim ||
    artifactClaim.schema !== TARGETDASH_HANDOFF_SCHEMA ||
    artifactClaim.media_type !== TARGETDASH_HANDOFF_MEDIA_TYPE ||
    artifactClaim.representation !== "raw_utf8_bytes" ||
    typeof artifactClaim.sha256 !== "string" ||
    typeof artifactClaim.bytes !== "number"
  ) {
    return { ok: false, reason: "invalid_targetdash_extension" };
  }

  const bytes = Buffer.from(artifact, "utf8");
  if (artifactClaim.bytes !== bytes.byteLength) {
    return { ok: false, reason: "artifact_length_mismatch" };
  }
  if (artifactClaim.sha256 !== sha256Hex(bytes)) {
    return { ok: false, reason: "artifact_digest_mismatch" };
  }

  let parsedArtifact: unknown;
  try {
    parsedArtifact = JSON.parse(artifact);
  } catch {
    return { ok: false, reason: "artifact_semantics_mismatch" };
  }
  if (
    !isRecord(parsedArtifact) ||
    parsedArtifact.schema !== TARGETDASH_HANDOFF_SCHEMA ||
    parsedArtifact.eventId !== receipt.claim.event_id ||
    parsedArtifact.exportedAt !== receipt.claim.timestamp
  ) {
    return { ok: false, reason: "artifact_semantics_mismatch" };
  }

  const briefClaim = extension && isRecord(extension.brief) ? extension.brief : null;
  if (
    !briefClaim ||
    parsedArtifact.accountId !== briefClaim.account_id ||
    parsedArtifact.signalHash !== briefClaim.signal_hash ||
    parsedArtifact.briefVersion !== briefClaim.brief_version ||
    parsedArtifact.generatedAt !== briefClaim.generated_at ||
    typeof parsedArtifact.markdown !== "string" ||
    sha256Hex(Buffer.from(parsedArtifact.markdown, "utf8")) !== briefClaim.markdown_sha256
  ) {
    return { ok: false, reason: "artifact_semantics_mismatch" };
  }

  return { ok: true };
}

export function loadBoundaryAttestPrivateKey(): string {
  const inline = process.env.BOUNDARY_ATTEST_PRIVATE_KEY_PEM?.replace(/\\n/g, "\n").trim();
  const file = process.env.BOUNDARY_ATTEST_PRIVATE_KEY_FILE?.trim();

  if (inline && file) {
    throw new Error(
      "Set only one of BOUNDARY_ATTEST_PRIVATE_KEY_PEM or BOUNDARY_ATTEST_PRIVATE_KEY_FILE"
    );
  }
  if (inline) return `${inline}\n`;
  if (file) {
    try {
      return readFileSync(file, "utf8");
    } catch {
      throw new Error("BoundaryAttest private key file could not be read.");
    }
  }

  throw new Error(
    "BoundaryAttest signing is not configured. Set BOUNDARY_ATTEST_PRIVATE_KEY_FILE " +
      "or BOUNDARY_ATTEST_PRIVATE_KEY_PEM."
  );
}
