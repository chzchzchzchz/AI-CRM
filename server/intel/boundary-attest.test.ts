import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { AccountBrief } from "./brief";
import {
  createAccountBriefHandoff,
  verifyAccountBriefHandoff,
} from "./boundary-attest";

const keyPair = () =>
  generateKeyPairSync("ed25519", {
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

const brief = (): AccountBrief =>
  ({
    accountId: 42,
    accountName: "Synthetic Account",
    markdown: "# Synthetic Account\n\nEvidence-backed brief.\n",
    judgement: {
      situation: "Intent is rising.",
      whyNow: [{ point: "Intent moved", evidence: "intent.score: 82" }],
      actions: [],
      risks: [],
    },
    signals: {
      account: { id: 42, name: "Synthetic Account" },
      intent: { score: 82 },
      generatedAt: "2026-10-28T00:00:00.000Z",
    },
    metrics: { intentScore: 82 },
    signalHash: "0123456789abcdef0123456789abcdef",
    version: 3,
    generatedAt: "2026-10-28T00:00:00.000Z",
    cached: false,
    degraded: false,
    degradedReason: null,
    validation: { dropped: [] },
  }) as AccountBrief;

describe("TargetDash BoundaryAttest account-brief handoff", () => {
  it("verifies an unchanged artifact with the independently supplied public key", () => {
    const keys = keyPair();
    const handoff = createAccountBriefHandoff(brief(), keys.privateKey, {
      eventId: "targetdash-fixture-1",
      timestamp: "2026-10-28T00:00:01.000Z",
    });

    expect(verifyAccountBriefHandoff(handoff, keys.publicKey)).toEqual({ ok: true });
    expect(handoff.receipt.claim.receipt_role).toBe("server_attested");
    expect(handoff.receipt.claim.action_type).toBe("targetdash.account_brief_handoff");
  });

  it("rejects changed delivered artifact bytes", () => {
    const keys = keyPair();
    const handoff = createAccountBriefHandoff(brief(), keys.privateKey, {
      eventId: "targetdash-fixture-2",
      timestamp: "2026-10-28T00:00:01.000Z",
    });

    handoff.artifact = handoff.artifact.replace("Evidence-backed", "Evidence-faked!");
    expect(verifyAccountBriefHandoff(handoff, keys.publicKey)).toEqual({
      ok: false,
      reason: "artifact_digest_mismatch",
    });
  });

  it("rejects a receipt verified with a different expected public key", () => {
    const signer = keyPair();
    const other = keyPair();
    const handoff = createAccountBriefHandoff(brief(), signer.privateKey);

    expect(verifyAccountBriefHandoff(handoff, other.publicKey)).toEqual({
      ok: false,
      reason: "public_key_id_mismatch",
    });
  });

  it("rejects signed-claim tampering", () => {
    const keys = keyPair();
    const handoff = createAccountBriefHandoff(brief(), keys.privateKey);
    handoff.receipt.claim.status = "tampered";

    expect(verifyAccountBriefHandoff(handoff, keys.publicKey)).toEqual({
      ok: false,
      reason: "invalid_signature",
    });
  });
});
