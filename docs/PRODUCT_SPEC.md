# InsuranceRP product specification

InsuranceRP is Vernovi’s governance, risk and compliance workspace for a Nigerian insurer. This specification describes the trial the client can use this week. It was shaped by what a risk committee and regulator actually ask to see: a single register, an appetite the board has approved, evidence that can be produced, and a pack the Risk Committee can read without a spreadsheet reconstruction.

The fictional trial tenant is Harbourline Assurance Plc, a multi-line insurer in Lagos. It writes motor, property, marine, energy, health, life and other general classes. The company, its people and its figures are invented for the trial.

## 1. Who it is for

| Role | What they do in the trial |
| --- | --- |
| Admin | Full access, including people records. |
| Risk manager | Maintains the register, controls, KRIs, appetite escalation and risk actions. |
| Compliance officer | Maintains policies, frameworks, assessments, evidence and declaration review. |
| Staff | Attests policies, files declarations, updates actions they own, and sees their own objectives. |
| Board viewer | Read-only executive and Risk Committee views, including the board pack. |

A person has one role. Department and job title are recorded so ownership is visible on every record.

## 2. What the trial has to prove

Leadership should be able to open the product and answer, without exporting to Excel first:

- Which risks sit in the insurance book, who owns them, and whether inherent exposure has been reduced.
- Which risks sit above the limit the board set for that category, and which of those have been escalated.
- Whether controls exist, how effective they were last judged, and what evidence is attached.
- Which policies are in force, which version was approved, when they fall due for review, and who has attested.
- How far the company is through NAICOM’s risk-management guideline, the Nigeria Data Protection Act 2023, and selected ISO 31000 / ISO/IEC 27001 elements.
- Which actions are open or overdue, and which audit findings remain.
- Who has filed conflicts, gifts and the annual code of conduct, and which policy attestations that conduct declaration covers.
- Whether objectives and KPIs that management uses for appraisal are tied back to a risk or a compliance element.
- Who changed a risk, policy, control or action, and when.

## 3. Enterprise risk management

### Register

Every risk has a stable code, a title, a description, one insurance category, the line of business it sits in (motor, property, marine, energy, health, life, group life, aviation, investments, or enterprise-wide), a department, an owner, a treatment (mitigate, accept, transfer, avoid), a status, a trend, an optional “emerging” flag, and the strategic objective it threatens.

Categories are fixed:

- Underwriting
- Credit / investment
- Market
- Operational
- Compliance
- Cyber
- Third party
- Reputational
- Business continuity (BCP)

These are the categories the trial register uses. NAICOM’s own material-risk list (market/investment, credit, operational, liquidity, reinsurance, underwriting, reserving, claims, group, reputational, legal/litigation, and other risks) is preserved as compliance elements. Liquidity and reserving are discussed inside market and underwriting risks; reinsurance and outsourcing sit with third party; legal and conduct sit with compliance. The mapping is visible on the risk and on the framework, so the committee is not asked to pretend the two lists are the same thing.

### Scoring and heat map

Likelihood and impact are scored from 1 to 5, independently for inherent and residual risk.

| Score | Likelihood | Impact |
| --- | --- | --- |
| 1 | Rare | Negligible |
| 2 | Unlikely | Minor |
| 3 | Possible | Moderate |
| 4 | Likely | Major |
| 5 | Almost certain | Severe |

The score is likelihood × impact (1–25).

| Score | Band |
| --- | --- |
| 1–4 | Low |
| 5–9 | Medium |
| 10–15 | High |
| 16–25 | Severe |

The heat map is a 5×5 grid. It can show inherent or residual positions. A cell shows how many risks land there.

### Appetite and escalation

The board sets one residual-score limit per category, with a short statement and an owner. Position is calculated, not typed in:

- **Above appetite** when residual score is greater than the category limit.
- **Approaching** when residual score is still within the limit but at least 80% of it.
- **Within** otherwise.

“Risks above appetite” is a first-class flag on the register, the executive dashboard and the Risk Committee pack. A risk manager or admin escalates an above-appetite risk to the committee with a note. Escalation is recorded (who, when, note) and can later be marked acknowledged. Escalation does not by itself change the score.

### Controls and KRIs

Controls have a type (preventive, detective, corrective), an owner, a frequency, and an effectiveness judgement. They link to many risks and to compliance elements.

Key risk indicators have a unit, a direction (lower or higher is better), green and amber thresholds, a current value and a measurement date. Red, amber and green are calculated from the thresholds.

## 4. Policy management

The library holds policies with an owner, a status (draft, in review, approved, retired), a last review date and a next review date.

Each policy has versions. A version is drafted, submitted, then approved or rejected. Approval records the approver and time. The previously approved version is marked superseded. The policy status follows the latest workflow step.

Staff attestation is a campaign against a policy version’s policy, with a due date and a row per person (pending or attested).

Where a declaration campaign is the annual code of conduct, it names the policies that must be attested as part of that declaration. A person cannot submit the conduct declaration until those attestations are done. Submitting the declaration stores the link on each attestation. The declaration screen and the policy screen both show the link.

## 5. Compliance frameworks

A framework belongs to an authority and carries a citation and a source URL. It contains elements (requirements). Each element has the published reference, the wording we are allowed to store, and links to controls and policies.

An assessment is a judgement for a period: compliant, partial, non-compliant, or not assessed, with notes and an assessor. Evidence is a titled record, optionally with a file attached.

Compliance percentage uses assessed elements only:

- Compliant = 100
- Partial = 50
- Non-compliant = 0
- Not assessed is excluded from the denominator and shown as a count

The framework score is the average of its elements. The company score on the board pack is the average of framework scores that have at least one assessment.

### Sources, and what we will not invent

**NAICOM.** Elements are paragraph-level duties from Part A, Section 6 of the Revised Prudential Guidelines for Insurance Institutions in Nigeria, effective 1 October 2022, published by the National Insurance Commission. Wording is taken from that guideline. Spacing damage in the PDF text layer is repaired; duties and paragraph numbers are not rewritten and no extra clauses are added. Citation and source URL are stored on the framework and on every element.

Source: https://naicom.gov.ng/wp-content/uploads/2025/08/4_REVISED-PRUDENTIAL-GUIDELINES-FOR-INS-INSTIT-IN-NIG-OCT-2022.pdf

**NDPA.** Elements are operative duties from the Nigeria Data Protection Act 2023 (sections 24, 25, 26, 27, 28, 29, 32, 34, 39, 40, 41 and 44), cited to the Act. The older Nigeria Data Protection Regulation remains relevant as subsidiary practice, but this register does not invent NDPR clause text.

**ISO 31000:2018 and ISO/IEC 27001:2022.** Only publicly used element and control titles are loaded, so the standard text is not copied. The element states that the title is the reference and that the standard must be read for the requirement.

## 6. Action tracking

An action has an owner, a due date, a priority and a status (open, in progress, completed, cancelled). It can point at a risk, an audit or control finding, and a compliance element.

Overdue is calculated: the due date is before today and the status is not completed or cancelled. The action list and the dashboard can show overdue work on its own. Completing an action stamps the completion time.

Findings are assurance items (internal audit, external audit, regulator, control test) with severity and status. Actions hang off findings where remediation is underway.

## 7. Staff declarations

Three campaign types:

- Conflicts of interest
- Gifts and hospitality
- Annual code of conduct

A person saves a draft, submits it, and a compliance officer or admin approves or returns it with a note. The register shows completion for each campaign: not started, draft, submitted, approved, returned.

The code-of-conduct campaign is the one tied to policy attestation (section 4).

## 8. Performance

An objective has an owner, a department, a period, a weight and a status. It may point at one risk and one compliance element, so appraisal is not detached from the risk and compliance picture.

KPIs sit under an objective, with a target, a unit and a direction. A periodic score stores the actual result; the percentage score is calculated (capped at 100). An appraisal records the reviewer, a rating (exceeds, meets, partial, below), a narrative, and a specific note on risk and compliance behaviour.

## 9. Executive dashboard and Risk Committee pack

The home dashboard is the working view: risks above appetite, red KRIs, open and overdue actions, framework scores, policies due for review, declaration and attestation completion, and open findings. Staff see their own queue first.

The board view is the pack the Risk Committee chair opens:

- Top 10 risks by residual score
- Risks above appetite, with escalation state
- Open actions, including overdue
- Compliance score, by framework and overall
- Open audit findings

The same pack exports to PDF and to an Excel workbook (cover, top 10, above appetite, actions, compliance, findings, KRIs). CSV extracts are available for the risk register, actions and declarations.

## 10. Evidence and audit trail

Files can be attached to a risk, a policy, a control, an action, or a compliance evidence record. The trial stores files on disk and metadata in the database. Download requires a signed-in user.

The audit trail records sign-in, creates, updates, workflow decisions, attestation, escalation, uploads and exports. Events store the actor, role, entity, a short summary and optional detail. Risk, policy, control and action screens show their own history; a full trail is available to every signed-in role so a board viewer can see it.

## 11. Trial boundaries

In this build, on purpose:

- One company, signed in with email and password. No SSO and no email notifications.
- SQLite, so the trial starts with demo data and no separate database server. A later production cutover would move the same schema to Postgres.
- NAICOM coverage is Section 6 (risk management), not every chapter of the prudential guideline.
- ISO entries are titles only.
- There is no separate AI-governance module. AI-related exposure is a risk in the register if the company has one.
- No native mobile app. The layout is usable on a laptop width and stacks on a narrow screen.

These limits should be said out loud in the trial. They do not stop a risk committee walkthrough.
