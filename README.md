# InsuranceRP

InsuranceRP is Vernovi’s governance, risk and compliance workspace for a multi-line insurer. This repository is the client trial: a signed-in register, a Risk Committee pack, and demo data for **Harbourline Assurance Plc**, a fictional Lagos insurer writing motor, property, marine, energy, health, life and aviation.

The product specification is in [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md).

## Run it locally

Requirements: Node.js 22.

```bash
npm install
npm run setup
npm run dev
```

Open http://localhost:3000.

`npm run setup` creates the SQLite database and loads the Harbourline demo. Run it again any time you want the trial data back.

## Run it with Docker

```bash
docker compose up --build
```

The first start loads the same demo data into a volume. To start over:

```bash
docker compose down -v
docker compose up --build
```

Set `AUTH_SECRET` to a long random string before anyone other than the trial team can reach the app. Leave `AUTH_COOKIE_SECURE` unset (or `false`) when the trial is served over plain HTTP. Set it to `true` only behind HTTPS, or the browser will not keep the sign-in cookie.

Uploads and the database live in the `insurancerp-data` volume (`/data` in the container).

## Demo accounts

Password for every account: `Demo-Harbourline-2026`

| Person | Role | Email |
| --- | --- | --- |
| Adaeze Okonkwo | Admin | ada.okonkwo@harbourline.example |
| Efe Adeyemi | Risk manager | efe.adeyemi@harbourline.example |
| Chioma Nwosu | Compliance officer | chioma.nwosu@harbourline.example |
| Tunde Bakare | Staff (motor and property underwriting) | tunde.bakare@harbourline.example |
| Ireti Balogun | Board viewer (Risk Committee chair) | ireti.balogun@harbourline.example |

Other colleagues in the seed (claims, health, life, marine and energy, finance, IT, audit, distribution, human capital) use the same password. Their addresses are `firstname.lastname@harbourline.example`.

Harbourline, its people and its figures are invented. The tenant is a multi-line insurer. It is not a real company.

## What to show in the trial

1. Sign in as Efe and open the register. Filter by line (motor, property, marine, energy, health, life). Open an above-appetite risk and the 5×5 heat map.
2. Sign in as Ireti and open **Risk Committee**. Export the PDF and the Excel pack.
3. Sign in as Chioma. Open the NAICOM framework (wording is from the published guideline, with the source on each element), then a policy version, then the declaration queue.
4. Sign in as Tunde. Open the annual code of conduct. The linked policies have to be attested before it can be submitted.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

GitHub Actions runs the same sequence on pull requests.

## Deployment notes

- The trial build is one Next.js app and a SQLite file. That is enough for a single-company walkthrough on one server.
- Demo data is loaded by `npm run setup` or by the container entrypoint when the database has no users.
- Evidence files are stored on disk (`UPLOAD_DIR`, default `./data/uploads`).
- There is no SSO and no outbound email. Roles are admin, risk manager, compliance officer, staff and board viewer.
- A later production cutover would point `DATABASE_URL` at Postgres and keep the same Prisma models. This trial does not run Postgres.
- NAICOM coverage is Part A, Section 6 of the Revised Prudential Guidelines (1 October 2022), cited in the seed. ISO 31000 and ISO/IEC 27001 are loaded as titles only, because the standard text is not reproduced.
