// Record-type definitions are data: they are stored in the record_types table
// (seeded from lib/defs/modules.ts) and can be edited by administrators.
// The engine renders forms, lists and workflows from these definitions.

export const ROLES = [
  "admin",
  "cro",
  "risk",
  "compliance",
  "mlro",
  "auditor",
  "investigator",
  "hse",
  "esg",
  "board",
  "staff",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Platform administrator",
  cro: "Chief Risk Officer",
  risk: "Risk team",
  compliance: "Compliance (Enterprise Assurance)",
  mlro: "MLRO",
  auditor: "Internal Audit",
  investigator: "Investigator",
  hse: "HSE lead",
  esg: "Sustainability lead",
  board: "Director / board committee member",
  staff: "Staff",
};

export const LINES_OF_DEFENCE = ["First line", "Second line", "Third line", "Board and oversight"] as const;

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "date"
  | "select"
  | "multiselect"
  | "user"
  | "orgunit"
  | "checkbox"
  | "score"
  | "computed";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
  help?: string;
  /** Show this field only when another field has one of these values. */
  showIf?: { field: string; in: (string | boolean)[] };
  section?: string;
  /** Show as a column in list views. */
  list?: boolean;
  min?: number;
  max?: number;
  /** For computed fields: read-only, set by a hook. */
  readOnly?: boolean;
}

export interface StateDef {
  key: string;
  label: string;
  tone?: "neutral" | "info" | "good" | "warn" | "bad";
  final?: boolean;
}

export interface TransitionDef {
  key: string;
  label: string;
  from: string[];
  to: string;
  /** Roles allowed to trigger. The record owner may always trigger unless ownerAllowed is false. */
  roles?: Role[];
  ownerAllowed?: boolean;
  /** Fields that must have a value before the transition. */
  requires?: string[];
  /** The creator, and anyone who already took a four-eyes step on this record, may not trigger this transition. */
  fourEyes?: boolean;
  commentRequired?: boolean;
  /** Fields holding user ids; the person acting must be none of them (e.g. a second, different director). */
  distinctFrom?: string[];
  /** Only the listed roles may act: no owner or administrator bypass (e.g. director signatures). */
  strictRoles?: boolean;
  /** Record who triggered the transition and when, into these data fields. */
  stamp?: { by: string; on: string };
}

export interface WorkflowDef {
  initial: string;
  states: StateDef[];
  transitions: TransitionDef[];
}

export interface TypeDef {
  key: string;
  module: ModuleKey;
  label: string;
  plural: string;
  prefix: string;
  description?: string;
  fields: FieldDef[];
  workflow: WorkflowDef;
  /** Roles that may create records of this type. Empty means everyone. */
  createRoles?: Role[];
  /** Roles that may edit any record of this type (owners and creators can always edit). */
  editRoles?: Role[];
  /** Restrict visibility. Records are visible only to these roles, the owner and the creator. */
  confidential?: { roles: Role[]; whenField?: string; whenIn?: string[] };
  /** Name of a code hook in lib/engine/hooks.ts */
  hook?: string;
  /** Field holding the due date that drives reminders and overdue status. */
  dueField?: string;
  /** Hide from navigation (used for child records). */
  hidden?: boolean;
}

export type ModuleKey =
  | "erm"
  | "prudential"
  | "policy"
  | "compliance"
  | "actions"
  | "declarations"
  | "cases"
  | "esg"
  | "thirdparty"
  | "audit"
  | "bcm";

export interface ModuleDef {
  key: ModuleKey;
  label: string;
  group: "Risk" | "Governance" | "Compliance" | "Resilience";
  summary: string;
}

export const MODULES: ModuleDef[] = [
  { key: "erm", label: "Enterprise risk", group: "Risk", summary: "Objectives, risks, appetite, controls, KRIs, losses and models" },
  { key: "prudential", label: "ORSA and declarations", group: "Risk", summary: "ORSA, the directors' Risk Management Declaration and the Financial Condition Report" },
  { key: "thirdparty", label: "Third parties", group: "Risk", summary: "Reinsurers, brokers, TPAs and suppliers, tiered and monitored" },
  { key: "cases", label: "Cases", group: "Risk", summary: "Incidents, complaints, fraud, whistleblowing and breaches" },
  { key: "policy", label: "Policies", group: "Governance", summary: "Policy library, approvals, attestation and exceptions" },
  { key: "actions", label: "Actions", group: "Governance", summary: "Every remediation commitment and board decision" },
  { key: "declarations", label: "Declarations", group: "Governance", summary: "Conflicts, gifts, outside interests and personal dealing" },
  { key: "compliance", label: "Compliance", group: "Compliance", summary: "Obligations, controls, testing, returns and regulatory change" },
  { key: "audit", label: "Internal audit", group: "Compliance", summary: "Audit universe, plan, engagements and findings" },
  { key: "esg", label: "ESG and HSE", group: "Resilience", summary: "Sustainability metrics, inspections and permits" },
  { key: "bcm", label: "Continuity", group: "Resilience", summary: "Important services, BIAs, plans and exercises" },
];
