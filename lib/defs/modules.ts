import type { FieldDef, TypeDef, WorkflowDef, StateDef } from "./types";

// ---------------------------------------------------------------------------
// Shared option lists (editable by administrators once seeded)
// ---------------------------------------------------------------------------
export const RISK_CATEGORIES = [
  "Insurance risk",
  "Market risk",
  "Credit risk",
  "Liquidity risk",
  "Operational risk",
  "Compliance and conduct",
  "Strategic",
  "ESG and climate",
];
export const BUSINESS_LINES = [
  "Group",
  "Motor",
  "Property",
  "Marine and aviation",
  "Engineering",
  "Oil and gas / energy",
  "General liability",
  "Individual life",
  "Group life",
  "Health",
  "Annuity",
  "Investments",
];
const SCORE = ["1", "2", "3", "4", "5"];
const RATINGS = ["Low", "Medium", "High", "Critical"];
const EFFECTIVENESS = ["Effective", "Partially effective", "Ineffective", "Not tested"];

const s = (key: string, label: string, tone?: StateDef["tone"], final?: boolean): StateDef => ({ key, label, tone, final });

/** Draft → submitted → approved, with return and retire. Used by many types. */
function approvalFlow(opts: {
  approveRoles: TypeDef["editRoles"];
  activeLabel?: string;
  activeKey?: string;
}): WorkflowDef {
  const active = opts.activeKey ?? "approved";
  return {
    initial: "draft",
    states: [
      s("draft", "Draft"),
      s("submitted", "Submitted", "info"),
      s(active, opts.activeLabel ?? "Approved", "good"),
      s("retired", "Retired", "neutral", true),
    ],
    transitions: [
      { key: "submit", label: "Submit for approval", from: ["draft"], to: "submitted" },
      { key: "approve", label: "Approve", from: ["submitted"], to: active, roles: opts.approveRoles, ownerAllowed: false, fourEyes: true },
      { key: "return", label: "Return for changes", from: ["submitted"], to: "draft", roles: opts.approveRoles, ownerAllowed: false, commentRequired: true },
      { key: "revise", label: "Reopen for revision", from: [active], to: "draft", roles: opts.approveRoles },
      { key: "retire", label: "Retire", from: [active], to: "retired", roles: opts.approveRoles, commentRequired: true },
    ],
  };
}

function simpleFlow(states: StateDef[], chain: { key: string; label: string; from: string; to: string; roles?: TypeDef["editRoles"] }[]): WorkflowDef {
  return {
    initial: states[0].key,
    states,
    transitions: chain.map((c) => ({ key: c.key, label: c.label, from: [c.from], to: c.to, roles: c.roles })),
  };
}

const lc = (key: string, label: string, section?: string): FieldDef[] => [
  { key: `${key}_likelihood`, label: `${label} likelihood`, type: "score", options: SCORE, section, help: "1 = rare, 5 = almost certain" },
  { key: `${key}_impact`, label: `${label} impact`, type: "score", options: SCORE, section, help: "Use the highest of financial, regulatory, reputational, customer and people impact" },
  { key: `${key}_score`, label: `${label} score`, type: "computed", readOnly: true, section },
];

// ---------------------------------------------------------------------------
// MODULE 0: ENTERPRISE RISK MANAGEMENT
// ---------------------------------------------------------------------------
const erm: TypeDef[] = [
  {
    key: "objective",
    module: "erm",
    label: "Strategic objective",
    plural: "Strategic objectives",
    prefix: "OBJ",
    description: "What the business must achieve. Risks are linked to the objectives they threaten.",
    createRoles: ["cro", "risk", "admin", "board"],
    editRoles: ["cro", "risk", "admin"],
    fields: [
      { key: "description", label: "Description", type: "textarea" },
      { key: "period", label: "Plan period", type: "text", list: true, help: "For example 2026-2028" },
      { key: "target", label: "Target or KPI", type: "text", list: true },
    ],
    workflow: simpleFlow(
      [s("active", "Active", "good"), s("achieved", "Achieved", "good", true), s("retired", "Retired", "neutral", true)],
      [
        { key: "achieve", label: "Mark achieved", from: "active", to: "achieved" },
        { key: "retire", label: "Retire", from: "active", to: "retired" },
      ],
    ),
  },
  {
    key: "appetite",
    module: "erm",
    label: "Risk appetite statement",
    plural: "Risk appetite",
    prefix: "RAS",
    description: "Appetite per risk category. Residual scores above the threshold are outside appetite.",
    createRoles: ["cro", "risk", "admin"],
    editRoles: ["cro", "risk", "admin"],
    hook: "appetite",
    fields: [
      { key: "category", label: "Risk category", type: "select", options: RISK_CATEGORIES, required: true, list: true },
      { key: "statement", label: "Appetite statement", type: "textarea", required: true },
      { key: "threshold", label: "Maximum acceptable residual score", type: "number", min: 1, max: 25, required: true, list: true, help: "Residual scores above this are outside appetite; within 2 points below it is 'approaching'" },
      { key: "quantitative_limits", label: "Quantitative limits", type: "textarea", help: "For example: net retention per risk, solvency ratio floor, single-reinsurer concentration" },
      { key: "effective_date", label: "Effective date", type: "date", list: true },
    ],
    workflow: {
      initial: "draft",
      states: [s("draft", "Draft"), s("submitted", "Submitted", "info"), s("approved", "Approved", "good"), s("superseded", "Superseded", "neutral", true)],
      transitions: [
        { key: "submit", label: "Submit for approval", from: ["draft"], to: "submitted" },
        { key: "approve", label: "Approve", from: ["submitted"], to: "approved", roles: ["cro", "board"], ownerAllowed: false, fourEyes: true },
        { key: "return", label: "Return for changes", from: ["submitted"], to: "draft", roles: ["cro", "board"], ownerAllowed: false, commentRequired: true },
        { key: "supersede", label: "Supersede", from: ["approved"], to: "superseded", roles: ["cro", "board"], commentRequired: true },
      ],
    },
  },
  {
    key: "risk",
    module: "erm",
    label: "Risk",
    plural: "Risk register",
    prefix: "RSK",
    description: "Every risk carries an owner, a score against appetite, its controls, KRIs and actions.",
    editRoles: ["cro", "risk", "admin"],
    hook: "risk",
    dueField: "next_review",
    fields: [
      { key: "description", label: "Description", type: "textarea", section: "Identify", required: true },
      { key: "cause", label: "Causes", type: "textarea", section: "Identify" },
      { key: "consequence", label: "Consequences", type: "textarea", section: "Identify" },
      { key: "category", label: "Category", type: "select", options: RISK_CATEGORIES, required: true, list: true, section: "Identify" },
      { key: "subcategory", label: "Sub-category", type: "text", section: "Identify", help: "For example reserving, catastrophe, reinsurer default, cyber, fraud" },
      { key: "business_line", label: "Business line", type: "select", options: BUSINESS_LINES, list: true, section: "Identify" },
      { key: "principal", label: "Principal (enterprise-level) risk", type: "checkbox", section: "Identify" },
      ...lc("inherent", "Inherent", "Assess"),
      ...lc("residual", "Residual", "Assess"),
      { key: "rating", label: "Residual rating", type: "computed", readOnly: true, list: true, section: "Assess" },
      { key: "appetite_threshold", label: "Appetite threshold", type: "computed", readOnly: true, section: "Assess" },
      { key: "appetite_status", label: "Appetite status", type: "computed", readOnly: true, list: true, section: "Assess" },
      { key: "velocity", label: "Velocity", type: "select", options: ["Slow (months)", "Moderate (weeks)", "Fast (days)"], section: "Assess" },
      { key: "trend", label: "Trend", type: "select", options: ["Increasing", "Stable", "Decreasing"], section: "Assess" },
      { key: "rbc_type", label: "Risk-based capital type", type: "select", options: ["Insurance", "Market", "Credit", "Operational", "Not applicable"], section: "Assess", help: "NAICOM's four RBC risk types under NIIRA 2025" },
      { key: "expected_loss", label: "Expected loss (NGN)", type: "currency", section: "Assess" },
      { key: "stressed_loss", label: "Stressed loss (NGN)", type: "currency", section: "Assess" },
      { key: "treatment", label: "Treatment", type: "select", options: ["Reduce", "Transfer (incl. reinsurance)", "Accept", "Avoid"], section: "Treat" },
      ...lc("target", "Target", "Treat"),
      { key: "treatment_notes", label: "Treatment notes", type: "textarea", section: "Treat" },
      { key: "last_review", label: "Last reviewed", type: "date", section: "Monitor", readOnly: true },
      { key: "next_review", label: "Next review due", type: "computed", readOnly: true, list: true, section: "Monitor" },
    ],
    workflow: {
      initial: "draft",
      states: [s("draft", "Draft"), s("submitted", "Submitted", "info"), s("active", "Active", "good"), s("closed", "Closed", "neutral", true)],
      transitions: [
        { key: "submit", label: "Submit to risk team", from: ["draft"], to: "submitted", requires: ["description", "category", "residual_likelihood", "residual_impact"] },
        { key: "approve", label: "Approve into register", from: ["submitted"], to: "active", roles: ["risk", "cro"], ownerAllowed: false, fourEyes: true },
        { key: "return", label: "Return for changes", from: ["submitted"], to: "draft", roles: ["risk", "cro"], ownerAllowed: false, commentRequired: true },
        { key: "review", label: "Confirm review", from: ["active"], to: "active" },
        { key: "close", label: "Close risk", from: ["active"], to: "closed", roles: ["cro", "risk"], commentRequired: true },
        { key: "reopen", label: "Reopen", from: ["closed"], to: "active", roles: ["cro", "risk"] },
      ],
    },
  },
  {
    key: "control",
    module: "erm",
    label: "Control",
    plural: "Controls",
    prefix: "CTL",
    description: "One control library, shared by ERM, Compliance and Internal Audit.",
    editRoles: ["risk", "compliance", "cro", "admin"],
    fields: [
      { key: "description", label: "Control description", type: "textarea", required: true },
      { key: "control_type", label: "Type", type: "select", options: ["Preventive", "Detective", "Corrective"], list: true },
      { key: "nature", label: "Nature", type: "select", options: ["Manual", "Automated", "IT-dependent manual"] },
      { key: "frequency", label: "Frequency", type: "select", options: ["Per transaction", "Daily", "Weekly", "Monthly", "Quarterly", "Annual"] },
      { key: "design_rating", label: "Design effectiveness", type: "select", options: EFFECTIVENESS, list: true },
      { key: "operating_rating", label: "Operating effectiveness", type: "select", options: EFFECTIVENESS, list: true },
      { key: "last_test", label: "Last tested", type: "date" },
      { key: "key_control", label: "Key control", type: "checkbox" },
    ],
    workflow: simpleFlow(
      [s("draft", "Draft"), s("active", "Active", "good"), s("retired", "Retired", "neutral", true)],
      [
        { key: "activate", label: "Activate", from: "draft", to: "active", roles: ["risk", "compliance", "cro"] },
        { key: "retire", label: "Retire", from: "active", to: "retired", roles: ["risk", "compliance", "cro"] },
      ],
    ),
  },
  {
    key: "kri",
    module: "erm",
    label: "Key risk indicator",
    plural: "KRIs",
    prefix: "KRI",
    editRoles: ["risk", "cro", "admin"],
    hook: "kri",
    fields: [
      { key: "definition", label: "Definition and formula", type: "textarea", required: true },
      { key: "unit", label: "Unit", type: "text", list: true },
      { key: "frequency", label: "Frequency", type: "select", options: ["Monthly", "Quarterly", "Annual"] },
      { key: "direction", label: "Direction", type: "select", options: ["Higher is worse", "Lower is worse"], required: true },
      { key: "amber_limit", label: "Amber threshold", type: "number", required: true },
      { key: "red_limit", label: "Red threshold", type: "number", required: true },
      { key: "data_source", label: "Data source", type: "text" },
      { key: "latest_value", label: "Latest value", type: "computed", readOnly: true, list: true },
      { key: "latest_date", label: "Latest reading", type: "computed", readOnly: true },
      { key: "kri_status", label: "Status", type: "computed", readOnly: true, list: true },
    ],
    workflow: simpleFlow(
      [s("active", "Active", "good"), s("retired", "Retired", "neutral", true)],
      [{ key: "retire", label: "Retire", from: "active", to: "retired", roles: ["risk", "cro"] }],
    ),
  },
  {
    key: "loss_event",
    module: "erm",
    label: "Loss event",
    plural: "Loss events",
    prefix: "LOS",
    hook: "loss",
    editRoles: ["risk", "cro", "admin"],
    fields: [
      { key: "event_date", label: "Event date", type: "date", required: true, list: true },
      { key: "description", label: "What happened", type: "textarea", required: true },
      { key: "event_type", label: "Event type", type: "select", list: true, options: ["Internal fraud", "External fraud", "Employment practices", "Clients, products and business practices", "Damage to physical assets", "Business disruption and system failure", "Execution, delivery and process management"] },
      { key: "near_miss", label: "Near miss (no loss)", type: "checkbox" },
      { key: "gross_loss", label: "Gross loss (NGN)", type: "currency" },
      { key: "recoveries", label: "Recoveries (NGN)", type: "currency" },
      { key: "net_loss", label: "Net loss (NGN)", type: "computed", readOnly: true, list: true },
      { key: "root_cause", label: "Root cause", type: "textarea" },
    ],
    workflow: simpleFlow(
      [s("reported", "Reported", "info"), s("validated", "Validated", "good"), s("closed", "Closed", "neutral", true)],
      [
        { key: "validate", label: "Validate", from: "reported", to: "validated", roles: ["risk", "cro"] },
        { key: "close", label: "Close", from: "validated", to: "closed", roles: ["risk", "cro"] },
      ],
    ),
  },
  {
    key: "emerging_risk",
    module: "erm",
    label: "Emerging risk",
    plural: "Emerging risks",
    prefix: "EMR",
    fields: [
      { key: "description", label: "Description", type: "textarea", required: true },
      { key: "horizon", label: "Horizon", type: "select", options: ["0-1 years", "1-3 years", "3+ years"], list: true },
      { key: "signals", label: "Signals being watched", type: "textarea" },
      { key: "potential_impact", label: "Potential impact", type: "select", options: ["Low", "Moderate", "High", "Severe"], list: true },
    ],
    workflow: simpleFlow(
      [s("watching", "Watching", "info"), s("escalated", "Escalated to register", "warn", true), s("retired", "Retired", "neutral", true)],
      [
        { key: "escalate", label: "Escalate to risk register", from: "watching", to: "escalated", roles: ["risk", "cro"] },
        { key: "retire", label: "Retire", from: "watching", to: "retired", roles: ["risk", "cro"] },
      ],
    ),
  },
  {
    key: "risk_acceptance",
    module: "erm",
    label: "Risk acceptance",
    plural: "Risk acceptances",
    prefix: "RAC",
    dueField: "expiry_date",
    fields: [
      { key: "rationale", label: "Why the risk is being accepted", type: "textarea", required: true },
      { key: "residual_at_acceptance", label: "Residual score at acceptance", type: "number", min: 1, max: 25 },
      { key: "authority", label: "Approving authority", type: "select", options: ["CRO", "ExCo", "Board Risk Committee"], list: true },
      { key: "expiry_date", label: "Expires", type: "date", required: true, list: true },
    ],
    workflow: {
      initial: "requested",
      states: [s("requested", "Requested", "info"), s("approved", "Accepted", "good"), s("rejected", "Rejected", "bad", true), s("expired", "Expired", "neutral", true)],
      transitions: [
        { key: "approve", label: "Approve acceptance", from: ["requested"], to: "approved", roles: ["cro", "board"], ownerAllowed: false, fourEyes: true },
        { key: "reject", label: "Reject", from: ["requested"], to: "rejected", roles: ["cro", "board"], ownerAllowed: false, commentRequired: true },
        { key: "expire", label: "Mark expired", from: ["approved"], to: "expired", roles: ["cro", "risk"] },
      ],
    },
  },
  {
    key: "model",
    module: "erm",
    label: "Model",
    plural: "Model inventory",
    prefix: "MDL",
    dueField: "next_validation",
    editRoles: ["risk", "cro", "admin"],
    fields: [
      { key: "model_type", label: "Model type", type: "select", options: ["Reserving", "Pricing", "Capital / RBC", "IFRS 17", "Investment", "Catastrophe", "Other"], list: true },
      { key: "purpose", label: "Purpose and use", type: "textarea" },
      { key: "materiality", label: "Materiality tier", type: "select", options: ["Tier 1", "Tier 2", "Tier 3"], list: true },
      { key: "validator", label: "Independent validator", type: "text" },
      { key: "last_validation", label: "Last validation", type: "date" },
      { key: "next_validation", label: "Next validation due", type: "date", list: true },
    ],
    workflow: simpleFlow(
      [s("in_use", "In use", "good"), s("under_validation", "Under validation", "info"), s("retired", "Retired", "neutral", true)],
      [
        { key: "validate", label: "Start validation", from: "in_use", to: "under_validation" },
        { key: "complete", label: "Validation complete", from: "under_validation", to: "in_use", roles: ["risk", "cro"] },
        { key: "retire", label: "Retire", from: "in_use", to: "retired", roles: ["risk", "cro"] },
      ],
    ),
  },
];

// ---------------------------------------------------------------------------
// MODULE 1: POLICY MANAGEMENT
// ---------------------------------------------------------------------------
const policy: TypeDef[] = [
  {
    key: "policy",
    module: "policy",
    label: "Policy",
    plural: "Policy library",
    prefix: "POL",
    dueField: "next_review",
    editRoles: ["compliance", "cro", "admin"],
    hook: "policy",
    fields: [
      { key: "doc_type", label: "Document type", type: "select", options: ["Policy", "Standard", "Procedure", "Guideline"], list: true },
      { key: "tier", label: "Approval tier", type: "select", options: ["Board", "Board committee", "ExCo", "Function head"], required: true, list: true },
      { key: "version", label: "Version", type: "text", list: true },
      { key: "summary", label: "Plain-language summary", type: "textarea" },
      { key: "body", label: "Policy text", type: "textarea", help: "Paste the approved text or a link to the master document" },
      { key: "dos", label: "Do", type: "textarea", help: "One per line; shown to staff on the policy card" },
      { key: "donts", label: "Don't", type: "textarea", help: "One per line" },
      { key: "audience", label: "Applies to", type: "select", options: ["All staff", "Approved persons", "Underwriting", "Claims", "Finance", "IT", "Board"] },
      { key: "effective_date", label: "Effective date", type: "date" },
      { key: "next_review", label: "Next review", type: "date", list: true },
      { key: "material_change", label: "This version is a material change (re-attestation required)", type: "checkbox" },
    ],
    workflow: {
      initial: "draft",
      states: [
        s("draft", "Draft"),
        s("consultation", "In consultation", "info"),
        s("pending_approval", "Pending approval", "info"),
        s("published", "Published", "good"),
        s("retired", "Retired", "neutral", true),
      ],
      transitions: [
        { key: "consult", label: "Send for consultation", from: ["draft"], to: "consultation" },
        { key: "submit", label: "Submit for approval", from: ["draft", "consultation"], to: "pending_approval", requires: ["tier", "summary"] },
        { key: "approve", label: "Approve and publish", from: ["pending_approval"], to: "published", roles: ["compliance", "cro", "board"], ownerAllowed: false, fourEyes: true },
        { key: "return", label: "Return for changes", from: ["pending_approval"], to: "draft", roles: ["compliance", "cro", "board"], commentRequired: true },
        { key: "revise", label: "Start revision", from: ["published"], to: "draft" },
        { key: "retire", label: "Retire", from: ["published"], to: "retired", roles: ["compliance", "cro"], commentRequired: true },
      ],
    },
  },
  {
    key: "attestation",
    module: "policy",
    label: "Policy attestation",
    plural: "Attestations",
    prefix: "ATT",
    hidden: true,
    createRoles: ["compliance", "admin"],
    hook: "attestation",
    fields: [
      { key: "policy_version", label: "Policy version", type: "text", readOnly: true, list: true },
      { key: "acknowledged", label: "I have read and understood this policy and will comply with it", type: "checkbox", required: true },
      { key: "attested_on", label: "Attested on", type: "computed", readOnly: true, list: true },
    ],
    workflow: {
      initial: "pending",
      states: [s("pending", "Awaiting attestation", "warn"), s("attested", "Attested", "good", true), s("withdrawn", "Withdrawn", "neutral", true)],
      transitions: [
        { key: "attest", label: "I have read this policy and will comply", from: ["pending"], to: "attested" },
        { key: "withdraw", label: "Withdraw request", from: ["pending"], to: "withdrawn", roles: ["compliance", "admin"], ownerAllowed: false },
      ],
    },
  },
  {
    key: "policy_exception",
    module: "policy",
    label: "Policy exception",
    plural: "Policy exceptions",
    prefix: "PEX",
    dueField: "expiry_date",
    fields: [
      { key: "justification", label: "Why an exception is needed", type: "textarea", required: true },
      { key: "compensating_controls", label: "Compensating controls", type: "textarea" },
      { key: "risk_rating", label: "Risk rating", type: "select", options: RATINGS, list: true },
      { key: "expiry_date", label: "Expires", type: "date", required: true, list: true },
    ],
    workflow: {
      initial: "requested",
      states: [s("requested", "Requested", "info"), s("approved", "Approved", "warn"), s("rejected", "Rejected", "bad", true), s("expired", "Expired", "neutral", true)],
      transitions: [
        { key: "approve", label: "Approve exception", from: ["requested"], to: "approved", roles: ["compliance", "cro"], ownerAllowed: false, fourEyes: true },
        { key: "reject", label: "Reject", from: ["requested"], to: "rejected", roles: ["compliance", "cro"], ownerAllowed: false, commentRequired: true },
        { key: "expire", label: "Close as expired", from: ["approved"], to: "expired", roles: ["compliance", "cro"] },
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// MODULE 2: COMPLIANCE FRAMEWORK ENABLEMENT
// ---------------------------------------------------------------------------
const compliance: TypeDef[] = [
  {
    key: "framework",
    module: "compliance",
    label: "Framework or regulation",
    plural: "Frameworks",
    prefix: "FWK",
    editRoles: ["compliance", "admin"],
    createRoles: ["compliance", "admin"],
    fields: [
      { key: "issuer", label: "Issuer", type: "text", list: true },
      { key: "jurisdiction", label: "Jurisdiction", type: "text", list: true },
      { key: "edition", label: "Edition or version", type: "text" },
      { key: "effective_date", label: "Effective date", type: "date" },
      { key: "description", label: "Scope", type: "textarea" },
    ],
    workflow: simpleFlow(
      [s("active", "In force", "good"), s("superseded", "Superseded", "neutral", true)],
      [{ key: "supersede", label: "Supersede", from: "active", to: "superseded", roles: ["compliance"] }],
    ),
  },
  {
    key: "obligation",
    module: "compliance",
    label: "Obligation",
    plural: "Obligations",
    prefix: "OBL",
    editRoles: ["compliance", "admin"],
    fields: [
      { key: "clause_ref", label: "Clause reference", type: "text", list: true },
      { key: "requirement", label: "Requirement in plain English", type: "textarea", required: true },
      { key: "applicability", label: "Applies to", type: "select", options: ["All entities", "Non-life", "Life", "Group", "Listed entity"] },
      { key: "frequency", label: "Frequency", type: "select", options: ["Ongoing", "Annual", "Quarterly", "Monthly", "Event-driven"] },
      { key: "penalty", label: "Consequence of breach", type: "text" },
      { key: "compliance_status", label: "Compliance status", type: "select", options: ["Compliant", "Partially compliant", "Non-compliant", "Not assessed"], list: true },
    ],
    workflow: simpleFlow(
      [s("draft", "Draft"), s("active", "Active", "good"), s("retired", "Retired", "neutral", true)],
      [
        { key: "activate", label: "Activate", from: "draft", to: "active", roles: ["compliance"] },
        { key: "retire", label: "Retire", from: "active", to: "retired", roles: ["compliance"] },
      ],
    ),
  },
  {
    key: "control_test",
    module: "compliance",
    label: "Control test",
    plural: "Control tests",
    prefix: "TST",
    hook: "control_test",
    editRoles: ["compliance", "risk", "auditor", "admin"],
    fields: [
      { key: "test_type", label: "Test type", type: "select", options: ["Control self-assessment", "Independent test (second line)", "Audit test (third line)"], list: true },
      { key: "test_date", label: "Test date", type: "date", list: true },
      { key: "procedure", label: "Test procedure", type: "textarea" },
      { key: "sample_size", label: "Sample size", type: "number" },
      { key: "result", label: "Result", type: "select", options: ["Pass", "Pass with exceptions", "Fail"], list: true },
      { key: "evidence", label: "Evidence and notes", type: "textarea" },
    ],
    workflow: {
      initial: "planned",
      states: [s("planned", "Planned"), s("in_progress", "In progress", "info"), s("review", "Awaiting review", "info"), s("completed", "Completed", "good", true)],
      transitions: [
        { key: "start", label: "Start test", from: ["planned"], to: "in_progress" },
        { key: "submit", label: "Submit for review", from: ["in_progress"], to: "review", requires: ["result", "evidence"] },
        { key: "approve", label: "Sign off", from: ["review"], to: "completed", roles: ["compliance", "auditor", "risk"], ownerAllowed: false, fourEyes: true },
        { key: "return", label: "Return", from: ["review"], to: "in_progress", roles: ["compliance", "auditor", "risk"], commentRequired: true },
      ],
    },
  },
  {
    key: "finding",
    module: "compliance",
    label: "Finding",
    plural: "Findings",
    prefix: "FND",
    editRoles: ["compliance", "auditor", "risk", "admin"],
    fields: [
      { key: "source", label: "Source", type: "select", options: ["Compliance test", "Internal audit", "External audit", "NAICOM examination", "Self-identified"], list: true, required: true },
      { key: "rating", label: "Rating", type: "select", options: RATINGS, list: true, required: true },
      { key: "criteria", label: "Criteria (what should happen)", type: "textarea" },
      { key: "condition", label: "Condition (what we found)", type: "textarea", required: true },
      { key: "cause", label: "Root cause", type: "textarea" },
      { key: "effect", label: "Effect", type: "textarea" },
      { key: "management_response", label: "Management response", type: "textarea" },
    ],
    workflow: {
      initial: "open",
      states: [s("open", "Open", "warn"), s("response_agreed", "Response agreed", "info"), s("closed", "Closed", "good", true)],
      transitions: [
        { key: "agree", label: "Record agreed response", from: ["open"], to: "response_agreed", requires: ["management_response"] },
        { key: "close", label: "Validate and close", from: ["response_agreed"], to: "closed", roles: ["compliance", "auditor", "risk"], ownerAllowed: false, fourEyes: true },
      ],
    },
  },
  {
    key: "reg_change",
    module: "compliance",
    label: "Regulatory change",
    plural: "Regulatory change",
    prefix: "RCH",
    editRoles: ["compliance", "admin"],
    fields: [
      { key: "source", label: "Source", type: "text", list: true, help: "For example NAICOM circular reference" },
      { key: "issued_date", label: "Issued", type: "date" },
      { key: "effective_date", label: "Effective", type: "date", list: true },
      { key: "summary", label: "Summary", type: "textarea", required: true },
      { key: "applicable", label: "Applicable to us", type: "select", options: ["Yes", "Partially", "No"], list: true },
      { key: "impact", label: "Impact assessment", type: "textarea" },
    ],
    workflow: {
      initial: "logged",
      states: [s("logged", "Logged"), s("assessing", "Assessing", "info"), s("accepted", "Accepted into library", "warn"), s("implemented", "Implemented", "good", true), s("not_applicable", "Not applicable", "neutral", true)],
      transitions: [
        { key: "assess", label: "Start assessment", from: ["logged"], to: "assessing" },
        { key: "accept", label: "Accept and plan changes", from: ["assessing"], to: "accepted", roles: ["compliance"], requires: ["applicable", "impact"] },
        { key: "na", label: "Mark not applicable", from: ["assessing"], to: "not_applicable", roles: ["compliance"], commentRequired: true },
        { key: "implement", label: "Mark implemented", from: ["accepted"], to: "implemented", roles: ["compliance"] },
      ],
    },
  },
  {
    key: "reg_return",
    module: "compliance",
    label: "Regulatory return",
    plural: "Returns calendar",
    prefix: "RET",
    dueField: "due_date",
    editRoles: ["compliance", "admin"],
    fields: [
      { key: "regulator", label: "Regulator", type: "select", options: ["NAICOM", "NFIU", "NDPC", "FRC", "SEC", "NGX", "FIRS", "CBN"], list: true, required: true },
      { key: "frequency", label: "Frequency", type: "select", options: ["Annual", "Quarterly", "Monthly", "Event-driven"] },
      { key: "due_date", label: "Due date", type: "date", required: true, list: true },
      { key: "preparer", label: "Preparer", type: "user" },
      { key: "reviewer", label: "Reviewer", type: "user" },
      { key: "submitted_date", label: "Submitted on", type: "date" },
      { key: "reference", label: "Submission reference", type: "text" },
    ],
    workflow: {
      initial: "scheduled",
      states: [s("scheduled", "Scheduled"), s("in_preparation", "In preparation", "info"), s("reviewed", "Reviewed", "info"), s("submitted", "Submitted", "good", true)],
      transitions: [
        { key: "prepare", label: "Start preparation", from: ["scheduled"], to: "in_preparation" },
        { key: "review", label: "Sign off review", from: ["in_preparation"], to: "reviewed", roles: ["compliance", "cro"], ownerAllowed: false, fourEyes: true },
        { key: "submit", label: "Record submission", from: ["reviewed"], to: "submitted", requires: ["submitted_date", "reference"] },
      ],
    },
  },
  {
    key: "product_approval",
    module: "compliance",
    label: "Product approval",
    plural: "Product governance",
    prefix: "PRD",
    fields: [
      { key: "product_line", label: "Business line", type: "select", options: BUSINESS_LINES, list: true },
      { key: "change_type", label: "New or changed", type: "select", options: ["New product", "Material change", "Withdrawal"], list: true },
      { key: "description", label: "Product description", type: "textarea" },
      { key: "signoffs", label: "Internal sign-offs (underwriting, actuarial, legal, risk, reinsurance)", type: "textarea" },
      { key: "filing_date", label: "Filed with NAICOM", type: "date" },
      { key: "naicom_ref", label: "NAICOM reference", type: "text" },
      { key: "approval_date", label: "NAICOM approval date", type: "date" },
    ],
    workflow: {
      initial: "draft",
      states: [s("draft", "Draft"), s("internal_review", "Internal review", "info"), s("approved_internally", "Approved internally", "info"), s("filed", "Filed with NAICOM", "warn"), s("approved", "Approved by NAICOM", "good", true), s("rejected", "Rejected", "bad", true)],
      transitions: [
        { key: "review", label: "Send for internal review", from: ["draft"], to: "internal_review" },
        { key: "approve_int", label: "Approve internally", from: ["internal_review"], to: "approved_internally", roles: ["cro", "compliance"], ownerAllowed: false, fourEyes: true },
        { key: "file", label: "Record NAICOM filing", from: ["approved_internally"], to: "filed", requires: ["filing_date"] },
        { key: "naicom_ok", label: "Record NAICOM approval", from: ["filed"], to: "approved", requires: ["approval_date"] },
        { key: "reject", label: "Record rejection", from: ["internal_review", "filed"], to: "rejected", commentRequired: true },
      ],
    },
  },
  {
    key: "training",
    module: "compliance",
    label: "Training record",
    plural: "Training",
    prefix: "TRN",
    dueField: "due_date",
    fields: [
      { key: "course", label: "Course", type: "select", options: ["AML/CFT/CPF", "Anti-fraud", "Anti-bribery", "Conduct and complaints handling", "Data protection", "HSE induction", "Conflicts of interest"], list: true, required: true },
      { key: "due_date", label: "Due", type: "date", list: true },
      { key: "completion_date", label: "Completed on", type: "date" },
      { key: "expiry_date", label: "Valid until", type: "date" },
      { key: "score", label: "Score (%)", type: "number", min: 0, max: 100 },
    ],
    workflow: simpleFlow(
      [s("assigned", "Assigned", "warn"), s("completed", "Completed", "good"), s("expired", "Expired", "neutral", true)],
      [
        { key: "complete", label: "Record completion", from: "assigned", to: "completed" },
        { key: "expire", label: "Mark expired", from: "completed", to: "expired", roles: ["compliance"] },
      ],
    ),
  },
];

// ---------------------------------------------------------------------------
// MODULE 3: ACTION TRACKING (+ board governance)
// ---------------------------------------------------------------------------
const actions: TypeDef[] = [
  {
    key: "action",
    module: "actions",
    label: "Action",
    plural: "Actions",
    prefix: "ACT",
    dueField: "due_date",
    hook: "action",
    editRoles: ["risk", "compliance", "auditor", "cro", "admin"],
    fields: [
      { key: "source", label: "Raised from", type: "select", list: true, options: ["Risk", "Appetite breach", "Control test", "Internal audit finding", "Regulator finding", "Case", "Policy exception", "Regulatory change", "Board decision", "BCM exercise", "Third party", "Other"] },
      { key: "description", label: "What will be done", type: "textarea", required: true },
      { key: "priority", label: "Priority", type: "select", options: RATINGS, list: true, required: true },
      { key: "due_date", label: "Due date", type: "date", required: true, list: true },
      { key: "original_due_date", label: "Original due date", type: "computed", readOnly: true },
      { key: "extensions", label: "Extensions granted", type: "computed", readOnly: true },
      { key: "progress", label: "Progress (%)", type: "number", min: 0, max: 100, list: true },
      { key: "progress_note", label: "Latest update", type: "textarea" },
      { key: "new_due_date", label: "Requested new due date", type: "date", section: "Extension" },
      { key: "extension_reason", label: "Reason for extension", type: "textarea", section: "Extension" },
      { key: "closure_evidence", label: "Closure evidence", type: "textarea", section: "Closure" },
      { key: "validator", label: "Validator", type: "user", section: "Closure", help: "Required for high and critical actions and regulator findings" },
    ],
    workflow: {
      initial: "proposed",
      states: [
        s("proposed", "Proposed"),
        s("agreed", "Agreed", "info"),
        s("in_progress", "In progress", "info"),
        s("extension_requested", "Extension requested", "warn"),
        s("ready_for_validation", "Ready for validation", "warn"),
        s("closed", "Closed", "good", true),
        s("cancelled", "Cancelled", "neutral", true),
      ],
      transitions: [
        { key: "accept", label: "Accept ownership", from: ["proposed"], to: "agreed" },
        { key: "start", label: "Start work", from: ["agreed"], to: "in_progress" },
        { key: "request_ext", label: "Request extension", from: ["agreed", "in_progress"], to: "extension_requested", requires: ["new_due_date", "extension_reason"] },
        { key: "approve_ext", label: "Approve extension", from: ["extension_requested"], to: "in_progress", roles: ["risk", "cro", "compliance", "auditor"], ownerAllowed: false },
        { key: "reject_ext", label: "Reject extension", from: ["extension_requested"], to: "in_progress", roles: ["risk", "cro", "compliance", "auditor"], ownerAllowed: false, commentRequired: true },
        { key: "ready", label: "Submit for validation", from: ["in_progress"], to: "ready_for_validation", requires: ["closure_evidence"] },
        { key: "validate", label: "Validate and close", from: ["ready_for_validation"], to: "closed", roles: ["risk", "compliance", "auditor", "cro"], ownerAllowed: false, fourEyes: true },
        { key: "return", label: "Return to owner", from: ["ready_for_validation"], to: "in_progress", roles: ["risk", "compliance", "auditor", "cro"], ownerAllowed: false, commentRequired: true },
        { key: "cancel", label: "Cancel", from: ["proposed", "agreed", "in_progress"], to: "cancelled", roles: ["risk", "cro", "compliance"], commentRequired: true },
      ],
    },
  },
  {
    key: "meeting",
    module: "actions",
    label: "Board or committee meeting",
    plural: "Board meetings",
    prefix: "MTG",
    createRoles: ["board", "admin", "compliance", "cro"],
    fields: [
      { key: "committee", label: "Committee", type: "select", options: ["Board of Directors", "Board Audit Committee", "Board Risk Management Committee", "Board Investment Committee", "Board Nomination and Governance Committee", "Executive Committee"], list: true, required: true },
      { key: "meeting_date", label: "Date", type: "date", list: true, required: true },
      { key: "quorate", label: "Quorum present", type: "checkbox" },
      { key: "attendees", label: "Attendance", type: "textarea" },
      { key: "minutes", label: "Minutes", type: "textarea" },
      { key: "decisions", label: "Decisions taken", type: "textarea", help: "Create an action for each decision that needs follow-up" },
    ],
    workflow: simpleFlow(
      [s("scheduled", "Scheduled"), s("held", "Held", "info"), s("minutes_approved", "Minutes approved", "good", true)],
      [
        { key: "hold", label: "Record meeting held", from: "scheduled", to: "held" },
        { key: "approve", label: "Approve minutes", from: "held", to: "minutes_approved", roles: ["board", "compliance"] },
      ],
    ),
  },
];

// ---------------------------------------------------------------------------
// MODULE 4: STAFF DECLARATIONS
// ---------------------------------------------------------------------------
const DECL_TYPES = [
  "Annual conflict of interest declaration",
  "Ad hoc conflict of interest",
  "Gift or hospitality",
  "Outside interest or directorship",
  "Related-party transaction",
  "Personal account dealing",
  "Fit and proper attestation",
];
const declarations: TypeDef[] = [
  {
    key: "declaration",
    module: "declarations",
    label: "Declaration",
    plural: "Declarations",
    prefix: "DEC",
    hook: "declaration",
    confidential: { roles: ["compliance", "mlro", "admin"] },
    editRoles: ["compliance", "mlro"],
    fields: [
      { key: "decl_type", label: "Declaration type", type: "select", options: DECL_TYPES, required: true, list: true },
      { key: "nil_return", label: "I have nothing to declare (nil return)", type: "checkbox", showIf: { field: "decl_type", in: ["Annual conflict of interest declaration"] } },
      { key: "counterparty", label: "Counterparty name", type: "text", list: true, showIf: { field: "nil_return", in: [false] } },
      { key: "counterparty_type", label: "Counterparty type", type: "select", options: ["Broker", "Reinsurer", "Agent", "Supplier", "Claimant", "Policyholder", "Competitor", "Regulator", "Other"], showIf: { field: "nil_return", in: [false] } },
      { key: "relationship", label: "Nature of interest or relationship", type: "textarea", showIf: { field: "nil_return", in: [false] } },
      { key: "gift_direction", label: "Given or received", type: "select", options: ["Received", "Given"], showIf: { field: "decl_type", in: ["Gift or hospitality"] } },
      { key: "gift_value", label: "Estimated value (NGN)", type: "currency", showIf: { field: "decl_type", in: ["Gift or hospitality"] } },
      { key: "event_date", label: "Date", type: "date" },
      { key: "triage", label: "Routing", type: "computed", readOnly: true, list: true },
      { key: "review_outcome", label: "Review outcome", type: "select", options: ["No conflict", "Conflict managed with conditions", "Declined / prohibited"], section: "Review" },
      { key: "conditions", label: "Conditions (e.g. recusal from approving named party's claims)", type: "textarea", section: "Review" },
    ],
    workflow: {
      initial: "draft",
      states: [s("draft", "Draft"), s("manager_review", "Manager review", "info"), s("compliance_review", "Compliance review", "warn"), s("filed", "Filed (nil return)", "good", true), s("completed", "Completed", "good", true)],
      transitions: [
        { key: "submit", label: "Submit declaration", from: ["draft"], to: "manager_review", requires: ["decl_type"] },
        { key: "escalate", label: "Escalate to Compliance", from: ["manager_review"], to: "compliance_review", roles: ["compliance", "mlro"] },
        { key: "complete_mgr", label: "Complete review", from: ["manager_review"], to: "completed", roles: ["compliance", "mlro"], ownerAllowed: false, requires: ["review_outcome"] },
        { key: "complete", label: "Complete review", from: ["compliance_review"], to: "completed", roles: ["compliance", "mlro"], ownerAllowed: false, fourEyes: true, requires: ["review_outcome"] },
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// MODULE 5: CASE MANAGEMENT
// ---------------------------------------------------------------------------
export const CASE_TYPES = [
  "Operational incident",
  "Customer complaint",
  "Suspected claims fraud",
  "Internal fraud or misconduct",
  "Whistleblowing report",
  "AML/CFT suspicious activity",
  "Data protection breach",
  "Regulatory breach",
  "HSE incident",
];
export const WALLED_CASE_TYPES = ["Internal fraud or misconduct", "Whistleblowing report", "AML/CFT suspicious activity"];
const cases: TypeDef[] = [
  {
    key: "case",
    module: "cases",
    label: "Case",
    plural: "Cases",
    prefix: "CAS",
    hook: "case",
    dueField: "clock_due",
    editRoles: ["investigator", "compliance", "risk", "mlro", "hse"],
    confidential: { roles: ["investigator", "mlro"], whenField: "case_type", whenIn: WALLED_CASE_TYPES },
    fields: [
      { key: "case_type", label: "Case type", type: "select", options: CASE_TYPES, required: true, list: true },
      { key: "channel", label: "How it was reported", type: "select", options: ["Staff form", "Anonymous portal", "Email", "Hotline", "Core system", "NAICOM referral", "Broker"] },
      { key: "business_line", label: "Business line", type: "select", options: BUSINESS_LINES },
      { key: "reported_date", label: "Reported on", type: "date", required: true },
      { key: "description", label: "What happened", type: "textarea", required: true },
      { key: "severity", label: "Severity", type: "select", options: RATINGS, list: true },
      { key: "clock_due", label: "Response or notification due", type: "computed", readOnly: true, list: true },
      { key: "subjects", label: "Parties involved", type: "textarea", section: "Investigation" },
      { key: "claim_ref", label: "Related claim or policy number", type: "text", section: "Investigation" },
      { key: "amount_at_risk", label: "Amount at risk (NGN)", type: "currency", section: "Financials" },
      { key: "amount_saved", label: "Amount saved or recovered (NGN)", type: "currency", section: "Financials" },
      { key: "amount_written_off", label: "Amount written off (NGN)", type: "currency", section: "Financials" },
      { key: "lost_time_days", label: "Lost-time days", type: "number", section: "Investigation", showIf: { field: "case_type", in: ["HSE incident"] } },
      { key: "root_cause", label: "Root cause", type: "select", options: ["People", "Process", "Systems", "External", "Third party", "Deliberate fraud"], section: "Outcome" },
      { key: "findings", label: "Findings", type: "textarea", section: "Outcome" },
      { key: "outcome", label: "Outcome", type: "select", options: ["Substantiated", "Partially substantiated", "Unsubstantiated", "Resolved in customer's favour", "Resolved in our favour"], section: "Outcome" },
      { key: "lessons", label: "Lessons learned", type: "textarea", section: "Outcome" },
      { key: "legal_hold", label: "Legal hold (suspend deletion)", type: "checkbox", section: "Outcome" },
    ],
    workflow: {
      initial: "reported",
      states: [s("reported", "Reported", "warn"), s("triaged", "Triaged", "info"), s("investigating", "Investigating", "info"), s("findings", "Findings ready", "info"), s("closed", "Closed", "good", true)],
      transitions: [
        { key: "triage", label: "Triage", from: ["reported"], to: "triaged", roles: ["investigator", "compliance", "risk", "mlro", "hse"], requires: ["severity"] },
        { key: "investigate", label: "Start investigation", from: ["triaged"], to: "investigating" },
        { key: "findings", label: "Record findings", from: ["investigating"], to: "findings", requires: ["findings", "root_cause"] },
        { key: "close", label: "Close case", from: ["findings"], to: "closed", roles: ["investigator", "compliance", "risk", "mlro", "hse"], ownerAllowed: false, fourEyes: true, requires: ["outcome"] },
        { key: "reopen", label: "Reopen", from: ["closed"], to: "investigating", roles: ["investigator", "compliance", "mlro"], commentRequired: true },
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// MODULE 6: ESG / EHS
// ---------------------------------------------------------------------------
const esg: TypeDef[] = [
  {
    key: "esg_metric",
    module: "esg",
    label: "ESG metric",
    plural: "ESG metrics",
    prefix: "ESG",
    hook: "esg_metric",
    editRoles: ["esg", "admin"],
    fields: [
      { key: "pillar", label: "Pillar", type: "select", options: ["Environmental", "Social", "Governance"], list: true, required: true },
      { key: "unit", label: "Unit of activity", type: "text", list: true, help: "For example litres of diesel, kWh, headcount" },
      { key: "scope", label: "Emissions scope", type: "select", options: ["Not an emissions metric", "Scope 1", "Scope 2", "Scope 3"] },
      { key: "emission_factor", label: "Emission factor (kgCO2e per unit)", type: "number", showIf: { field: "scope", in: ["Scope 1", "Scope 2", "Scope 3"] } },
      { key: "frameworks", label: "Disclosure frameworks", type: "multiselect", options: ["IFRS S1", "IFRS S2", "GRI", "NGX sustainability disclosure", "UNEP FI PSI"] },
      { key: "target", label: "Target value", type: "number" },
      { key: "target_year", label: "Target year", type: "number" },
      { key: "method", label: "Method and boundary", type: "textarea" },
      { key: "latest_value", label: "Latest value", type: "computed", readOnly: true, list: true },
      { key: "latest_tco2e", label: "Latest tCO2e", type: "computed", readOnly: true, list: true },
    ],
    workflow: simpleFlow(
      [s("active", "Collecting", "good"), s("retired", "Retired", "neutral", true)],
      [{ key: "retire", label: "Retire", from: "active", to: "retired", roles: ["esg"] }],
    ),
  },
  {
    key: "uw_screen",
    module: "esg",
    label: "ESG underwriting screen",
    plural: "Underwriting screens",
    prefix: "UWS",
    fields: [
      { key: "client", label: "Prospective insured", type: "text", list: true, required: true },
      { key: "sector", label: "Sector", type: "select", options: ["Oil and gas", "Mining", "Agriculture", "Power", "Manufacturing", "Construction", "Other"], list: true },
      { key: "red_flags", label: "Red flags", type: "multiselect", options: ["Gas flaring", "Oil spill history", "No environmental impact assessment", "Community conflict", "Child or forced labour", "Sanctions exposure", "Deforestation"] },
      { key: "decision", label: "Decision", type: "select", options: ["Proceed", "Proceed with conditions", "Decline"], list: true },
      { key: "conditions", label: "Conditions or rationale", type: "textarea" },
    ],
    workflow: simpleFlow(
      [s("submitted", "Submitted", "info"), s("referred", "Referred to sustainability lead", "warn"), s("decided", "Decided", "good", true)],
      [
        { key: "refer", label: "Refer", from: "submitted", to: "referred" },
        { key: "decide", label: "Record decision", from: "referred", to: "decided", roles: ["esg", "cro"] },
      ],
    ),
  },
  {
    key: "hse_inspection",
    module: "esg",
    label: "HSE inspection",
    plural: "HSE inspections",
    prefix: "INS",
    dueField: "inspection_date",
    fields: [
      { key: "site", label: "Site", type: "text", list: true, required: true },
      { key: "inspection_type", label: "Inspection type", type: "select", options: ["Fire safety", "Generator room", "Fleet", "Office ergonomics", "Branch premises"], list: true },
      { key: "inspection_date", label: "Date", type: "date", list: true },
      { key: "score", label: "Score (%)", type: "number", min: 0, max: 100, list: true },
      { key: "findings", label: "Findings", type: "textarea" },
    ],
    workflow: simpleFlow(
      [s("scheduled", "Scheduled"), s("completed", "Completed", "info"), s("closed", "Findings closed", "good", true)],
      [
        { key: "complete", label: "Record inspection", from: "scheduled", to: "completed" },
        { key: "close", label: "Close findings", from: "completed", to: "closed", roles: ["hse"] },
      ],
    ),
  },
  {
    key: "permit",
    module: "esg",
    label: "Permit or certificate",
    plural: "Permits and certificates",
    prefix: "PRM",
    dueField: "expiry_date",
    fields: [
      { key: "permit_type", label: "Type", type: "select", options: ["Fire certificate", "Generator emission permit", "Fleet roadworthiness", "Waste licence", "Building approval", "Other"], list: true },
      { key: "site", label: "Site or asset", type: "text", list: true },
      { key: "issuer", label: "Issued by", type: "text" },
      { key: "expiry_date", label: "Expires", type: "date", list: true, required: true },
    ],
    workflow: simpleFlow(
      [s("valid", "Valid", "good"), s("renewal", "Renewal in progress", "warn"), s("expired", "Expired", "bad", true)],
      [
        { key: "renew", label: "Start renewal", from: "valid", to: "renewal" },
        { key: "renewed", label: "Renewed", from: "renewal", to: "valid" },
        { key: "expire", label: "Mark expired", from: "valid", to: "expired" },
      ],
    ),
  },
];

// ---------------------------------------------------------------------------
// MODULE 7: THIRD-PARTY AND OUTSOURCING RISK
// ---------------------------------------------------------------------------
const thirdparty: TypeDef[] = [
  {
    key: "third_party",
    module: "thirdparty",
    label: "Third party",
    plural: "Third-party register",
    prefix: "TPY",
    hook: "third_party",
    dueField: "next_assessment",
    editRoles: ["risk", "compliance", "admin"],
    fields: [
      { key: "tp_type", label: "Type", type: "select", required: true, list: true, options: ["Reinsurer", "Broker", "Agent", "Bancassurance partner", "TPA / HMO", "Hospital", "Loss adjuster", "Surveyor", "Repair workshop", "IT or cloud provider", "Outsourced service provider", "Investment manager", "Custodian"] },
      { key: "rc_number", label: "RC number", type: "text" },
      { key: "services", label: "Services provided", type: "textarea" },
      { key: "business_lines", label: "Business lines served", type: "multiselect", options: BUSINESS_LINES },
      { key: "critical_service", label: "Supports an important business service", type: "select", options: ["Yes", "No"], section: "Tiering", required: true },
      { key: "data_access", label: "Access to policyholder data", type: "select", options: ["None", "Limited", "Extensive"], section: "Tiering", required: true },
      { key: "substitutability", label: "How hard to replace", type: "select", options: ["Easy", "Moderate", "Hard"], section: "Tiering", required: true },
      { key: "regulatory_significance", label: "Regulatory significance (e.g. material outsourcing)", type: "checkbox", section: "Tiering" },
      { key: "tier", label: "Tier", type: "computed", readOnly: true, list: true, section: "Tiering" },
      { key: "annual_value", label: "Annual spend or premium ceded (NGN)", type: "currency", section: "Tiering" },
      { key: "rating_agency", label: "Rating agency", type: "text", section: "Reinsurer security", showIf: { field: "tp_type", in: ["Reinsurer"] } },
      { key: "rating", label: "Financial strength rating", type: "text", section: "Reinsurer security", showIf: { field: "tp_type", in: ["Reinsurer"] } },
      { key: "rating_date", label: "Rating date", type: "date", section: "Reinsurer security", showIf: { field: "tp_type", in: ["Reinsurer"] } },
      { key: "licence_number", label: "NAICOM licence number", type: "text", section: "Licensing", showIf: { field: "tp_type", in: ["Broker", "Agent", "Loss adjuster", "Reinsurer"] } },
      { key: "licence_expiry", label: "Licence expiry", type: "date", section: "Licensing", showIf: { field: "tp_type", in: ["Broker", "Agent", "Loss adjuster", "Reinsurer"] } },
      { key: "contract_end", label: "Contract end", type: "date", section: "Contract" },
      { key: "key_clauses", label: "Key clauses present", type: "multiselect", section: "Contract", options: ["Audit rights", "Data protection", "Termination and exit", "Sub-outsourcing consent", "Business continuity", "SLA and service credits"] },
      { key: "exit_plan", label: "Exit plan", type: "textarea", section: "Contract" },
      { key: "security_ref", label: "Security assessment reference (SecureComply)", type: "text", section: "Contract", showIf: { field: "tp_type", in: ["IT or cloud provider", "Outsourced service provider"] } },
      { key: "last_assessment", label: "Last assessment", type: "date", section: "Monitoring" },
      { key: "next_assessment", label: "Next assessment due", type: "computed", readOnly: true, list: true, section: "Monitoring" },
    ],
    workflow: {
      initial: "requested",
      states: [s("requested", "Onboarding requested"), s("due_diligence", "Due diligence", "info"), s("approved", "Approved", "good"), s("suspended", "Suspended", "bad"), s("exited", "Exited", "neutral", true)],
      transitions: [
        { key: "dd", label: "Start due diligence", from: ["requested"], to: "due_diligence" },
        { key: "approve", label: "Approve third party", from: ["due_diligence"], to: "approved", roles: ["risk", "compliance", "cro"], ownerAllowed: false, fourEyes: true, requires: ["critical_service", "data_access", "substitutability"] },
        { key: "suspend", label: "Suspend", from: ["approved"], to: "suspended", roles: ["risk", "compliance", "cro"], commentRequired: true },
        { key: "reinstate", label: "Reinstate", from: ["suspended"], to: "approved", roles: ["risk", "compliance", "cro"] },
        { key: "exit", label: "Exit relationship", from: ["approved", "suspended"], to: "exited", roles: ["risk", "compliance", "cro"], commentRequired: true },
      ],
    },
  },
  {
    key: "tp_assessment",
    module: "thirdparty",
    label: "Third-party assessment",
    plural: "Third-party assessments",
    prefix: "TPA",
    hook: "tp_assessment",
    fields: [
      { key: "assessment_type", label: "Assessment type", type: "select", options: ["Onboarding", "Periodic", "Event-driven"], list: true },
      { key: "assessment_date", label: "Date", type: "date", list: true },
      { key: "financial", label: "Financial condition", type: "select", options: ["Strong", "Adequate", "Weak"] },
      { key: "conduct", label: "Conduct and complaints", type: "select", options: ["Strong", "Adequate", "Weak"] },
      { key: "operational", label: "Operational performance against SLA", type: "select", options: ["Strong", "Adequate", "Weak"] },
      { key: "screening", label: "Sanctions, PEP and adverse media screening", type: "select", options: ["Clear", "Potential match - reviewed", "Match"] },
      { key: "overall", label: "Overall conclusion", type: "select", options: ["Satisfactory", "Needs improvement", "Unsatisfactory"], list: true },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    workflow: {
      initial: "in_progress",
      states: [s("in_progress", "In progress", "info"), s("review", "Awaiting sign-off", "warn"), s("completed", "Completed", "good", true)],
      transitions: [
        { key: "submit", label: "Submit for sign-off", from: ["in_progress"], to: "review", requires: ["overall"] },
        { key: "approve", label: "Sign off", from: ["review"], to: "completed", roles: ["risk", "compliance", "cro"], ownerAllowed: false, fourEyes: true },
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// MODULE 8: INTERNAL AUDIT
// ---------------------------------------------------------------------------
const audit: TypeDef[] = [
  {
    key: "audit_entity",
    module: "audit",
    label: "Auditable entity",
    plural: "Audit universe",
    prefix: "AUE",
    hook: "audit_entity",
    createRoles: ["auditor", "admin"],
    editRoles: ["auditor", "admin"],
    fields: [
      { key: "entity_type", label: "Entity type", type: "select", options: ["Business line", "Function", "Branch", "Process", "Third party"], list: true },
      { key: "inherent_risk", label: "Inherent risk", type: "select", options: RATINGS, list: true, help: "Take from the linked ERM risks where possible" },
      { key: "regulatory_focus", label: "Regulatory focus area", type: "checkbox" },
      { key: "last_audit", label: "Last audited", type: "date", list: true },
      { key: "priority_score", label: "Audit priority score", type: "computed", readOnly: true, list: true },
    ],
    workflow: simpleFlow(
      [s("active", "In universe", "good"), s("retired", "Retired", "neutral", true)],
      [{ key: "retire", label: "Retire", from: "active", to: "retired", roles: ["auditor"] }],
    ),
  },
  {
    key: "engagement",
    module: "audit",
    label: "Audit engagement",
    plural: "Audit plan",
    prefix: "AUD",
    createRoles: ["auditor", "admin"],
    editRoles: ["auditor", "admin"],
    dueField: "report_date",
    fields: [
      { key: "plan_year", label: "Plan year", type: "number", list: true },
      { key: "quarter", label: "Quarter", type: "select", options: ["Q1", "Q2", "Q3", "Q4"], list: true },
      { key: "scope", label: "Scope", type: "textarea" },
      { key: "objectives", label: "Objectives", type: "textarea" },
      { key: "budget_hours", label: "Budget hours", type: "number" },
      { key: "actual_hours", label: "Actual hours", type: "number" },
      { key: "report_date", label: "Planned report date", type: "date", list: true },
      { key: "independence_confirmed", label: "Team independence confirmed (no conflicts declared)", type: "checkbox" },
      { key: "overall_rating", label: "Overall rating", type: "select", options: ["Satisfactory", "Needs improvement", "Unsatisfactory"], list: true },
    ],
    workflow: {
      initial: "planned",
      states: [s("planned", "Planned"), s("plan_approved", "Plan approved", "info"), s("fieldwork", "Fieldwork", "info"), s("draft_report", "Draft report", "warn"), s("final_report", "Final report issued", "good"), s("closed", "Closed", "good", true)],
      transitions: [
        { key: "approve_plan", label: "Approve (Audit Committee)", from: ["planned"], to: "plan_approved", roles: ["board", "auditor"], ownerAllowed: false, fourEyes: true },
        { key: "fieldwork", label: "Start fieldwork", from: ["plan_approved"], to: "fieldwork", requires: ["independence_confirmed"] },
        { key: "draft", label: "Issue draft report", from: ["fieldwork"], to: "draft_report" },
        { key: "final", label: "Issue final report", from: ["draft_report"], to: "final_report", roles: ["auditor"], ownerAllowed: false, fourEyes: true, requires: ["overall_rating"] },
        { key: "close", label: "Close engagement", from: ["final_report"], to: "closed", roles: ["auditor"] },
      ],
    },
  },
  {
    key: "workpaper",
    module: "audit",
    label: "Working paper",
    plural: "Working papers",
    prefix: "WP",
    createRoles: ["auditor"],
    editRoles: ["auditor"],
    confidential: { roles: ["auditor", "admin"] },
    fields: [
      { key: "test_step", label: "Test step", type: "textarea", required: true },
      { key: "work_done", label: "Work performed", type: "textarea" },
      { key: "conclusion", label: "Conclusion", type: "select", options: ["Satisfactory", "Exception noted", "Not tested"], list: true },
      { key: "review_notes", label: "Reviewer notes", type: "textarea" },
    ],
    workflow: {
      initial: "prepared",
      states: [s("prepared", "Prepared", "info"), s("reviewed", "Reviewed", "good", true)],
      transitions: [{ key: "review", label: "Sign off review", from: ["prepared"], to: "reviewed", roles: ["auditor"], ownerAllowed: false, fourEyes: true }],
    },
  },
];

// ---------------------------------------------------------------------------
// MODULE 9: BUSINESS CONTINUITY AND OPERATIONAL RESILIENCE
// ---------------------------------------------------------------------------
const bcm: TypeDef[] = [
  {
    key: "business_service",
    module: "bcm",
    label: "Important business service",
    plural: "Important business services",
    prefix: "IBS",
    editRoles: ["risk", "cro", "admin"],
    fields: [
      { key: "description", label: "Description", type: "textarea" },
      { key: "tolerance_hours", label: "Impact tolerance (max hours of disruption)", type: "number", required: true, list: true },
      { key: "peak_periods", label: "Peak periods", type: "text" },
      { key: "dependencies", label: "Key dependencies (people, sites, systems, third parties)", type: "textarea" },
      { key: "last_exercise", label: "Last exercised", type: "date", list: true },
      { key: "tolerance_status", label: "Last exercise result", type: "select", options: ["Within tolerance", "Outside tolerance", "Not tested"], list: true },
    ],
    workflow: simpleFlow(
      [s("active", "Active", "good"), s("retired", "Retired", "neutral", true)],
      [{ key: "retire", label: "Retire", from: "active", to: "retired", roles: ["risk", "cro"] }],
    ),
  },
  {
    key: "bia",
    module: "bcm",
    label: "Business impact analysis",
    plural: "BIAs",
    prefix: "BIA",
    fields: [
      { key: "process", label: "Process", type: "text", list: true, required: true },
      { key: "mtpd_hours", label: "Maximum tolerable period of disruption (hours)", type: "number", list: true },
      { key: "rto_hours", label: "Recovery time objective (hours)", type: "number", list: true },
      { key: "rpo_hours", label: "Recovery point objective (hours)", type: "number" },
      { key: "min_staff", label: "Minimum staff to operate", type: "number" },
      { key: "systems", label: "Systems relied on", type: "textarea", help: "System list comes from SecureComply where connected" },
      { key: "third_parties", label: "Third parties relied on", type: "textarea" },
      { key: "financial_impact", label: "Financial impact if down for a day", type: "select", options: RATINGS },
      { key: "regulatory_impact", label: "Regulatory impact if down for a day", type: "select", options: RATINGS },
    ],
    workflow: approvalFlow({ approveRoles: ["risk", "cro"] }),
  },
  {
    key: "bc_plan",
    module: "bcm",
    label: "Continuity plan",
    plural: "Continuity plans",
    prefix: "BCP",
    dueField: "next_review",
    fields: [
      { key: "scope", label: "Service or site covered", type: "text", list: true },
      { key: "version", label: "Version", type: "text" },
      { key: "call_tree", label: "Call tree", type: "textarea" },
      { key: "recovery_steps", label: "Recovery steps", type: "textarea" },
      { key: "next_review", label: "Next review", type: "date", list: true },
    ],
    workflow: approvalFlow({ approveRoles: ["risk", "cro"] }),
  },
  {
    key: "bc_exercise",
    module: "bcm",
    label: "Continuity exercise",
    plural: "Exercises",
    prefix: "EXR",
    hook: "bc_exercise",
    fields: [
      { key: "exercise_type", label: "Exercise type", type: "select", options: ["Tabletop", "Simulation", "DR test", "Live failover"], list: true },
      { key: "scenario", label: "Scenario", type: "select", list: true, options: ["Core system loss", "Cyber incident", "Branch flood or fire", "Prolonged power and diesel outage", "Key reinsurer or TPA failure", "Pandemic"] },
      { key: "exercise_date", label: "Date", type: "date" },
      { key: "recovery_hours", label: "Time to recover (hours)", type: "number" },
      { key: "met_tolerance", label: "Recovered within impact tolerance", type: "select", options: ["Yes", "No"], list: true },
      { key: "lessons", label: "Lessons and gaps", type: "textarea" },
    ],
    workflow: simpleFlow(
      [s("planned", "Planned"), s("completed", "Completed", "good", true)],
      [{ key: "complete", label: "Record results", from: "planned", to: "completed" }],
    ),
  },
];

export const DEFAULT_TYPES: TypeDef[] = [
  ...erm,
  ...policy,
  ...compliance,
  ...actions,
  ...declarations,
  ...cases,
  ...esg,
  ...thirdparty,
  ...audit,
  ...bcm,
];

// The "record_review" transition requirement for exercise needs met_tolerance.
for (const t of DEFAULT_TYPES) {
  if (t.key === "bc_exercise") t.workflow.transitions[0].requires = ["met_tolerance", "recovery_hours"];
}
