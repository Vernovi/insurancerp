import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { DEMO_PASSWORD } from "../src/data/demo-accounts";
import {
  actions,
  appetite,
  appraisals,
  codeCompleteUserIds,
  codeSubmittedUserIds,
  coiApproved,
  coiSubmitted,
  controls,
  departments,
  findings,
  giftsApproved,
  giftsReturned,
  kris,
  objectives,
  policies,
  policyBodies,
  risks,
  users,
} from "../src/data/catalogue";
import { NAICOM_SOURCE_URL, NAICOM_WORK, naicomCitation, naicomRequirements } from "../src/data/naicom";
import {
  ISO27001_SOURCE,
  ISO31000_SOURCE,
  NDPA_SOURCE_URL,
  NDPA_WORK,
  iso27001Requirements,
  iso31000Requirements,
  ndpaCitation,
  ndpaRequirements,
} from "../src/data/other-frameworks";
import { riskScore } from "../src/lib/scoring";

const prisma = new PrismaClient();

const NON_COMPLIANT = new Set(["6.2.9", "6.4.3", "6.4.4", "6.5.2", "s.28", "s.40", "A.8.2", "A.8.13"]);
const NOT_ASSESSED = new Set(["6.2.10", "31000-8"]);
const COMPLIANT = new Set(["6.2.1", "6.2.6", "6.2.7", "6.3.3.6", "6.3.3.8", "6.3.3.5", "s.24", "s.44", "A.5.1", "31000-10"]);

function assessmentStatus(code: string): string {
  if (NOT_ASSESSED.has(code)) return "NOT_ASSESSED";
  if (NON_COMPLIANT.has(code)) return "NON_COMPLIANT";
  if (COMPLIANT.has(code)) return "COMPLIANT";
  return "PARTIAL";
}

function requirementId(framework: string, code: string): string {
  return `${framework}-${code.replace(/[^a-zA-Z0-9]+/g, "-")}`;
}

async function wipe() {
  await prisma.auditEvent.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.kpiScore.deleteMany();
  await prisma.kpi.deleteMany();
  await prisma.appraisal.deleteMany();
  await prisma.objective.deleteMany();
  await prisma.policyAttestation.deleteMany();
  await prisma.attestationCampaign.deleteMany();
  await prisma.declaration.deleteMany();
  await prisma.declarationCampaignPolicy.deleteMany();
  await prisma.declarationCampaign.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.requirementPolicy.deleteMany();
  await prisma.requirementControl.deleteMany();
  await prisma.actionItem.deleteMany();
  await prisma.finding.deleteMany();
  await prisma.requirement.deleteMany();
  await prisma.framework.deleteMany();
  await prisma.kri.deleteMany();
  await prisma.riskControl.deleteMany();
  await prisma.risk.deleteMany();
  await prisma.control.deleteMany();
  await prisma.riskAppetiteLimit.deleteMany();
  await prisma.policyVersion.deleteMany();
  await prisma.policy.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
}

async function main() {
  await wipe();
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);

  await prisma.department.createMany({ data: departments.map((department) => ({ ...department })) });
  await prisma.user.createMany({
    data: users.map((user) => ({ ...user, passwordHash, active: true })),
  });

  await prisma.riskAppetiteLimit.createMany({
    data: appetite.map((row) => ({
      id: `appetite-${row.category}`,
      category: row.category,
      maxResidualScore: row.maxResidualScore,
      statement: row.statement,
      ownerId: row.ownerId,
      reviewDate: new Date("2026-03-18T00:00:00.000Z"),
    })),
  });

  await prisma.control.createMany({
    data: controls.map((control) => ({
      id: control.id,
      code: control.id,
      name: control.name,
      description: control.description,
      type: control.type,
      frequency: control.frequency,
      effectiveness: control.effectiveness,
      ownerId: control.ownerId,
      lastTestedAt: control.effectiveness === "NOT_TESTED" ? null : new Date("2026-06-30T00:00:00.000Z"),
    })),
  });

  for (const risk of risks) {
    const inherentScore = riskScore(risk.li, risk.ii);
    const residualScore = riskScore(risk.lr, risk.ir);
    await prisma.risk.create({
      data: {
        id: risk.code,
        code: risk.code,
        title: risk.title,
        description: risk.description,
        category: risk.category,
        lineOfBusiness: risk.line,
        departmentId: risk.departmentId,
        ownerId: risk.ownerId,
        likelihoodInherent: risk.li,
        impactInherent: risk.ii,
        likelihoodResidual: risk.lr,
        impactResidual: risk.ir,
        inherentScore,
        residualScore,
        treatment: risk.treatment,
        status: risk.status,
        trend: risk.trend,
        emerging: Boolean(risk.emerging),
        strategicObjective: risk.objective,
        escalationStatus: risk.escalation ?? "NONE",
        escalationNote: risk.escalationNote ?? null,
        escalatedAt: risk.escalation ? new Date("2026-09-16T09:00:00.000Z") : null,
        escalatedById: risk.escalation ? "efe" : null,
        reviewDate: new Date("2026-12-15T00:00:00.000Z"),
        controls: { create: risk.controls.map((controlId) => ({ controlId })) },
      },
    });
  }

  await prisma.kri.createMany({
    data: kris.map((kri) => ({
      id: kri.id,
      code: kri.id,
      name: kri.name,
      description: kri.description,
      unit: kri.unit,
      direction: kri.direction,
      greenThreshold: kri.green,
      amberThreshold: kri.amber,
      currentValue: kri.value,
      frequency: kri.frequency,
      measuredAt: new Date("2026-10-01T00:00:00.000Z"),
      category: kri.category,
      riskId: kri.riskCode,
      ownerId: kri.ownerId,
    })),
  });

  for (const policy of policies) {
    await prisma.policy.create({
      data: {
        id: policy.id,
        code: policy.id,
        title: policy.title,
        category: policy.category,
        summary: policy.summary,
        ownerId: policy.ownerId,
        status: policy.status,
        lastReviewDate: policy.lastReview ? new Date(`${policy.lastReview}T00:00:00.000Z`) : null,
        nextReviewDate: new Date(`${policy.nextReview}T00:00:00.000Z`),
      },
    });
    const body = policyBodies[policy.id];
    await prisma.policyVersion.create({
      data: {
        id: `${policy.id}-${body.version}`,
        policyId: policy.id,
        versionLabel: body.version,
        content: body.content,
        changeNotes: body.notes,
        status: body.status === "DRAFT" ? "DRAFT" : body.status === "SUBMITTED" ? "SUBMITTED" : "APPROVED",
        authorId: policy.ownerId,
        approvedById: body.status === "APPROVED" ? "chioma" : null,
        approvedAt: body.status === "APPROVED" ? new Date("2026-03-18T10:00:00.000Z") : null,
      },
    });
    if (body.extra) {
      await prisma.policyVersion.create({
        data: {
          id: `${policy.id}-${body.extra.version}`,
          policyId: policy.id,
          versionLabel: body.extra.version,
          content: body.extra.content,
          changeNotes: body.extra.notes,
          status: body.extra.status,
          authorId: policy.ownerId,
          createdAt: new Date("2026-09-02T10:00:00.000Z"),
        },
      });
    }
  }

  const frameworks = [
    {
      id: "naicom",
      code: "NAICOM-S6",
      name: "NAICOM risk management guideline",
      authority: "National Insurance Commission",
      citation: NAICOM_WORK,
      sourceUrl: NAICOM_SOURCE_URL,
      description:
        "Part A, Section 6 of the Revised Prudential Guidelines for Insurance Institutions in Nigeria (effective 1 October 2022). Each element stores the published paragraph. Spacing in the PDF text layer has been repaired. No clause has been added.",
      versionLabel: "1 October 2022",
      elements: naicomRequirements,
      cite: naicomCitation,
    },
    {
      id: "ndpa",
      code: "NDPA-2023",
      name: "Nigeria Data Protection Act 2023",
      authority: "Nigeria Data Protection Commission",
      citation: NDPA_WORK,
      sourceUrl: NDPA_SOURCE_URL,
      description:
        "Operative duties from the Nigeria Data Protection Act 2023 that apply to a multi-line insurer holding motor, health and life customer data. Section numbers are the Act's. The older NDPR is not restated as if it were new clause text.",
      versionLabel: "2023",
      elements: ndpaRequirements,
      cite: ndpaCitation,
    },
    {
      id: "iso31000",
      code: "ISO-31000",
      name: "ISO 31000 elements",
      authority: "ISO",
      citation: ISO31000_SOURCE,
      sourceUrl: "https://www.iso.org/standard/65694.html",
      description:
        "Element titles from ISO 31000:2018 used as a management-system map. The standard text is not stored. Buy or licence the standard before treating a title as the requirement itself.",
      versionLabel: "2018",
      elements: iso31000Requirements,
      cite: (code: string) => `${ISO31000_SOURCE} Element ${code}.`,
    },
    {
      id: "iso27001",
      code: "ISO-27001",
      name: "ISO/IEC 27001 Annex A titles",
      authority: "ISO/IEC",
      citation: ISO27001_SOURCE,
      sourceUrl: "https://www.iso.org/standard/27001",
      description:
        "Selected Annex A control titles from ISO/IEC 27001:2022 relevant to policy, claims and customer data. Control text is not stored.",
      versionLabel: "2022",
      elements: iso27001Requirements,
      cite: (code: string) => `${ISO27001_SOURCE} ${code}.`,
    },
  ];

  for (const framework of frameworks) {
    await prisma.framework.create({
      data: {
        id: framework.id,
        code: framework.code,
        name: framework.name,
        authority: framework.authority,
        citation: framework.citation,
        sourceUrl: framework.sourceUrl,
        description: framework.description,
        versionLabel: framework.versionLabel,
      },
    });
    for (const [index, element] of framework.elements.entries()) {
      const id = requirementId(framework.id, element.code);
      await prisma.requirement.create({
        data: {
          id,
          frameworkId: framework.id,
          code: element.code,
          title: element.title,
          text: element.text,
          citation: framework.cite(element.code),
          sortOrder: index + 1,
        },
      });
      if (element.controls?.length) {
        await prisma.requirementControl.createMany({
          data: element.controls.map((controlId) => ({ requirementId: id, controlId })),
        });
      }
      if (element.policies?.length) {
        await prisma.requirementPolicy.createMany({
          data: element.policies.map((policyId) => ({ requirementId: id, policyId })),
        });
      }
      const status = assessmentStatus(element.code);
      if (status !== "NOT_ASSESSED") {
        await prisma.assessment.create({
          data: {
            id: `assess-${id}`,
            requirementId: id,
            period: "2026-Q3",
            status,
            notes:
              status === "COMPLIANT"
                ? "Evidence is on file for the 2026 third-quarter review."
                : status === "PARTIAL"
                  ? "The practice exists, but the file or the owner is not yet complete."
                  : "The quarter review could not show that this duty is being met.",
            assessorId: framework.id === "naicom" || framework.id === "iso31000" ? "efe" : "chioma",
            assessedAt: new Date("2026-10-02T00:00:00.000Z"),
          },
        });
      }
    }
  }

  await prisma.evidence.create({
    data: {
      id: "EV-01",
      requirementId: requirementId("naicom", "6.2.1"),
      title: "Approved enterprise risk management policy",
      description: "Board-approved policy describing the register, appetite and escalation path.",
      reference: "POL-ERM version 3.0",
      uploadedById: "efe",
      uploadedAt: new Date("2026-03-18T00:00:00.000Z"),
    },
  });
  await prisma.evidence.create({
    data: {
      id: "EV-02",
      requirementId: requirementId("naicom", "6.3.3.6"),
      title: "Underwriting manual, multi-line",
      description: "Manual covering motor, property, marine, energy, health, life and aviation authority.",
      reference: "POL-UW version 4.1",
      uploadedById: "tunde",
    },
  });
  await prisma.evidence.create({
    data: {
      id: "EV-03",
      requirementId: requirementId("ndpa", "s.28"),
      title: "Gap note — agency portal",
      description: "The motor agency portal was launched without a data privacy impact assessment. See finding FND-03.",
      reference: "FND-03",
      uploadedById: "chioma",
    },
  });

  for (const finding of findings) {
    await prisma.finding.create({
      data: {
        id: finding.id,
        code: finding.id,
        title: finding.title,
        description: finding.description,
        source: finding.source,
        severity: finding.severity,
        status: finding.status,
        riskId: finding.riskCode,
        requirementId: finding.requirementCode
          ? requirementId(
              finding.requirementCode.startsWith("6.")
                ? "naicom"
                : finding.requirementCode.startsWith("s.")
                  ? "ndpa"
                  : finding.requirementCode.startsWith("A.")
                    ? "iso27001"
                    : "iso31000",
              finding.requirementCode,
            )
          : null,
        ownerId: finding.ownerId,
        raisedAt: new Date("2026-07-15T00:00:00.000Z"),
      },
    });
  }

  for (const action of actions) {
    await prisma.actionItem.create({
      data: {
        id: action.id,
        code: action.id,
        title: action.title,
        description: action.description,
        sourceType: action.sourceType,
        riskId: action.riskCode ?? null,
        findingId: "findingId" in action ? action.findingId ?? null : null,
        requirementId: action.requirementCode
          ? requirementId(
              action.requirementCode.startsWith("6.")
                ? "naicom"
                : action.requirementCode.startsWith("s.")
                  ? "ndpa"
                  : "iso27001",
              action.requirementCode,
            )
          : null,
        ownerId: action.ownerId,
        dueDate: new Date(`${action.due}T00:00:00.000Z`),
        status: action.status,
        priority: action.priority,
        completedAt: "completed" in action && action.completed ? new Date(`${action.completed}T00:00:00.000Z`) : null,
      },
    });
  }

  await prisma.declarationCampaign.createMany({
    data: [
      { id: "camp-coc", type: "CODE_OF_CONDUCT", name: "Annual code of conduct and policy attestation 2026", year: 2026, dueDate: new Date("2026-10-31T00:00:00.000Z"), status: "OPEN" },
      { id: "camp-coi", type: "CONFLICT_OF_INTEREST", name: "Conflicts of interest 2026", year: 2026, dueDate: new Date("2026-10-31T00:00:00.000Z"), status: "OPEN" },
      { id: "camp-gft", type: "GIFTS_HOSPITALITY", name: "Gifts and hospitality 2026", year: 2026, dueDate: new Date("2026-10-31T00:00:00.000Z"), status: "OPEN" },
    ],
  });
  await prisma.declarationCampaignPolicy.createMany({
    data: ["POL-COC", "POL-SEC", "POL-DPP"].map((policyId) => ({ campaignId: "camp-coc", policyId })),
  });

  const declarationRows: Array<{ id: string; campaignId: string; userId: string; type: string; status: string; payload: string; submittedAt?: Date; reviewedById?: string; reviewedAt?: Date; reviewNotes?: string }> = [];

  for (const user of users) {
    if (codeCompleteUserIds.includes(user.id) || codeSubmittedUserIds.includes(user.id)) {
      const approved = codeCompleteUserIds.includes(user.id);
      declarationRows.push({
        id: `dec-coc-${user.id}`,
        campaignId: "camp-coc",
        userId: user.id,
        type: "CODE_OF_CONDUCT",
        status: approved ? "APPROVED" : "SUBMITTED",
        payload: JSON.stringify({ acknowledge: true, comment: "I have read the code and attested the linked policies." }),
        submittedAt: new Date("2026-09-20T00:00:00.000Z"),
        reviewedById: approved ? "chioma" : undefined,
        reviewedAt: approved ? new Date("2026-09-28T00:00:00.000Z") : undefined,
        reviewNotes: approved ? "Attestations checked." : undefined,
      });
    }
    if (coiApproved.includes(user.id) || coiSubmitted.includes(user.id) || user.id === "tunde") {
      const approved = coiApproved.includes(user.id);
      const submitted = coiSubmitted.includes(user.id);
      declarationRows.push({
        id: `dec-coi-${user.id}`,
        campaignId: "camp-coi",
        userId: user.id,
        type: "CONFLICT_OF_INTEREST",
        status: approved ? "APPROVED" : submitted ? "SUBMITTED" : "DRAFT",
        payload: JSON.stringify(
          user.id === "tunde"
            ? { hasConflict: "yes", relatedParty: "A cousin owns a motor workshop that is sometimes used on claims.", details: "I do not instruct that workshop. Draft only." }
            : { hasConflict: "no", relatedParty: "", details: "No interest to declare." },
        ),
        submittedAt: approved || submitted ? new Date("2026-09-18T00:00:00.000Z") : undefined,
        reviewedById: approved ? "chioma" : undefined,
        reviewedAt: approved ? new Date("2026-09-25T00:00:00.000Z") : undefined,
      });
    }
    if (giftsApproved.includes(user.id) || giftsReturned.includes(user.id)) {
      const returned = giftsReturned.includes(user.id);
      declarationRows.push({
        id: `dec-gft-${user.id}`,
        campaignId: "camp-gft",
        userId: user.id,
        type: "GIFTS_HOSPITALITY",
        status: returned ? "RETURNED" : "APPROVED",
        payload: JSON.stringify(
          returned
            ? { receivedAny: "yes", donor: "A hospital group", description: "Lunch during a scheme review", estimatedValue: "Not stated", dateGiven: "2026-08-14" }
            : { receivedAny: "no", donor: "", description: "", estimatedValue: "", dateGiven: "" },
        ),
        submittedAt: new Date("2026-09-12T00:00:00.000Z"),
        reviewedById: "chioma",
        reviewedAt: new Date("2026-09-22T00:00:00.000Z"),
        reviewNotes: returned ? "Please state the value and whether you were the host." : "Nothing to record.",
      });
    }
  }
  if (!declarationRows.some((row) => row.userId === "tunde" && row.type === "CODE_OF_CONDUCT")) {
    declarationRows.push({
      id: "dec-coc-tunde",
      campaignId: "camp-coc",
      userId: "tunde",
      type: "CODE_OF_CONDUCT",
      status: "DRAFT",
      payload: JSON.stringify({ acknowledge: false, comment: "" }),
    });
  }
  await prisma.declaration.createMany({ data: declarationRows });

  const linkedPolicies = ["POL-COC", "POL-SEC", "POL-DPP"];
  for (const policyId of linkedPolicies) {
    await prisma.attestationCampaign.create({
      data: {
        id: `attcamp-${policyId}`,
        name: `${policyId} attestation 2026`,
        policyId,
        dueDate: new Date("2026-10-31T00:00:00.000Z"),
        declarationCampaignId: "camp-coc",
      },
    });
  }
  for (const user of users) {
    const done = codeCompleteUserIds.includes(user.id) || codeSubmittedUserIds.includes(user.id);
    for (const policyId of linkedPolicies) {
      await prisma.policyAttestation.create({
        data: {
          id: `att-${policyId}-${user.id}`,
          campaignId: `attcamp-${policyId}`,
          policyId,
          userId: user.id,
          status: done ? "ATTESTED" : "PENDING",
          attestedAt: done ? new Date("2026-09-20T00:00:00.000Z") : null,
          declarationId: done ? `dec-coc-${user.id}` : user.id === "tunde" ? "dec-coc-tunde" : null,
        },
      });
    }
  }

  for (const objective of objectives) {
    await prisma.objective.create({
      data: {
        id: objective.id,
        code: objective.id,
        title: objective.title,
        description: objective.description,
        ownerId: objective.ownerId,
        departmentId: objective.departmentId,
        period: objective.period,
        weight: objective.weight,
        status: objective.status,
        riskId: "riskCode" in objective ? objective.riskCode ?? null : null,
        requirementId: objective.requirementCode
          ? requirementId(
              objective.requirementCode.startsWith("6.")
                ? "naicom"
                : objective.requirementCode.startsWith("s.")
                  ? "ndpa"
                  : "iso27001",
              objective.requirementCode,
            )
          : null,
      },
    });
    for (const kpi of objective.kpis) {
      await prisma.kpi.create({
        data: {
          id: kpi.id,
          objectiveId: objective.id,
          name: kpi.name,
          unit: kpi.unit,
          direction: kpi.direction,
          target: kpi.target,
          weight: kpi.weight,
        },
      });
      for (const score of kpi.scores) {
        const ratio = kpi.direction === "LOWER_IS_BETTER" ? kpi.target / score.actual : score.actual / kpi.target;
        await prisma.kpiScore.create({
          data: {
            id: `${kpi.id}-${score.period}`,
            kpiId: kpi.id,
            period: score.period,
            actual: score.actual,
            score: Math.round(Math.max(0, Math.min(100, ratio * 100))),
            notes: score.notes,
            scoredById: "efe",
            scoredAt: new Date("2026-07-20T00:00:00.000Z"),
          },
        });
      }
    }
  }

  await prisma.appraisal.createMany({
    data: appraisals.map((appraisal) => ({
      id: appraisal.id,
      userId: appraisal.userId,
      reviewerId: appraisal.reviewerId,
      period: appraisal.period,
      overallScore: appraisal.overallScore,
      rating: appraisal.rating,
      narrative: appraisal.narrative,
      riskComplianceNote: appraisal.riskNote,
      status: appraisal.status,
    })),
  });

  const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "data", "uploads"));
  await mkdir(uploadDir, { recursive: true });
  const files = [
    { id: "file-risk-031", entityType: "RISK", entityId: "RSK-031", fileName: "restore-test-note.txt", note: "Partial restore observation, June 2026.", body: "Harbourline restore test, June 2026. Policy header tables restored. Claims images and health authorisation history were not in the backup set. Owner: Ngozi Eze.", uploader: "ngozi" },
    { id: "file-pol-erm", entityType: "POLICY", entityId: "POL-ERM", fileName: "erm-policy-approval.txt", note: "Approval minute extract.", body: "Board Risk Committee, 18 March 2026. Enterprise Risk Management Policy version 3.0 approved. Appetite limits by category noted.", uploader: "chioma" },
    { id: "file-ctl-11", entityType: "CONTROL", entityId: "CTL-11", fileName: "access-review-gap.txt", note: "Audit support.", body: "Privileged access review for Q1 and Q2 2026 was not completed. Shared administrator accounts remain on the policy system.", uploader: "segun" },
    { id: "file-act-03", entityType: "ACTION", entityId: "ACT-03", fileName: "restore-test-plan.txt", note: "Plan for the outstanding full restore.", body: "Full restore plan: take the Sunday backup, restore to the isolated environment, prove motor quote, health authorisation and life payment lookup, record the elapsed time.", uploader: "ngozi" },
  ];
  for (const file of files) {
    const storageKey = `${file.id}-${file.fileName}`;
    const bytes = Buffer.from(file.body, "utf8");
    await writeFile(path.join(uploadDir, storageKey), bytes);
    await prisma.attachment.create({
      data: {
        id: file.id,
        entityType: file.entityType,
        entityId: file.entityId,
        fileName: file.fileName,
        mimeType: "text/plain",
        sizeBytes: bytes.length,
        storageKey,
        uploadedById: file.uploader,
        note: file.note,
        uploadedAt: new Date("2026-06-30T00:00:00.000Z"),
      },
    });
  }
  await prisma.evidence.update({ where: { id: "EV-01" }, data: { attachmentId: "file-pol-erm" } });

  await prisma.auditEvent.createMany({
    data: [
      { actorId: "efe", actorName: "Efe Adeyemi", actorRole: "RISK_MANAGER", action: "ESCALATE", entityType: "RISK", entityId: "RSK-031", summary: "Escalated ransomware risk to the Risk Committee.", at: new Date("2026-09-16T09:00:00.000Z") },
      { actorId: "chioma", actorName: "Chioma Nwosu", actorRole: "COMPLIANCE_OFFICER", action: "APPROVE", entityType: "POLICY", entityId: "POL-ERM", summary: "Approved Enterprise Risk Management Policy version 3.0.", at: new Date("2026-03-18T10:00:00.000Z") },
      { actorId: "segun", actorName: "Segun Falana", actorRole: "STAFF", action: "CREATE", entityType: "CONTROL", entityId: "CTL-11", summary: "Recorded that the privileged access review was not completed.", at: new Date("2026-07-15T11:00:00.000Z") },
      { actorId: "ngozi", actorName: "Ngozi Eze", actorRole: "STAFF", action: "UPDATE", entityType: "ACTION", entityId: "ACT-03", summary: "Attached the restore test plan to the open action.", at: new Date("2026-09-01T14:00:00.000Z") },
    ],
  });

  const riskCount = await prisma.risk.count();
  if (riskCount < 40) throw new Error(`Expected at least 40 risks, found ${riskCount}.`);
  console.log(`Seeded Harbourline Assurance Plc: ${riskCount} risks, ${users.length} people.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
