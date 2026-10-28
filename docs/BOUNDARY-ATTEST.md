# BoundaryAttest account-brief handoff

TargetDash can optionally sign a portable handoff of a **final served account brief** using the
experimental [BoundaryAttest Interop Profile v0.2](https://github.com/cullenmeyers/BoundaryAttest/blob/main/docs/interop-profile-v0.2.md).

This is deliberately outside normal brief generation. Signal computation and claim validation stay
exactly as they are; signing is only performed when an external caller explicitly requests an
`intel.accountBriefHandoff`. Because the artifact contains the full served SignalPack, it may contain
CRM/contact data; request and transmit it only when that handoff is intentional.

## What is signed

The endpoint returns two values:

- `artifact`: the exact UTF-8 JSON document being handed off, including the final brief, structured
  judgement, validation result, metrics, and SignalPack;
- `receipt`: a strict BoundaryAttest v0.2 envelope whose signed claim binds the SHA-256 and byte
  length of that exact artifact.

The signed TargetDash extension also carries the native `signalHash`, brief version and generation
time, a SHA-256 of the rendered Markdown, dropped-claim count, and degraded state. The native
`signalHash` keeps its existing TargetDash meaning; it is **not** substituted for the full SHA-256
of the exported artifact bytes.

## What verification means

A passing receipt + artifact verification means only:

1. the receipt was signed by the independently expected Ed25519 public key;
2. the signed claim was not modified; and
3. the exact artifact bytes still match the digest and length the signer committed to.

It does **not** prove that CRM source data was complete or correct, that a model judgement was wise,
that a connector returned truthful data, that the runtime was uncompromised, or that a recommended
sales action should be taken. TargetDash remains authoritative for its own signal and validation
semantics.

## Configure signing

Generate a dedicated Ed25519 key and keep the private key outside the repository and model/agent
inputs:

```bash
openssl genpkey -algorithm Ed25519 -out targetdash-boundaryattest-private.pem
openssl pkey -in targetdash-boundaryattest-private.pem -pubout \
  -out targetdash-boundaryattest-public.pem
```

Prefer a mounted secret file:

```bash
BOUNDARY_ATTEST_PRIVATE_KEY_FILE=/run/secrets/targetdash-boundaryattest-private.pem
```

An inline secret is also supported for deployment platforms that only expose environment secrets:

```bash
BOUNDARY_ATTEST_PRIVATE_KEY_PEM='-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'
```

Set **only one** of the two variables. If neither is configured, normal TargetDash behavior is
unchanged and `intel.accountBriefHandoff` refuses to sign.

Give relying parties the public key through a separately trusted channel. A public key received
only beside an untrusted receipt is not, by itself, a trust decision.
