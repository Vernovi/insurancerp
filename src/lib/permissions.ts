import type { Role } from "./domain";

export function canManageRisks(role: Role): boolean {
  return role === "ADMIN" || role === "RISK_MANAGER";
}

export function canManageCompliance(role: Role): boolean {
  return role === "ADMIN" || role === "COMPLIANCE_OFFICER";
}

export function canManagePolicies(role: Role): boolean {
  return role === "ADMIN" || role === "COMPLIANCE_OFFICER";
}

export function canReviewDeclarations(role: Role): boolean {
  return role === "ADMIN" || role === "COMPLIANCE_OFFICER";
}

export function canManagePerformance(role: Role): boolean {
  return role === "ADMIN" || role === "RISK_MANAGER" || role === "COMPLIANCE_OFFICER";
}

export function canManagePeople(role: Role): boolean {
  return role === "ADMIN";
}

export function canExportBoard(role: Role): boolean {
  return role !== "STAFF";
}

export function isReadOnly(role: Role): boolean {
  return role === "BOARD_VIEWER";
}
