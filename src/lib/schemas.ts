import { z } from "zod";
import { LINES_OF_BUSINESS, RISK_CATEGORIES, RISK_STATUSES, TREATMENTS, TRENDS } from "./domain";

const score = z.coerce.number().int().min(1).max(5);

export const riskSchema = z.object({
  title: z.string().trim().min(5, "Give the risk a clear title."),
  description: z.string().trim().min(10, "Describe the risk in a sentence or two."),
  category: z.enum(RISK_CATEGORIES),
  lineOfBusiness: z.enum(LINES_OF_BUSINESS),
  departmentId: z.string().min(1),
  ownerId: z.string().min(1),
  likelihoodInherent: score,
  impactInherent: score,
  likelihoodResidual: score,
  impactResidual: score,
  treatment: z.enum(TREATMENTS),
  status: z.enum(RISK_STATUSES),
  trend: z.enum(TRENDS),
  emerging: z.string().optional(),
  strategicObjective: z.string().trim().min(5, "Say which objective this risk threatens."),
});

export const escalateSchema = z.object({
  note: z.string().trim().min(10, "Write a short note for the Risk Committee."),
  decision: z.enum(["ESCALATE", "ACKNOWLEDGE"]).default("ESCALATE"),
});

export const policySchema = z.object({
  title: z.string().trim().min(5),
  category: z.string().trim().min(2),
  summary: z.string().trim().min(10),
  ownerId: z.string().min(1),
  nextReviewDate: z.string().min(8),
});

export const versionSchema = z.object({
  versionLabel: z.string().trim().min(1),
  content: z.string().trim().min(20),
  changeNotes: z.string().trim().min(5),
});

export const decisionSchema = z.object({
  decision: z.enum(["SUBMIT", "APPROVE", "REJECT"]),
  versionId: z.string().min(1),
  notes: z.string().optional(),
});

export const assessmentSchema = z.object({
  requirementId: z.string().min(1),
  period: z.string().trim().min(4),
  status: z.enum(["COMPLIANT", "PARTIAL", "NON_COMPLIANT", "NOT_ASSESSED"]),
  notes: z.string().trim().min(5),
});

export const evidenceSchema = z.object({
  requirementId: z.string().min(1),
  title: z.string().trim().min(3),
  description: z.string().trim().min(5),
  reference: z.string().trim().min(2),
});

export const actionSchema = z.object({
  title: z.string().trim().min(5),
  description: z.string().trim().min(5),
  sourceType: z.enum(["RISK", "FINDING", "COMPLIANCE_GAP", "AUDIT", "KRI"]),
  riskId: z.string().optional(),
  findingId: z.string().optional(),
  requirementId: z.string().optional(),
  ownerId: z.string().min(1),
  dueDate: z.string().min(8),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).default("OPEN"),
});

export const declarationSchema = z.object({
  hasConflict: z.string().optional(),
  relatedParty: z.string().optional(),
  details: z.string().optional(),
  receivedAny: z.string().optional(),
  donor: z.string().optional(),
  description: z.string().optional(),
  estimatedValue: z.string().optional(),
  dateGiven: z.string().optional(),
  acknowledge: z.string().optional(),
  comment: z.string().optional(),
});

export const reviewSchema = z.object({
  decision: z.enum(["APPROVE", "RETURN"]),
  notes: z.string().trim().min(3, "Add a short review note."),
});

export const scoreSchema = z.object({
  kpiId: z.string().min(1),
  period: z.string().trim().min(4),
  actual: z.coerce.number(),
  notes: z.string().trim().min(3),
});

export const appraisalSchema = z.object({
  userId: z.string().min(1),
  period: z.string().trim().min(4),
  overallScore: z.coerce.number().min(0).max(100),
  rating: z.enum(["EXCEEDS", "MEETS", "PARTIAL", "BELOW"]),
  narrative: z.string().trim().min(10),
  riskComplianceNote: z.string().trim().min(10),
  status: z.enum(["DRAFT", "SUBMITTED", "COMPLETED"]).default("COMPLETED"),
});

export const personSchema = z.object({
  name: z.string().trim().min(3),
  email: z.string().trim().email(),
  role: z.enum(["ADMIN", "RISK_MANAGER", "COMPLIANCE_OFFICER", "STAFF", "BOARD_VIEWER"]),
  title: z.string().trim().min(2),
  departmentId: z.string().min(1),
  password: z.string().min(8),
});

export const controlSchema = z.object({
  effectiveness: z.enum(["EFFECTIVE", "PARTIALLY_EFFECTIVE", "INEFFECTIVE", "NOT_TESTED"]),
});

export const kriSchema = z.object({
  currentValue: z.coerce.number(),
});

export function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length ? trimmed : null;
}
