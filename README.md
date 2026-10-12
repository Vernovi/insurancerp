# Vernovi GRC (insurancerp)

Configurable governance, risk and compliance platform for multi-line insurers, built to the PRD
"GRC Platform PRD: ERM and Nine Modules for a Multi-Line Insurer".

One record-and-workflow engine; every register below is configuration stored in the database
and editable by administrators (Settings, Registers, fields and workflows).

| Module | Registers |
| --- | --- |
| Enterprise risk (core) | Objectives, risk appetite, risk register, controls, KRIs, loss events, emerging risks, risk acceptances, model inventory |
| Policies | Policy library with approval tiers, attestation campaigns, exceptions |
| Compliance | Frameworks, obligations, control tests, findings, regulatory change, returns calendar, product governance, training |
| Actions | One action log for every source, extensions, independent validation, board and committee meetings |
| Declarations | Conflicts, gifts, outside interests, related parties, personal dealing, fit and proper; nil returns auto-file |
| Cases | Incidents, complaints, claims fraud, whistleblowing, AML/CFT, data breaches, regulatory breaches, HSE, with regulatory clocks and confidentiality walls |
| ESG and HSE | ESG metrics with Scope 1/2 emissions, underwriting screens, HSE inspections, permits |
| Third parties | Register with automatic tiering, reinsurer security, NAICOM licences, assessments |
| Internal audit | Audit universe with priority scoring, plan, engagements, working papers, findings |
| Continuity | Important business services, BIAs, plans, exercises |

ISO 27001 and other security frameworks, IT and cyber risk, DPIAs and data privacy management are
deliberately not rebuilt: they come from SecureComply (set `SECURECOMPLY_API_URL`).

## Cross-module rules (lib/engine/hooks.ts)

- Residual score is tested against the approved appetite for the risk's category; an active risk
  outside appetite automatically gets an "Appetite breach" action and the CRO is notified.
- A failed control test, once signed off, downgrades the control, raises a finding and a remediation action.
- Nil annual declarations file automatically; broker, reinsurer, claimant and supplier conflicts and
  large gifts route to Compliance.
- Closing a case with a write-off posts a loss event to ERM.
- A continuity exercise that misses impact tolerance raises an ERM risk linked to the service.
- KRIs turning red notify the owner and CRO. Four-eyes rules stop people approving what they raised.

## Running

```bash
npm install
npm run dev          # http://localhost:3000, embedded demo database in ./.pglite
npm test             # business rules and end-to-end workflow tests
```

Without `DATABASE_URL` the app uses an embedded Postgres (PGlite) seeded with a fictional Nigerian
multi-line insurer. Demo password for all accounts: `Demo!2026grc` (override with `DEMO_PASSWORD`).

## Deploying on Vercel with Neon

1. Import this repo into Vercel (framework: Next.js).
2. Storage > Create Database > Neon. This injects `DATABASE_URL`. The schema and seed data are created
   on first request; no migration step is needed.
3. Set `CRON_SECRET` so the daily reminder job can run. `SESSION_SECRET` is optional: without it a random
   signing key is generated in the database on first boot. For a production client, set
   `SEED_DEMO=false`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` to start with a single administrator.
4. Daily reminders and escalations run from `vercel.json` cron at 06:00 UTC.

## API

Create a token in Settings, then:

```bash
curl -H "Authorization: Bearer grc_..." "https://<host>/api/v1/records?type=risk&status=active"
curl -X POST -H "Authorization: Bearer grc_..." -H "Content-Type: application/json" \
  -d '{"type":"case","title":"Complaint from broker","data":{"case_type":"Customer complaint","reported_date":"2026-10-12","description":"..."}}' \
  https://<host>/api/v1/records
```

## Known gaps before production

- Sign-in is email and password; Entra ID SSO (PLT-20) is the next integration.
- Notifications are in-app; email and Teams delivery need a provider.
- Regulatory clock lengths in `lib/engine/pure.ts` (CASE_CLOCK_DAYS) must be confirmed against
  current NAICOM, NFIU and NDPC rules with the client.
