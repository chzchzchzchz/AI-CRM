# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, report it privately via GitHub's
[**Security Advisories**](https://github.com/chzchzchzchz/AI-CRM/security/advisories/new)
(Security → Report a vulnerability). We aim to acknowledge reports within a few days
and will credit you in the advisory unless you prefer to remain anonymous.

## Scope & notes

- This is an **open-core, self-hosted** app. You run it in your own environment, so you
  own the deployment's security posture (TLS, network exposure, secret storage, DB access).
- **Never commit real secrets.** All keys live in environment variables / `config/` (both
  gitignored). See `.env.example`.
- **Demo mode** (`DEMO_MODE=true`) bypasses authentication and serves synthetic data only —
  never run demo mode on a public deployment with real data.
- For production: set `DEMO_MODE=false`, a strong `JWT_SECRET`, a real `DATABASE_URL`, and
  put the app behind HTTPS.
