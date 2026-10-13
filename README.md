# Vernovi GRC (insurancerp)

Configurable governance, risk and compliance platform for a multi-entity, multi-regulator financial
group with an insurer at its core, built to the PRD "GRC Platform PRD".

The group is modelled as legal entities (licence, regulators, applicable frameworks, own appetite).
Every record belongs to an entity or is group-wide; dashboards roll up across entities with an entity
switcher for drill-down, and walled entities (for example a PFA or a bank) are hidden from people who
are not members of them, in lists, search, exports, the API and board packs.

One record-and-workflow engine; every register below is configuration stored in the database
and editable by administrators (Settings, Registers, fields and workflows).

| Module | Registers |
| --- | --- |
| Enterprise risk (core) | Objectives, risk appetite (group and entity), risk register, controls (with line of defence), KRIs incl. capital against requirement, loss events (NGN/USD, thresholds), emerging risks, risk acceptances, model inventory |
| ORSA and declarations | ORSA workbook compiled from the register, Risk Management Declaration (two different directors), Financial Condition Report |
| Policies | Policy library with approval tiers, attestation campaigns, exceptions |
| Compliance | Frameworks, obligations, control tests, findings, regulatory change, returns calendar, product governance, training |
| Actions | One action log for every source, extensions, independent validation, board and committee meetings |
| Declarations | Conflicts, gifts, outside interests, related parties, personal dealing, fit and proper; nil returns auto-file |
| Cases | Incidents, complaints, claims fraud, whistleblowing, AML/CFT, data breaches, regulatory breaches, HSE, with regulatory clocks and confidentiality walls |
| ESG and HSE | ESG metrics with Scope 1/2 emissions, underwriting screens, HSE inspections, permits |
| Third parties | Register with automatic tiering (incl. intra-group providers and fund trustees), reinsurer security, licences, assessments, outsourcing notifications (30 days, then six-monthly) |
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
- Returns calendar: owners are reminded 14, 7 and 1 days before a due date; the day after it is missed
  Compliance and the CRO who can see the entity are alerted daily for a week, then weekly. Filing a
  recurring return schedules the next period.
- Claims and claims complaints carry a 60-day clock (NIIRA 2025 s.210). The Risk Management Declaration
  needs two different directors; ORSA approval is for directors only (no admin bypass).

## Running

```bash
npm install
npm run dev          # http://localhost:3000, embedded demo database in ./.pglite
npm test             # business rules and end-to-end workflow tests
```

Without `DATABASE_URL` the app uses an embedded Postgres (PGlite) seeded with a fictional group,
"Demo Financial Group" (labelled FICTIONAL DEMO DATA in the app). Demo accounts are
role-named, e.g. `group.cro@demofinancial.example` (full list in `lib/db/seed.ts` and below). On localhost they use the local default
password in `lib/db/seed.ts`; a deployed demo (Vercel) uses `DEMO_PASSWORD`, and without it a random
password nobody knows, so the public site never runs on a published password. Changing
`DEMO_PASSWORD` and redeploying rotates the demo accounts' password on the next boot.

| Email (@demofinancial.example) | Person | Role in the demo |
|---|---|---|
| admin | Olumide Bankole | Platform administrator (MFA required) |
| group.cro | Adaeze Okafor | Group Chief Risk Officer (all entities) |
| head.erm | Tunde Bakare | Head of Enterprise Risk, Demo Insurance |
| group.cco | Ngozi Eze | Group CCO, Head of Enterprise Assurance, MLRO |
| compliance.officer | Zainab Lawal | Compliance Officer, Demo Insurance |
| pensions.risk | Hauwa Sani | Risk and Compliance, Demo Pensions (walled) |
| asset.mgmt.risk | Kunle Ajayi | Head of Risk, Demo Asset Management |
| mfb.compliance | Tobi Fashola | Risk and Compliance, Demo Microfinance Bank (walled) |
| infra.bank.cco | Musa Garba | CCO, Demo Infrastructure Bank (walled) |
| chief.auditor | Ibrahim Musa | Group Chief Internal Auditor (third line) |
| investigator | Chidi Okonkwo | Head of Investigations |
| hse.esg | Halima Bello | Group HSE and Sustainability Lead |
| erm.committee.chair | Kemi Adebayo | Director, Chair of ERM Committee |
| independent.director | Ifeoma Nnaji | Independent Non-Executive Director |
| group.cfo | Bola Ogunleye | Group CFO (first line) |
| group.cio | Segun Alabi | Group CIO (first line) |
| head.claims | Funmi Adeyemi | Head of Claims, Demo Insurance |
| head.underwriting | Emeka Nwosu | Head of Underwriting, Demo Insurance |
| head.actuarial | Amaka Obi | Head of Actuarial, Demo Insurance |
| risk.champion | Yusuf Danjuma | Branch manager and risk champion |

The login page never lists accounts or passwords. `SHOW_DEMO_HINTS=true` only adds a note that trial
details come from your Vernovi contact.

## Sign-in and MFA

Passwords are scrypt-hashed; sessions are signed cookies bound to the account. Two-step sign-in uses
TOTP (RFC 6238, any authenticator app). It is mandatory for administrators, who enrol with a QR code
at their first sign-in; an administrator can require it for anyone and reset a lost device in
Settings. Everyone else can turn it on from My account.

## Deploying on Vercel with Neon

1. Import this repo into Vercel (framework: Next.js).
2. Storage > Create Database > Neon. This injects `DATABASE_URL`. The schema and seed data are created
   on first request; no migration step is needed.
3. Set `CRON_SECRET` so the daily reminder job can run. For the demo, set `DEMO_PASSWORD` (12+ characters). `SESSION_SECRET` is optional: without it a random
   signing key is generated in the database on first boot. For a production client, set
   `SEED_DEMO=false`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` to start with a single administrator.
   With `SEED_DEMO=false` the seed never truncates anything. In demo mode, only a database this code
   seeded as a demo is ever reset (when `SEED_VERSION` in `lib/db/seed.ts` changes), and a reseed
   rotates the session signing key.

Hosting: functions are pinned to `lhr1` (London) and the Neon database is in London. The trial runs in
the UK on fictional data; Nigeria data residency and the NDPA transfer basis are settled before go-live.
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
- Clock lengths in `lib/engine/pure.ts` (CASE_CLOCK_DAYS, with CASE_CLOCK_BASIS) marked "internal"
  or "to confirm" must be agreed with the client; return deadlines marked "to confirm" in the seed
  (quarterly ORSA/ERM returns, NGX and SEC dates) need checking against the rulebooks.
- TOTP secrets are stored in the database unencrypted; encrypt them with a key held outside the
  database before production.
- PenCom, SEC and CBN framework packs are placeholders until sourced.
