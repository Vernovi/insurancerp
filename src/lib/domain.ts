export const ROLES = [
  "ADMIN",
  "RISK_MANAGER",
  "COMPLIANCE_OFFICER",
  "STAFF",
  "BOARD_VIEWER",
] as const;

export type Role = (typeof ROLES)[number];

export const RISK_CATEGORIES = [
  "UNDERWRITING",
  "CREDIT_INVESTMENT",
  "MARKET",
  "OPERATIONAL",
  "COMPLIANCE",
  "CYBER",
  "THIRD_PARTY",
  "REPUTATIONAL",
  "BCP",
] as const;

export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<RiskCategory, string> = {
  UNDERWRITING: "Underwriting",
  CREDIT_INVESTMENT: "Credit / investment",
  MARKET: "Market",
  OPERATIONAL: "Operational",
  COMPLIANCE: "Compliance",
  CYBER: "Cyber",
  THIRD_PARTY: "Third party",
  REPUTATIONAL: "Reputational",
  BCP: "Business continuity",
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  RISK_MANAGER: "Risk manager",
  COMPLIANCE_OFFICER: "Compliance officer",
  STAFF: "Staff",
  BOARD_VIEWER: "Board viewer",
};

export const LIKELIHOOD_LABEL = ["", "Rare", "Unlikely", "Possible", "Likely", "Almost certain"];
export const IMPACT_LABEL = ["", "Negligible", "Minor", "Moderate", "Major", "Severe"];

export const LINES_OF_BUSINESS = [
  "Motor",
  "Property",
  "Marine",
  "Energy",
  "Health",
  "Life",
  "Group life",
  "Aviation",
  "Investments",
  "Enterprise-wide",
] as const;

export const TREATMENTS = ["MITIGATE", "ACCEPT", "TRANSFER", "AVOID"] as const;
export const RISK_STATUSES = ["OPEN", "MITIGATING", "ACCEPTED", "CLOSED"] as const;
export const TRENDS = ["UP", "STABLE", "DOWN"] as const;

export const ACTION_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export const ASSESSMENT_STATUSES = ["COMPLIANT", "PARTIAL", "NON_COMPLIANT", "NOT_ASSESSED"] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function isCategory(value: string): value is RiskCategory {
  return (RISK_CATEGORIES as readonly string[]).includes(value);
}

export function labelize(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
