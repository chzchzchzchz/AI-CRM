# Security

This is a personal portfolio project, not a maintained product. There's no security team and no
response SLA — but the app reads a CRM, so the posture is written down honestly rather than
implied.

## Reporting something

If you find a vulnerability, please don't open a public issue. Use GitHub's
[Security Advisories](https://github.com/chzchzchzchz/AI-CRM/security/advisories/new)
(Security → Report a vulnerability) or email mohssinechazi@gmail.com. I'll credit you unless you'd
rather stay anonymous. I read these, but I'm one person — expect days, not hours.

## What's implemented

- No hardcoded secrets — environment variables and a gitignored `config/`
- Parameterized queries throughout (Drizzle); no string-built SQL
- Email/password auth with session cookies, login lockout, and audit logging
- TOTP two-factor at `/security`, enforced at login; recovery codes from `crypto.randomBytes`,
  stored bcrypt-hashed, single-use
- `SameSite` negotiated per request: `None; Secure` over HTTPS, `Lax` over plain HTTP
- A weak or missing `JWT_SECRET` refuses to sign in production
- CORS hardened; rate limiting scoped to `/api`
- Untrusted text (transcripts, scraped pages, pasted input, prior model output) is fenced before
  it reaches a prompt, with per-interpolation test coverage
- `pnpm audit` clean, enforced in CI

## What's not

- **Nobody has audited this but me.** No pentest, no third-party review, no SOC 2 anything.
- **Single-tenant.** There is no org isolation between users of one deployment.
- **Connectors are unproven against live paid accounts** — the clients are real and unit-tested
  against mocked transports.

## If you actually deploy it

You own the deployment's security posture — TLS, network exposure, secret storage, DB access.

- `DEMO_MODE=true` **bypasses authentication by design** and serves synthetic data. Never run it
  on a public deployment, and never against real data.
- For anything real: `DEMO_MODE=false`, a strong `JWT_SECRET`, a real `DATABASE_URL`, HTTPS in
  front, and change or remove the seeded demo user.
- Run `pnpm doctor` — it catches misconfigurations that otherwise fail silently.
