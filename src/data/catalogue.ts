export const departments = [
  { id: "EXC", code: "EXC", name: "Executive office" },
  { id: "BRD", code: "BRD", name: "Board secretariat" },
  { id: "UW", code: "UW", name: "General underwriting" },
  { id: "MEN", code: "MEN", name: "Marine and energy" },
  { id: "HLT", code: "HLT", name: "Health" },
  { id: "LIF", code: "LIF", name: "Life" },
  { id: "CLM", code: "CLM", name: "Claims" },
  { id: "FIN", code: "FIN", name: "Finance and investments" },
  { id: "ACT", code: "ACT", name: "Actuarial" },
  { id: "CMP", code: "CMP", name: "Compliance and legal" },
  { id: "RSK", code: "RSK", name: "Risk management" },
  { id: "IT", code: "IT", name: "Information technology" },
  { id: "IA", code: "IA", name: "Internal audit" },
  { id: "HC", code: "HC", name: "Human capital" },
  { id: "DST", code: "DST", name: "Distribution" },
  { id: "REI", code: "REI", name: "Reinsurance" },
] as const;

export const users = [
  { id: "ada", email: "ada.okonkwo@harbourline.example", name: "Adaeze Okonkwo", role: "ADMIN", title: "Head of GRC operations", departmentId: "RSK" },
  { id: "efe", email: "efe.adeyemi@harbourline.example", name: "Efe Adeyemi", role: "RISK_MANAGER", title: "Chief Risk Officer", departmentId: "RSK" },
  { id: "chioma", email: "chioma.nwosu@harbourline.example", name: "Chioma Nwosu", role: "COMPLIANCE_OFFICER", title: "Chief Compliance Officer", departmentId: "CMP" },
  { id: "tunde", email: "tunde.bakare@harbourline.example", name: "Tunde Bakare", role: "STAFF", title: "Senior underwriter, motor and property", departmentId: "UW" },
  { id: "ireti", email: "ireti.balogun@harbourline.example", name: "Ireti Balogun", role: "BOARD_VIEWER", title: "Chair, Board Risk Committee", departmentId: "BRD" },
  { id: "funke", email: "funke.adewale@harbourline.example", name: "Funke Adewale", role: "STAFF", title: "Head of claims operations", departmentId: "CLM" },
  { id: "ibrahim", email: "ibrahim.sule@harbourline.example", name: "Ibrahim Sule", role: "STAFF", title: "Treasurer", departmentId: "FIN" },
  { id: "ngozi", email: "ngozi.eze@harbourline.example", name: "Ngozi Eze", role: "STAFF", title: "Head of information security", departmentId: "IT" },
  { id: "segun", email: "segun.falana@harbourline.example", name: "Segun Falana", role: "STAFF", title: "Internal audit manager", departmentId: "IA" },
  { id: "halima", email: "halima.bello@harbourline.example", name: "Halima Bello", role: "STAFF", title: "Human capital business partner", departmentId: "HC" },
  { id: "amina", email: "amina.yusuf@harbourline.example", name: "Amina Yusuf", role: "STAFF", title: "Health business lead", departmentId: "HLT" },
  { id: "chinedu", email: "chinedu.okafor@harbourline.example", name: "Chinedu Okafor", role: "STAFF", title: "Life actuarial analyst", departmentId: "LIF" },
  { id: "yetunde", email: "yetunde.salami@harbourline.example", name: "Yetunde Salami", role: "STAFF", title: "Marine and energy underwriter", departmentId: "MEN" },
  { id: "kemi", email: "kemi.adeyemi@harbourline.example", name: "Kemi Adeyemi", role: "STAFF", title: "Head of distribution", departmentId: "DST" },
] as const;

export const appetite = [
  { category: "UNDERWRITING", maxResidualScore: 12, statement: "The board accepts underwriting residual scores up to 12 where rate, accumulation and authority controls are operating. Energy, marine and property accumulations above that limit come to the Risk Committee.", ownerId: "efe" },
  { category: "CREDIT_INVESTMENT", maxResidualScore: 9, statement: "Premium debtors, bank placements and life-annuity counterparties stay at or below a residual score of 9. Broker credit above 90 days is outside appetite.", ownerId: "ibrahim" },
  { category: "MARKET", maxResidualScore: 12, statement: "Market and currency exposure, including dollar claims on energy and marine and the life annuity book, stays at or below a residual score of 12.", ownerId: "efe" },
  { category: "OPERATIONAL", maxResidualScore: 9, statement: "Claims leakage, policy-admin failure and benefit-payment backlogs stay at or below a residual score of 9 across motor, health and life.", ownerId: "efe" },
  { category: "COMPLIANCE", maxResidualScore: 6, statement: "Regulatory and conduct exposure is tightly held. A residual score above 6 is outside appetite and is escalated.", ownerId: "chioma" },
  { category: "CYBER", maxResidualScore: 9, statement: "A ransomware or data-loss scenario affecting policy, claims or health records above a residual score of 9 is outside appetite.", ownerId: "ngozi" },
  { category: "THIRD_PARTY", maxResidualScore: 9, statement: "TPAs, loss adjusters, surveyors, reinsurers and the core-system vendor stay at or below a residual score of 9.", ownerId: "efe" },
  { category: "REPUTATIONAL", maxResidualScore: 6, statement: "Public trust events, including annuity delays and health authorisation disputes, stay at or below a residual score of 6.", ownerId: "chioma" },
  { category: "BCP", maxResidualScore: 9, statement: "A disruption that stops claims or policy service across lines above a residual score of 9 is outside appetite.", ownerId: "efe" },
] as const;

type RiskSeed = {
  code: string;
  title: string;
  description: string;
  category: string;
  line: string;
  departmentId: string;
  ownerId: string;
  li: number;
  ii: number;
  lr: number;
  ir: number;
  treatment: string;
  status: string;
  trend: string;
  emerging?: boolean;
  objective: string;
  controls: string[];
  escalation?: "ESCALATED" | "ACKNOWLEDGED";
  escalationNote?: string;
};

export const risks: RiskSeed[] = [
  { code: "RSK-001", title: "Motor comprehensive rates below burning cost", description: "Lagos and Port Harcourt motor comprehensive rates have drifted below the burning cost after a year of spare-part inflation. The book is still being written on last year's tariff.", category: "UNDERWRITING", line: "Motor", departmentId: "UW", ownerId: "tunde", li: 5, ii: 4, lr: 4, ir: 3, treatment: "MITIGATE", status: "MITIGATING", trend: "UP", objective: "Restore motor rate adequacy without losing the broker panel.", controls: ["CTL-01", "CTL-02"] },
  { code: "RSK-002", title: "Property fire accumulation in one industrial cluster", description: "Several commercial property schedules sit in the same Apapa industrial cluster. A single fire could exhaust the property surplus treaty.", category: "UNDERWRITING", line: "Property", departmentId: "UW", ownerId: "tunde", li: 3, ii: 5, lr: 3, ir: 4, treatment: "TRANSFER", status: "MITIGATING", trend: "STABLE", objective: "Keep single-location property accumulation inside treaty capacity.", controls: ["CTL-02", "CTL-03"] },
  { code: "RSK-003", title: "Marine cargo accumulation on one voyage", description: "Open-cover cargo from several clients can land on the same vessel through Apapa and Tin Can. Declaration quality from brokers is uneven.", category: "UNDERWRITING", line: "Marine", departmentId: "MEN", ownerId: "yetunde", li: 4, ii: 4, lr: 3, ir: 3, treatment: "MITIGATE", status: "OPEN", trend: "STABLE", objective: "See cargo accumulations before a vessel sails.", controls: ["CTL-01", "CTL-19"] },
  { code: "RSK-004", title: "Energy package written beyond treaty capacity", description: "An upstream energy package was accepted with facultative placement still open. A loss before placement completes would sit net on Harbourline.", category: "UNDERWRITING", line: "Energy", departmentId: "MEN", ownerId: "yetunde", li: 4, ii: 5, lr: 4, ir: 4, treatment: "TRANSFER", status: "MITIGATING", trend: "UP", objective: "No energy risk incepts before facultative is signed down.", controls: ["CTL-02", "CTL-03"], escalation: "ESCALATED", escalationNote: "Risk Committee asked for a placement deadline and a temporary net-line cap." },
  { code: "RSK-005", title: "Corporate health medical inflation", description: "Corporate health schemes are repriced annually while hospital tariffs move twice a year. Loss ratios on three large schemes are above plan.", category: "UNDERWRITING", line: "Health", departmentId: "HLT", ownerId: "amina", li: 5, ii: 3, lr: 4, ir: 3, treatment: "MITIGATE", status: "MITIGATING", trend: "UP", objective: "Bring corporate health loss ratios back inside the plan.", controls: ["CTL-01", "CTL-09"] },
  { code: "RSK-006", title: "Group life claims frequency", description: "Group life on employer schemes is seeing a higher death-claim frequency than the pricing memo assumed, concentrated in two sectors.", category: "UNDERWRITING", line: "Group life", departmentId: "LIF", ownerId: "chinedu", li: 3, ii: 4, lr: 3, ir: 3, treatment: "MITIGATE", status: "OPEN", trend: "UP", objective: "Reprice group life where experience has turned.", controls: ["CTL-01", "CTL-07"] },
  { code: "RSK-007", title: "Retail life lapse and persistency", description: "First-year lapse on retail endowment is above the pricing assumption. Commission clawback is incomplete and the book is thinner than the plan.", category: "UNDERWRITING", line: "Life", departmentId: "LIF", ownerId: "chinedu", li: 4, ii: 3, lr: 3, ir: 3, treatment: "MITIGATE", status: "MITIGATING", trend: "STABLE", objective: "Improve 13-month persistency on retail life.", controls: ["CTL-20"] },
  { code: "RSK-008", title: "Aviation hull pricing gap", description: "The small aviation hull account is priced from aged data. One renewal is due with a hull value that has not been resurveyed.", category: "UNDERWRITING", line: "Aviation", departmentId: "MEN", ownerId: "yetunde", li: 2, ii: 5, lr: 2, ir: 4, treatment: "TRANSFER", status: "OPEN", trend: "STABLE", objective: "Either reprice aviation hull or decline the renewal.", controls: ["CTL-02", "CTL-03"] },
  { code: "RSK-009", title: "Broker anti-selection on property", description: "Two brokers send property risks only after other markets have declined them. Submission quality hides prior losses.", category: "UNDERWRITING", line: "Property", departmentId: "UW", ownerId: "tunde", li: 4, ii: 3, lr: 3, ir: 2, treatment: "AVOID", status: "MITIGATING", trend: "DOWN", objective: "Stop writing declined property business.", controls: ["CTL-01"] },
  { code: "RSK-010", title: "Motor broker premium unpaid past 90 days", description: "Motor premium collected by brokers and not remitted has aged past 90 days. Cover is still shown as in force on the policy system.", category: "CREDIT_INVESTMENT", line: "Motor", departmentId: "FIN", ownerId: "ibrahim", li: 5, ii: 3, lr: 4, ir: 3, treatment: "MITIGATE", status: "MITIGATING", trend: "UP", objective: "Collect or cancel motor premium debt outside terms.", controls: ["CTL-04", "CTL-18"], escalation: "ESCALATED", escalationNote: "Credit committee to freeze new business from two brokers until the aged debt is cleared." },
  { code: "RSK-011", title: "Corporate health counterparty delay", description: "One large employer is slow to settle health scheme premium. Claims are still being authorised against that scheme.", category: "CREDIT_INVESTMENT", line: "Health", departmentId: "HLT", ownerId: "amina", li: 3, ii: 4, lr: 3, ir: 3, treatment: "MITIGATE", status: "OPEN", trend: "STABLE", objective: "Do not fund claims for schemes with unpaid premium.", controls: ["CTL-04", "CTL-05"] },
  { code: "RSK-012", title: "Energy reinsurer security", description: "A reinsurer on the energy panel has been placed on negative outlook. Recoverable estimates assume that security still pays.", category: "CREDIT_INVESTMENT", line: "Energy", departmentId: "REI", ownerId: "efe", li: 3, ii: 5, lr: 2, ir: 4, treatment: "TRANSFER", status: "MITIGATING", trend: "UP", objective: "Keep energy recoverables with securities inside the panel rules.", controls: ["CTL-03", "CTL-05"] },
  { code: "RSK-013", title: "Bank placement concentration", description: "Short-term placements are concentrated in two Nigerian banks above the internal single-name guide.", category: "CREDIT_INVESTMENT", line: "Investments", departmentId: "FIN", ownerId: "ibrahim", li: 3, ii: 4, lr: 2, ir: 3, treatment: "MITIGATE", status: "MITIGATING", trend: "DOWN", objective: "Bring bank placements back inside single-name limits.", controls: ["CTL-06"] },
  { code: "RSK-014", title: "Life annuity bond counterparty", description: "Part of the retiree annuity matching portfolio is a single corporate bond. A default would open a gap against annuity payments.", category: "CREDIT_INVESTMENT", line: "Life", departmentId: "FIN", ownerId: "ibrahim", li: 2, ii: 5, lr: 2, ir: 4, treatment: "MITIGATE", status: "OPEN", trend: "STABLE", objective: "Diversify the annuity matching book.", controls: ["CTL-05", "CTL-06"] },
  { code: "RSK-015", title: "Interest-rate shock on the annuity book", description: "A sharp move in naira yields would revalue the life annuity liabilities faster than the asset book can be rebalanced.", category: "MARKET", line: "Life", departmentId: "ACT", ownerId: "chinedu", li: 4, ii: 4, lr: 3, ir: 4, treatment: "MITIGATE", status: "OPEN", trend: "UP", objective: "Keep the annuity asset-liability gap inside the board limit.", controls: ["CTL-07"] },
  { code: "RSK-016", title: "Equity drawdown against capital", description: "Listed equities held for the shareholders' fund would, in a deep market fall, pressure the solvency margin.", category: "MARKET", line: "Investments", departmentId: "FIN", ownerId: "ibrahim", li: 3, ii: 4, lr: 3, ir: 3, treatment: "MITIGATE", status: "OPEN", trend: "STABLE", objective: "Hold equity exposure inside the investment policy.", controls: ["CTL-06"] },
  { code: "RSK-017", title: "Investment property valuation lag", description: "Owner-occupied and investment properties were last valued more than a year ago. Carrying values may not match a sale.", category: "MARKET", line: "Investments", departmentId: "FIN", ownerId: "ibrahim", li: 3, ii: 3, lr: 2, ir: 3, treatment: "MITIGATE", status: "MITIGATING", trend: "STABLE", objective: "Refresh property valuations before the year-end pack.", controls: ["CTL-06"] },
  { code: "RSK-018", title: "Dollar claims on energy and marine", description: "Energy and marine claims are often settled in dollars while premium and much of the asset book are in naira. A currency gap opens when a large claim is agreed.", category: "MARKET", line: "Energy", departmentId: "FIN", ownerId: "ibrahim", li: 4, ii: 5, lr: 4, ir: 4, treatment: "MITIGATE", status: "MITIGATING", trend: "UP", emerging: true, objective: "Match dollar claim reserves with dollar assets or cover.", controls: ["CTL-06", "CTL-03"], escalation: "ACKNOWLEDGED", escalationNote: "Risk Committee noted the gap and asked treasury for a dollar-asset plan at the next meeting." },
  { code: "RSK-019", title: "Health premium lag versus medical inflation", description: "Even where corporate health rates are updated, the lag versus hospital tariffs leaves a market-pricing gap for the rest of the year.", category: "MARKET", line: "Health", departmentId: "ACT", ownerId: "amina", li: 4, ii: 3, lr: 3, ir: 3, treatment: "ACCEPT", status: "OPEN", trend: "UP", objective: "Price health with a mid-year review trigger.", controls: ["CTL-07"] },
  { code: "RSK-020", title: "Motor claims fraud rings", description: "Repeat workshops and a small set of investigators are linked to inflated motor own-damage claims in Lagos.", category: "OPERATIONAL", line: "Motor", departmentId: "CLM", ownerId: "funke", li: 5, ii: 3, lr: 3, ir: 3, treatment: "MITIGATE", status: "MITIGATING", trend: "UP", objective: "Cut inflated motor own-damage leakage.", controls: ["CTL-08"] },
  { code: "RSK-021", title: "Health claims adjudication errors", description: "Pre-authorisation and discharge bills are sometimes approved outside the scheme benefit table, especially on weekends.", category: "OPERATIONAL", line: "Health", departmentId: "CLM", ownerId: "funke", li: 4, ii: 3, lr: 3, ir: 2, treatment: "MITIGATE", status: "MITIGATING", trend: "STABLE", objective: "Adjudicate health bills against the benefit table.", controls: ["CTL-09"] },
  { code: "RSK-022", title: "Core policy system outage across lines", description: "Motor, property, marine, health and life policies are administered on one core system. An outage stops new business, endorsements and claims registration together.", category: "OPERATIONAL", line: "Enterprise-wide", departmentId: "IT", ownerId: "ngozi", li: 3, ii: 5, lr: 2, ir: 4, treatment: "MITIGATE", status: "OPEN", trend: "STABLE", objective: "Recover policy administration inside the agreed window.", controls: ["CTL-10", "CTL-12"] },
  { code: "RSK-023", title: "Marine survey delay at discharge", description: "Cargo claims wait on survey reports. Slow surveyors in the port mean files age and customers dispute the delay.", category: "OPERATIONAL", line: "Marine", departmentId: "CLM", ownerId: "funke", li: 3, ii: 3, lr: 3, ir: 2, treatment: "MITIGATE", status: "OPEN", trend: "STABLE", objective: "Survey cargo losses inside the service standard.", controls: ["CTL-19"] },
  { code: "RSK-024", title: "Life benefit payment backlog", description: "Maturity and death benefits on retail life are queuing. Some files have been open beyond the service promise.", category: "OPERATIONAL", line: "Life", departmentId: "CLM", ownerId: "funke", li: 4, ii: 3, lr: 3, ir: 3, treatment: "MITIGATE", status: "MITIGATING", trend: "DOWN", objective: "Clear life benefit files inside the promised days.", controls: ["CTL-18"] },
  { code: "RSK-025", title: "Branch cash on motor receipts", description: "A few branches still take motor premium in cash. Reconciliation to the policy system is manual.", category: "OPERATIONAL", line: "Motor", departmentId: "FIN", ownerId: "ibrahim", li: 3, ii: 3, lr: 2, ir: 2, treatment: "AVOID", status: "MITIGATING", trend: "DOWN", objective: "Retire cash premium collection.", controls: ["CTL-18"] },
  { code: "RSK-026", title: "Late regulatory returns", description: "Quarterly returns have been filed late twice in the year. The returns calendar is held by one person.", category: "COMPLIANCE", line: "Enterprise-wide", departmentId: "CMP", ownerId: "chioma", li: 4, ii: 3, lr: 3, ir: 3, treatment: "MITIGATE", status: "MITIGATING", trend: "UP", objective: "File every NAICOM return on the due date.", controls: ["CTL-14"], escalation: "ESCALATED", escalationNote: "Compliance will table a deputy filer and a 10-day internal deadline." },
  { code: "RSK-027", title: "ORSA not yet owned by the board", description: "The ORSA narrative is drafted in risk, but the board has not minuted ownership of the assessment or the action plan.", category: "COMPLIANCE", line: "Enterprise-wide", departmentId: "RSK", ownerId: "efe", li: 3, ii: 4, lr: 3, ir: 3, treatment: "MITIGATE", status: "OPEN", trend: "STABLE", objective: "Have the board own this year's ORSA.", controls: ["CTL-14"] },
  { code: "RSK-028", title: "AML gaps on single-premium life", description: "Large single-premium life proposals are not always screened before the policy is issued. Source-of-funds notes are thin.", category: "COMPLIANCE", line: "Life", departmentId: "CMP", ownerId: "chioma", li: 3, ii: 4, lr: 2, ir: 3, treatment: "MITIGATE", status: "MITIGATING", trend: "DOWN", objective: "Screen single-premium life before issue.", controls: ["CTL-15"] },
  { code: "RSK-029", title: "Health rider sold before product filing", description: "A dental rider on a corporate health plan was offered to one client before the product file was submitted.", category: "COMPLIANCE", line: "Health", departmentId: "CMP", ownerId: "chioma", li: 2, ii: 4, lr: 2, ir: 2, treatment: "AVOID", status: "MITIGATING", trend: "DOWN", objective: "No product goes to market before approval.", controls: ["CTL-20"] },
  { code: "RSK-030", title: "Related-party transactions", description: "A director's family business places commercial property through an in-house broker. Disclosure in the pack is incomplete.", category: "COMPLIANCE", line: "Property", departmentId: "CMP", ownerId: "chioma", li: 2, ii: 3, lr: 2, ir: 2, treatment: "MITIGATE", status: "OPEN", trend: "STABLE", objective: "Disclose and clear related-party placements.", controls: ["CTL-15"] },
  { code: "RSK-031", title: "Ransomware on the core policy and claims system", description: "A ransomware event would encrypt policy, claims and health-authorisation data for every line at once. Offline backups are tested only in part.", category: "CYBER", line: "Enterprise-wide", departmentId: "IT", ownerId: "ngozi", li: 4, ii: 5, lr: 4, ir: 4, treatment: "MITIGATE", status: "MITIGATING", trend: "UP", emerging: true, objective: "Be able to restore core policy and claims data.", controls: ["CTL-11", "CTL-12", "CTL-10"], escalation: "ESCALATED", escalationNote: "Risk Committee asked for a full restore test before the next quarter." },
  { code: "RSK-032", title: "Health and life data taken out of the company", description: "Health diagnoses and life medical evidence are accessible to more staff than the job requires. A leak would hit customers directly.", category: "CYBER", line: "Health", departmentId: "IT", ownerId: "ngozi", li: 3, ii: 5, lr: 3, ir: 3, treatment: "MITIGATE", status: "OPEN", trend: "STABLE", objective: "Limit health and life data to staff who need it.", controls: ["CTL-11", "CTL-17"] },
  { code: "RSK-033", title: "Privileged access left open", description: "Administrator accounts on the policy system and the finance ledger are shared and not reviewed every quarter.", category: "CYBER", line: "Enterprise-wide", departmentId: "IT", ownerId: "ngozi", li: 4, ii: 3, lr: 3, ir: 3, treatment: "MITIGATE", status: "MITIGATING", trend: "STABLE", objective: "Review privileged access every quarter.", controls: ["CTL-11"] },
  { code: "RSK-034", title: "Agency portal misconfiguration", description: "The motor agency portal caches quotation data longer than the retention rule. A test found another agent's schedule visible after logout.", category: "CYBER", line: "Motor", departmentId: "IT", ownerId: "ngozi", li: 3, ii: 3, lr: 2, ir: 3, treatment: "MITIGATE", status: "MITIGATING", trend: "DOWN", objective: "Close the agency-portal data leak.", controls: ["CTL-10", "CTL-17"] },
  { code: "RSK-035", title: "Phishing of finance approvers", description: "Payment approvers in treasury have clicked simulated phishing mail. A real message could move investment or claims money.", category: "CYBER", line: "Investments", departmentId: "IT", ownerId: "ngozi", li: 4, ii: 4, lr: 3, ir: 3, treatment: "MITIGATE", status: "OPEN", trend: "UP", objective: "Stop payment fraud by phishing.", controls: ["CTL-11", "CTL-18"] },
  { code: "RSK-036", title: "Health TPA cannot pay hospitals", description: "The health third-party administrator has missed hospital settlement cycles. Hospitals have started to turn Harbourline members away.", category: "THIRD_PARTY", line: "Health", departmentId: "HLT", ownerId: "amina", li: 4, ii: 4, lr: 4, ir: 3, treatment: "MITIGATE", status: "MITIGATING", trend: "UP", objective: "Keep hospital access open for health members.", controls: ["CTL-16", "CTL-09"], escalation: "ESCALATED", escalationNote: "Management is dual-running a second administrator on two schemes." },
  { code: "RSK-037", title: "Property loss-adjuster capacity in flood season", description: "When rain floods several cities at once, the adjuster panel cannot attend property claims inside the service standard.", category: "THIRD_PARTY", line: "Property", departmentId: "CLM", ownerId: "funke", li: 3, ii: 3, lr: 3, ir: 2, treatment: "MITIGATE", status: "OPEN", trend: "STABLE", objective: "Have enough adjusters for a flood week.", controls: ["CTL-16"] },
  { code: "RSK-038", title: "Core system vendor lock-in", description: "The policy-admin vendor is the only party that can ship a change. Exit would take longer than the business can pause motor and life new business.", category: "THIRD_PARTY", line: "Enterprise-wide", departmentId: "IT", ownerId: "ngozi", li: 3, ii: 4, lr: 3, ir: 3, treatment: "ACCEPT", status: "OPEN", trend: "STABLE", objective: "Know what leaving the core vendor would take.", controls: ["CTL-16", "CTL-10"] },
  { code: "RSK-039", title: "Bancassurance conduct on life", description: "Bank staff have described a retail life savings plan as a deposit. Call recordings show the cooling-off right was not said.", category: "THIRD_PARTY", line: "Life", departmentId: "DST", ownerId: "kemi", li: 3, ii: 4, lr: 2, ir: 3, treatment: "MITIGATE", status: "MITIGATING", trend: "DOWN", objective: "Sell life in the bank as insurance, not as a deposit.", controls: ["CTL-16", "CTL-20"] },
  { code: "RSK-040", title: "Marine surveyor panel quality", description: "Two cargo surveyors on the panel produce reports the claims team cannot rely on. Recovery and declinature decisions stall.", category: "THIRD_PARTY", line: "Marine", departmentId: "MEN", ownerId: "yetunde", li: 3, ii: 3, lr: 2, ir: 2, treatment: "MITIGATE", status: "OPEN", trend: "STABLE", objective: "Use surveyors whose reports will stand up.", controls: ["CTL-19", "CTL-16"] },
  { code: "RSK-041", title: "A motor claims dispute going public", description: "A delayed motor total-loss settlement was filmed at a branch. Similar delays would travel quickly if they repeat.", category: "REPUTATIONAL", line: "Motor", departmentId: "CLM", ownerId: "funke", li: 3, ii: 3, lr: 2, ir: 3, treatment: "MITIGATE", status: "MITIGATING", trend: "STABLE", objective: "Settle straightforward motor total losses inside the promise.", controls: ["CTL-08"] },
  { code: "RSK-042", title: "Delayed retiree annuity payments", description: "A batch of retiree annuities missed a payment date because the bank file was rejected. Retirees called the branch and a journalist.", category: "REPUTATIONAL", line: "Life", departmentId: "LIF", ownerId: "chinedu", li: 3, ii: 4, lr: 3, ir: 4, treatment: "MITIGATE", status: "MITIGATING", trend: "UP", objective: "Pay retiree annuities on the due date.", controls: ["CTL-07", "CTL-18"] },
  { code: "RSK-043", title: "Health pre-authorisation complaints", description: "Members complain that emergency admissions wait on a pre-authorisation code. The complaint log is rising on two hospital groups.", category: "REPUTATIONAL", line: "Health", departmentId: "HLT", ownerId: "amina", li: 4, ii: 3, lr: 3, ir: 2, treatment: "MITIGATE", status: "OPEN", trend: "UP", objective: "Authorise genuine emergencies without a wait.", controls: ["CTL-09"] },
  { code: "RSK-044", title: "Loose ESG wording on a property product", description: "A commercial property brochure calls a standard fire policy a green cover. The wording is not in the approved product file.", category: "REPUTATIONAL", line: "Property", departmentId: "UW", ownerId: "tunde", li: 2, ii: 3, lr: 2, ir: 2, treatment: "AVOID", status: "MITIGATING", trend: "DOWN", objective: "Only use product wording that has been approved.", controls: ["CTL-20"] },
  { code: "RSK-045", title: "Head-office flood", description: "The Victoria Island office holds underwriting, claims and finance. A flood of the ground floor would stop motor and property new business on that site.", category: "BCP", line: "Enterprise-wide", departmentId: "RSK", ownerId: "efe", li: 2, ii: 5, lr: 2, ir: 3, treatment: "MITIGATE", status: "OPEN", trend: "STABLE", objective: "Move critical work if the head office is closed.", controls: ["CTL-13"] },
  { code: "RSK-046", title: "Single data centre for every line", description: "Policy, claims, health authorisation and life payments depend on one data centre. There is no live second site.", category: "BCP", line: "Enterprise-wide", departmentId: "IT", ownerId: "ngozi", li: 3, ii: 5, lr: 3, ir: 4, treatment: "MITIGATE", status: "MITIGATING", trend: "STABLE", objective: "Keep a second place from which the lines can run.", controls: ["CTL-12", "CTL-13"] },
  { code: "RSK-047", title: "Claims staff absence in a disease wave", description: "Motor, health and life claims sit with a small set of assessors. A wave of absence would stop settlement across those lines.", category: "BCP", line: "Enterprise-wide", departmentId: "HC", ownerId: "halima", li: 3, ii: 4, lr: 2, ir: 3, treatment: "MITIGATE", status: "OPEN", trend: "STABLE", objective: "Keep claims moving if a team is absent.", controls: ["CTL-13"] },
  { code: "RSK-048", title: "Contact-centre power and telecom failure", description: "The contact centre handles motor FNOL, health authorisation and life queries. A power or link failure silences all three.", category: "BCP", line: "Enterprise-wide", departmentId: "IT", ownerId: "ngozi", li: 3, ii: 3, lr: 2, ir: 3, treatment: "MITIGATE", status: "OPEN", trend: "DOWN", objective: "Answer customers when the contact centre is dark.", controls: ["CTL-13", "CTL-12"] },
];

export const controls = [
  { id: "CTL-01", name: "Underwriting authority matrix", description: "Line authorities for motor, property, marine, energy, health, life and aviation, with referral above the line.", type: "PREVENTIVE", frequency: "Continuous", effectiveness: "PARTIALLY_EFFECTIVE", ownerId: "tunde" },
  { id: "CTL-02", name: "Peer review of large risks", description: "Property, energy, marine and aviation risks above a threshold are reviewed by a second underwriter before inception.", type: "PREVENTIVE", frequency: "Each large risk", effectiveness: "EFFECTIVE", ownerId: "yetunde" },
  { id: "CTL-03", name: "Treaty and facultative programme", description: "Surplus, quota share and facultative placement rules by class, including a rule that energy does not incept before sign-down.", type: "PREVENTIVE", frequency: "Annual, and at each placement", effectiveness: "PARTIALLY_EFFECTIVE", ownerId: "efe" },
  { id: "CTL-04", name: "Broker and scheme credit limits", description: "Premium credit limits and cancellation rules for motor brokers and corporate health schemes.", type: "PREVENTIVE", frequency: "Monthly", effectiveness: "PARTIALLY_EFFECTIVE", ownerId: "ibrahim" },
  { id: "CTL-05", name: "Counterparty credit review", description: "Due diligence and limits for banks, bond issuers and reinsurers.", type: "DETECTIVE", frequency: "Quarterly", effectiveness: "EFFECTIVE", ownerId: "ibrahim" },
  { id: "CTL-06", name: "Investment policy limits", description: "Board limits for equities, bank placements, property and currency, with a breach log.", type: "PREVENTIVE", frequency: "Monthly", effectiveness: "EFFECTIVE", ownerId: "ibrahim" },
  { id: "CTL-07", name: "Life asset-liability review", description: "Quarterly review of annuity and group-life reserves against matching assets.", type: "DETECTIVE", frequency: "Quarterly", effectiveness: "PARTIALLY_EFFECTIVE", ownerId: "chinedu" },
  { id: "CTL-08", name: "Motor claims fraud rules", description: "Workshop panel, photo evidence and investigator rotation for motor own-damage.", type: "DETECTIVE", frequency: "Each claim", effectiveness: "PARTIALLY_EFFECTIVE", ownerId: "funke" },
  { id: "CTL-09", name: "Health adjudication checklist", description: "Benefit-table check for pre-authorisation and discharge bills, including weekend cover.", type: "PREVENTIVE", frequency: "Each bill", effectiveness: "PARTIALLY_EFFECTIVE", ownerId: "amina" },
  { id: "CTL-10", name: "Change control on the policy system", description: "No production change to the core system without a tested release note.", type: "PREVENTIVE", frequency: "Each change", effectiveness: "EFFECTIVE", ownerId: "ngozi" },
  { id: "CTL-11", name: "Privileged access review", description: "Named administrator accounts on policy, claims, health and finance systems, reviewed quarterly.", type: "DETECTIVE", frequency: "Quarterly", effectiveness: "INEFFECTIVE", ownerId: "ngozi" },
  { id: "CTL-12", name: "Backup and restore test", description: "Backup of policy, claims and health data, with a restore test to a clean environment.", type: "CORRECTIVE", frequency: "Quarterly", effectiveness: "PARTIALLY_EFFECTIVE", ownerId: "ngozi" },
  { id: "CTL-13", name: "Business continuity exercise", description: "Annual exercise covering head office, data centre and contact centre, across motor, health and life service.", type: "CORRECTIVE", frequency: "Annual", effectiveness: "PARTIALLY_EFFECTIVE", ownerId: "efe" },
  { id: "CTL-14", name: "Regulatory returns calendar", description: "Named owner and deputy for each NAICOM return, with an internal deadline ahead of the statutory date.", type: "PREVENTIVE", frequency: "Each return", effectiveness: "PARTIALLY_EFFECTIVE", ownerId: "chioma" },
  { id: "CTL-15", name: "Customer due diligence", description: "Sanctions and source-of-funds screening before large life and property policies are issued.", type: "PREVENTIVE", frequency: "Each in-scope policy", effectiveness: "PARTIALLY_EFFECTIVE", ownerId: "chioma" },
  { id: "CTL-16", name: "Third-party due diligence", description: "Assessment and contract review for TPAs, adjusters, surveyors, banks and the core vendor.", type: "PREVENTIVE", frequency: "At appointment and annually", effectiveness: "PARTIALLY_EFFECTIVE", ownerId: "efe" },
  { id: "CTL-17", name: "Data protection impact assessment", description: "Assessment before a new system or product handles health, life or motor customer data.", type: "PREVENTIVE", frequency: "Each in-scope change", effectiveness: "INEFFECTIVE", ownerId: "chioma" },
  { id: "CTL-18", name: "Segregation of duties in finance", description: "Separate preparation and approval of claim payments, investments and premium reconciliations.", type: "PREVENTIVE", frequency: "Continuous", effectiveness: "EFFECTIVE", ownerId: "ibrahim" },
  { id: "CTL-19", name: "Marine surveyor panel review", description: "Annual review of cargo surveyors against report quality and turnaround.", type: "DETECTIVE", frequency: "Annual", effectiveness: "NOT_TESTED", ownerId: "yetunde" },
  { id: "CTL-20", name: "Product approval before launch", description: "No brochure or bank script goes out until compliance and the product committee have approved the file.", type: "PREVENTIVE", frequency: "Each product", effectiveness: "PARTIALLY_EFFECTIVE", ownerId: "chioma" },
];

export const kris = [
  { id: "KRI-01", name: "Motor loss ratio", description: "Year-to-date motor comprehensive loss ratio.", unit: "%", direction: "LOWER_IS_BETTER", green: 65, amber: 75, value: 81, frequency: "Monthly", category: "UNDERWRITING", riskCode: "RSK-001", ownerId: "tunde" },
  { id: "KRI-02", name: "Motor premium unpaid over 90 days", description: "Broker premium outstanding more than 90 days.", unit: "₦ million", direction: "LOWER_IS_BETTER", green: 150, amber: 250, value: 340, frequency: "Monthly", category: "CREDIT_INVESTMENT", riskCode: "RSK-010", ownerId: "ibrahim" },
  { id: "KRI-03", name: "Energy risks incepted before facultative sign-down", description: "Count of energy risks on cover with facultative still open.", unit: "count", direction: "LOWER_IS_BETTER", green: 0, amber: 0, value: 1, frequency: "Weekly", category: "UNDERWRITING", riskCode: "RSK-004", ownerId: "yetunde" },
  { id: "KRI-04", name: "Corporate health loss ratio", description: "Loss ratio on the ten largest corporate health schemes.", unit: "%", direction: "LOWER_IS_BETTER", green: 75, amber: 85, value: 88, frequency: "Monthly", category: "UNDERWRITING", riskCode: "RSK-005", ownerId: "amina" },
  { id: "KRI-05", name: "Retail life 13-month persistency", description: "Premium still in force 13 months after issue.", unit: "%", direction: "HIGHER_IS_BETTER", green: 80, amber: 70, value: 74, frequency: "Quarterly", category: "UNDERWRITING", riskCode: "RSK-007", ownerId: "chinedu" },
  { id: "KRI-06", name: "Solvency coverage ratio", description: "Available capital over the required solvency margin.", unit: "%", direction: "HIGHER_IS_BETTER", green: 150, amber: 120, value: 164, frequency: "Monthly", category: "MARKET", riskCode: "RSK-016", ownerId: "ibrahim" },
  { id: "KRI-07", name: "Dollar claim reserves unmatched", description: "Energy and marine claim reserves not matched by dollar assets.", unit: "$ million", direction: "LOWER_IS_BETTER", green: 2, amber: 5, value: 8.4, frequency: "Monthly", category: "MARKET", riskCode: "RSK-018", ownerId: "ibrahim" },
  { id: "KRI-08", name: "Claims settled inside service standard", description: "Share of motor, property and life claims settled inside the promised days.", unit: "%", direction: "HIGHER_IS_BETTER", green: 90, amber: 80, value: 76, frequency: "Monthly", category: "OPERATIONAL", riskCode: "RSK-024", ownerId: "funke" },
  { id: "KRI-09", name: "Regulatory returns filed on time", description: "Share of NAICOM returns filed by the statutory date this year.", unit: "%", direction: "HIGHER_IS_BETTER", green: 100, amber: 90, value: 80, frequency: "Quarterly", category: "COMPLIANCE", riskCode: "RSK-026", ownerId: "chioma" },
  { id: "KRI-10", name: "Phishing simulation click rate", description: "Share of finance and treasury staff who clicked the last simulation.", unit: "%", direction: "LOWER_IS_BETTER", green: 3, amber: 8, value: 14, frequency: "Quarterly", category: "CYBER", riskCode: "RSK-035", ownerId: "ngozi" },
  { id: "KRI-11", name: "Critical vulnerabilities older than 30 days", description: "Unresolved critical findings on internet-facing systems.", unit: "count", direction: "LOWER_IS_BETTER", green: 0, amber: 3, value: 6, frequency: "Monthly", category: "CYBER", riskCode: "RSK-031", ownerId: "ngozi" },
  { id: "KRI-12", name: "Health TPA hospital settlement misses", description: "Hospital settlement cycles missed by the health administrator this quarter.", unit: "count", direction: "LOWER_IS_BETTER", green: 0, amber: 1, value: 2, frequency: "Monthly", category: "THIRD_PARTY", riskCode: "RSK-036", ownerId: "amina" },
  { id: "KRI-13", name: "Upheld customer complaints", description: "Complaints upheld as a share of motor, health and life complaints closed.", unit: "%", direction: "LOWER_IS_BETTER", green: 8, amber: 15, value: 11, frequency: "Monthly", category: "REPUTATIONAL", riskCode: "RSK-043", ownerId: "funke" },
  { id: "KRI-14", name: "Last continuity exercise score", description: "Share of critical activities recovered inside the exercise time.", unit: "%", direction: "HIGHER_IS_BETTER", green: 100, amber: 80, value: 60, frequency: "Annual", category: "BCP", riskCode: "RSK-046", ownerId: "efe" },
];

export const policies = [
  { id: "POL-ERM", title: "Enterprise Risk Management Policy", category: "Risk", ownerId: "efe", status: "APPROVED", summary: "How Harbourline identifies, scores, owns and escalates risk across motor, property, marine, energy, health and life.", nextReview: "2027-03-31", lastReview: "2026-03-18" },
  { id: "POL-UW", title: "Underwriting Policy and Procedure Manual", category: "Underwriting", ownerId: "tunde", status: "APPROVED", summary: "Authority, referral and file standards for motor, property, marine, energy, health, life and aviation.", nextReview: "2026-11-30", lastReview: "2025-11-12" },
  { id: "POL-CLM", title: "Claims Management Policy", category: "Claims", ownerId: "funke", status: "APPROVED", summary: "Fair and prompt settlement for motor, property, marine, health and life claims, including large-loss escalation.", nextReview: "2026-12-15", lastReview: "2025-12-02" },
  { id: "POL-REI", title: "Reinsurance Management Policy", category: "Reinsurance", ownerId: "efe", status: "IN_REVIEW", summary: "Treaty, facultative and security rules, including the energy sign-down rule.", nextReview: "2026-10-31", lastReview: "2025-10-20" },
  { id: "POL-SEC", title: "Information Security Policy", category: "Security", ownerId: "ngozi", status: "APPROVED", summary: "Access, malware, backup and incident duties for systems that hold policy and claims data.", nextReview: "2027-01-31", lastReview: "2026-01-20" },
  { id: "POL-DPP", title: "Data Protection and Privacy Policy", category: "Privacy", ownerId: "chioma", status: "APPROVED", summary: "How customer, health and life data is collected, kept and shared.", nextReview: "2027-02-28", lastReview: "2026-02-10" },
  { id: "POL-BCP", title: "Business Continuity Policy", category: "Continuity", ownerId: "efe", status: "APPROVED", summary: "How motor, health and life service continues if the office, data centre or contact centre fails.", nextReview: "2026-09-30", lastReview: "2025-09-15" },
  { id: "POL-COC", title: "Code of Conduct", category: "Conduct", ownerId: "chioma", status: "APPROVED", summary: "The standard of behaviour for staff and the annual declaration that confirms it.", nextReview: "2027-01-15", lastReview: "2026-01-08" },
  { id: "POL-COI", title: "Conflict of Interest Policy", category: "Conduct", ownerId: "chioma", status: "APPROVED", summary: "How staff declare and step away from conflicts, including related-party placements.", nextReview: "2027-01-15", lastReview: "2026-01-08" },
  { id: "POL-GFT", title: "Gifts and Hospitality Policy", category: "Conduct", ownerId: "chioma", status: "APPROVED", summary: "What may be accepted from brokers, hospitals, banks and other parties, and what must be declared.", nextReview: "2027-01-15", lastReview: "2026-01-08" },
  { id: "POL-OUT", title: "Outsourcing and Third-Party Policy", category: "Third party", ownerId: "efe", status: "DRAFT", summary: "Due diligence and contracts for TPAs, surveyors, adjusters and technology vendors.", nextReview: "2026-11-15", lastReview: null },
  { id: "POL-AML", title: "Anti-Money Laundering and CFT Policy", category: "Financial crime", ownerId: "chioma", status: "APPROVED", summary: "Customer due diligence, especially on single-premium life and large property placements.", nextReview: "2026-12-01", lastReview: "2025-12-01" },
  { id: "POL-HLT", title: "Health Scheme Administration Policy", category: "Health", ownerId: "amina", status: "APPROVED", summary: "Scheme setup, pre-authorisation and hospital settlement standards.", nextReview: "2027-04-30", lastReview: "2026-04-02" },
  { id: "POL-LIF", title: "Life Product and Persistency Policy", category: "Life", ownerId: "chinedu", status: "APPROVED", summary: "Product design, bancassurance scripts and persistency management for retail and group life.", nextReview: "2027-05-31", lastReview: "2026-05-06" },
];

export const policyBodies: Record<string, { version: string; status: string; notes: string; content: string; extra?: { version: string; status: string; notes: string; content: string } }> = {
  "POL-ERM": {
    version: "3.0",
    status: "APPROVED",
    notes: "Added category appetite limits and escalation to the Risk Committee.",
    content: "Harbourline keeps one risk register for every line it writes. Each risk has an owner, an inherent score, a residual score and a category appetite limit. A residual score above the limit is flagged and escalated. The Chief Risk Officer reports breaches and material losses to senior management and the Board Risk Committee.",
  },
  "POL-UW": {
    version: "4.1",
    status: "APPROVED",
    notes: "Motor tariff floor and energy sign-down cross-reference added.",
    content: "Underwriters write only inside their line authority. Motor rates follow the current tariff floor. Property, marine and energy accumulations are checked before inception. Health schemes and life products use the approved rate book. A second underwriter reviews risks above the peer-review threshold.",
  },
  "POL-CLM": {
    version: "2.4",
    status: "APPROVED",
    notes: "Large-loss path for energy and marine added.",
    content: "Every notified claim has a file the day it is notified. Motor, property, marine, health and life claims are settled against the contract. Large or unusual claims, including energy and marine dollar claims, involve senior management from the start.",
  },
  "POL-REI": {
    version: "2.0",
    status: "APPROVED",
    notes: "Current approved text.",
    content: "Treaties cover the classes Harbourline is authorised to write. Facultative security is on the approved panel. Energy business does not incept until facultative is signed down.",
    extra: {
      version: "2.1",
      status: "SUBMITTED",
      notes: "Clarifies who may waive the energy sign-down rule. Nobody below the CRO.",
      content: "Draft revision: the energy sign-down rule cannot be waived except by the Chief Risk Officer, and the waiver is reported to the Risk Committee.",
    },
  },
  "POL-SEC": {
    version: "1.3",
    status: "APPROVED",
    notes: "Privileged access review set to quarterly.",
    content: "Access to policy, claims, health and finance systems is named and reviewed. Backups are tested. A security incident is reported inside the company the day it is known.",
  },
  "POL-DPP": {
    version: "1.2",
    status: "APPROVED",
    notes: "Health and life called out as sensitive processing.",
    content: "Customer data is collected for a stated purpose, kept only as long as needed, and protected. Health and life medical data is processed only by staff who need it. A high-risk new use is assessed before it starts. A breach that puts people at risk is notified as the Act requires.",
  },
  "POL-BCP": {
    version: "2.0",
    status: "APPROVED",
    notes: "Contact centre added.",
    content: "If the head office, the data centre or the contact centre fails, motor first notice of loss, health authorisation and life payments move to the documented fallback within the stated hours.",
  },
  "POL-COC": {
    version: "5.0",
    status: "APPROVED",
    notes: "Annual attestation linked to the code, the conflict policy and the gifts policy.",
    content: "Staff act honestly, protect customer data, and do not put personal interests ahead of the company or the policyholder. Each year, staff attest this code and the policies named in the declaration campaign.",
  },
  "POL-COI": {
    version: "2.1",
    status: "APPROVED",
    notes: "Related-party placements included.",
    content: "A staff member who has an interest in a placement, a claim or a supplier declares it and steps out of the decision.",
  },
  "POL-GFT": {
    version: "1.4",
    status: "APPROVED",
    notes: "Hospital and broker hospitality included.",
    content: "Gifts and hospitality from brokers, hospitals, banks, workshops and other parties above the stated value are declared. Cash is never accepted.",
  },
  "POL-OUT": {
    version: "0.9",
    status: "DRAFT",
    notes: "First full draft for the product committee.",
    content: "A third party that handles claims, surveys, hospital bills or systems is assessed before appointment. The contract states service levels, data duties and audit rights.",
  },
  "POL-AML": {
    version: "3.0",
    status: "APPROVED",
    notes: "Single-premium life threshold restated.",
    content: "Customers are identified before a policy is issued. Large single-premium life and large property placements need a source-of-funds note and a sanctions check.",
  },
  "POL-HLT": {
    version: "1.1",
    status: "APPROVED",
    notes: "Weekend authorisation rota added.",
    content: "Corporate health schemes are administered against the benefit table. Emergencies are not delayed for a code. The administrator settles hospitals on the agreed cycle.",
  },
  "POL-LIF": {
    version: "1.0",
    status: "APPROVED",
    notes: "First issue.",
    content: "Life products are filed before they are sold. Bancassurance scripts describe the product as insurance. Persistency is reviewed each quarter.",
  },
};

export const findings = [
  { id: "FND-01", title: "Privileged access reviews missed for two quarters", description: "Internal audit found no completed review of administrator accounts on the policy system or the ledger.", source: "INTERNAL_AUDIT", severity: "HIGH", status: "OPEN", riskCode: "RSK-033", requirementCode: "A.8.2", ownerId: "ngozi" },
  { id: "FND-02", title: "Inactive motor claim files", description: "A sample of motor files had no activity for more than 60 days and no diary note.", source: "INTERNAL_AUDIT", severity: "MEDIUM", status: "IN_REMEDIATION", riskCode: "RSK-020", ownerId: "funke" },
  { id: "FND-03", title: "No impact assessment for the agency portal", description: "The motor agency portal went live without a data protection impact assessment.", source: "CONTROL_TEST", severity: "HIGH", status: "OPEN", riskCode: "RSK-034", requirementCode: "s.28", ownerId: "chioma" },
  { id: "FND-04", title: "Investment limit exception not minuted", description: "External audit found a bank placement above the single-name guide with no committee minute.", source: "EXTERNAL_AUDIT", severity: "MEDIUM", status: "IN_REMEDIATION", riskCode: "RSK-013", ownerId: "ibrahim" },
  { id: "FND-05", title: "ORSA action plan has no board owner", description: "The draft ORSA lists actions, but the board pack does not show who owns them.", source: "REGULATOR", severity: "HIGH", status: "OPEN", riskCode: "RSK-027", requirementCode: "6.4.3", ownerId: "efe" },
  { id: "FND-06", title: "Gift register gaps in distribution", description: "Bank hospitality for the life campaign was not on the register for two relationship managers.", source: "INTERNAL_AUDIT", severity: "LOW", status: "OPEN", riskCode: "RSK-039", ownerId: "kemi" },
];

export const actions = [
  { id: "ACT-01", title: "Finish facultative on the open energy package", description: "Place or cancel the uncovered share before month end.", sourceType: "RISK", riskCode: "RSK-004", ownerId: "yetunde", due: "2026-10-20", status: "IN_PROGRESS", priority: "HIGH" },
  { id: "ACT-02", title: "Cancel or collect aged motor broker premium", description: "Issue cancellation notices where premium is unpaid past 90 days.", sourceType: "RISK", riskCode: "RSK-010", ownerId: "ibrahim", due: "2026-09-30", status: "IN_PROGRESS", priority: "HIGH" },
  { id: "ACT-03", title: "Run a full restore of the policy system", description: "Restore policy and claims data to a clean environment and time the result.", sourceType: "RISK", riskCode: "RSK-031", ownerId: "ngozi", due: "2026-11-15", status: "OPEN", priority: "HIGH" },
  { id: "ACT-04", title: "Name a deputy for NAICOM returns", description: "Put a second filer on the returns calendar and set the internal deadline.", sourceType: "COMPLIANCE_GAP", riskCode: "RSK-026", requirementCode: "6.4.4", ownerId: "chioma", due: "2026-10-05", status: "OPEN", priority: "HIGH" },
  { id: "ACT-05", title: "Take ORSA ownership to the board", description: "Table the ORSA and its action owners at the next Risk Committee.", sourceType: "FINDING", findingId: "FND-05", riskCode: "RSK-027", requirementCode: "6.4.3", ownerId: "efe", due: "2026-11-28", status: "OPEN", priority: "HIGH" },
  { id: "ACT-06", title: "Complete the agency-portal impact assessment", description: "Assess the motor agency portal and close the logout cache issue.", sourceType: "FINDING", findingId: "FND-03", riskCode: "RSK-034", requirementCode: "s.28", ownerId: "ngozi", due: "2026-09-20", status: "IN_PROGRESS", priority: "HIGH" },
  { id: "ACT-07", title: "Remove shared administrator accounts", description: "Replace shared admin IDs and file the missing quarterly access review.", sourceType: "FINDING", findingId: "FND-01", riskCode: "RSK-033", ownerId: "ngozi", due: "2026-10-31", status: "OPEN", priority: "HIGH" },
  { id: "ACT-08", title: "Dual-run a second health administrator", description: "Move two schemes to a backup TPA while hospital settlements are repaired.", sourceType: "RISK", riskCode: "RSK-036", ownerId: "amina", due: "2026-11-10", status: "IN_PROGRESS", priority: "HIGH" },
  { id: "ACT-09", title: "Clear the life benefit backlog", description: "Close retail life maturity files older than the service standard.", sourceType: "RISK", riskCode: "RSK-024", ownerId: "funke", due: "2026-10-18", status: "IN_PROGRESS", priority: "MEDIUM" },
  { id: "ACT-10", title: "Pay the missed retiree annuity batch", description: "Reissue the rejected bank file and confirm retirees were paid.", sourceType: "RISK", riskCode: "RSK-042", ownerId: "chinedu", due: "2026-09-12", status: "COMPLETED", priority: "HIGH", completed: "2026-09-18" },
  { id: "ACT-11", title: "Rewrite the bancassurance life script", description: "Remove deposit language and include the cooling-off right.", sourceType: "RISK", riskCode: "RSK-039", ownerId: "kemi", due: "2026-11-05", status: "OPEN", priority: "MEDIUM" },
  { id: "ACT-12", title: "Diary the inactive motor files", description: "Review motor files with no activity and close or move them.", sourceType: "FINDING", findingId: "FND-02", riskCode: "RSK-020", ownerId: "funke", due: "2026-10-25", status: "OPEN", priority: "MEDIUM" },
  { id: "ACT-13", title: "Minute the bank placement exception", description: "Take the single-name breach to the investment committee and record the decision.", sourceType: "FINDING", findingId: "FND-04", riskCode: "RSK-013", ownerId: "ibrahim", due: "2026-08-28", status: "IN_PROGRESS", priority: "MEDIUM" },
  { id: "ACT-14", title: "Build a dollar asset ladder for energy claims", description: "Propose dollar assets or cover for unmatched energy and marine claim reserves.", sourceType: "RISK", riskCode: "RSK-018", ownerId: "ibrahim", due: "2026-12-01", status: "OPEN", priority: "HIGH" },
  { id: "ACT-15", title: "Screen the open single-premium life cases", description: "Complete source-of-funds notes on policies issued without them.", sourceType: "COMPLIANCE_GAP", riskCode: "RSK-028", ownerId: "chioma", due: "2026-10-22", status: "OPEN", priority: "MEDIUM" },
  { id: "ACT-16", title: "Schedule the second-site design workshop", description: "Agree what a second site must run for motor, health and life.", sourceType: "RISK", riskCode: "RSK-046", ownerId: "ngozi", due: "2026-11-30", status: "OPEN", priority: "MEDIUM" },
  { id: "ACT-17", title: "Withdraw the green property brochure", description: "Pull the unapproved ESG wording from the broker pack.", sourceType: "RISK", riskCode: "RSK-044", ownerId: "tunde", due: "2026-09-05", status: "COMPLETED", priority: "LOW", completed: "2026-09-08" },
  { id: "ACT-18", title: "File the gift-register catch-up", description: "Distribution managers record the missing bank hospitality.", sourceType: "FINDING", findingId: "FND-06", riskCode: "RSK-039", ownerId: "kemi", due: "2026-10-08", status: "OPEN", priority: "LOW" },
];

export const objectives = [
  { id: "OBJ-01", title: "Motor rate adequacy", description: "Lift the motor comprehensive loss ratio back towards the plan without emptying the broker panel.", ownerId: "tunde", departmentId: "UW", period: "FY2026", weight: 25, status: "AT_RISK", riskCode: "RSK-001", kpis: [
    { id: "KPI-01", name: "Motor loss ratio", unit: "%", direction: "LOWER_IS_BETTER", target: 68, weight: 70, scores: [{ period: "2026-Q1", actual: 74, notes: "Spare-part inflation still in the quarter." }, { period: "2026-Q2", actual: 79, notes: "Lagos corridor worsened." }] },
    { id: "KPI-02", name: "Risks inside motor appetite", unit: "%", direction: "HIGHER_IS_BETTER", target: 100, weight: 30, scores: [{ period: "2026-Q2", actual: 80, notes: "Premium debt sits outside credit appetite." }] },
  ] },
  { id: "OBJ-02", title: "Close priority NAICOM gaps", description: "Move the ORSA and the returns calendar from partial to a board-owned routine.", ownerId: "efe", departmentId: "RSK", period: "FY2026", weight: 20, status: "AT_RISK", requirementCode: "6.4.3", riskCode: "RSK-027", kpis: [
    { id: "KPI-03", name: "NAICOM elements assessed compliant or partial", unit: "%", direction: "HIGHER_IS_BETTER", target: 90, weight: 100, scores: [{ period: "2026-Q2", actual: 78, notes: "ORSA submission and the declaration remain open." }] },
  ] },
  { id: "OBJ-03", title: "Claims service across lines", description: "Settle motor, property and life claims inside the published standard.", ownerId: "funke", departmentId: "CLM", period: "FY2026", weight: 20, status: "AT_RISK", riskCode: "RSK-024", kpis: [
    { id: "KPI-04", name: "Claims inside service standard", unit: "%", direction: "HIGHER_IS_BETTER", target: 90, weight: 100, scores: [{ period: "2026-Q1", actual: 82, notes: "Life maturities dragged the result." }, { period: "2026-Q2", actual: 76, notes: "Motor fraud referrals added handling time." }] },
  ] },
  { id: "OBJ-04", title: "Cyber restore capability", description: "Prove that policy and claims data can be restored, and close the privileged-access finding.", ownerId: "ngozi", departmentId: "IT", period: "FY2026", weight: 15, status: "AT_RISK", riskCode: "RSK-031", requirementCode: "A.8.13", kpis: [
    { id: "KPI-05", name: "Restore test completed", unit: "%", direction: "HIGHER_IS_BETTER", target: 100, weight: 60, scores: [{ period: "2026-Q2", actual: 40, notes: "Partial file restore only." }] },
    { id: "KPI-06", name: "Privileged accounts reviewed", unit: "%", direction: "HIGHER_IS_BETTER", target: 100, weight: 40, scores: [{ period: "2026-Q2", actual: 0, notes: "Two quarters missed." }] },
  ] },
  { id: "OBJ-05", title: "Conduct declarations completed", description: "Every in-scope colleague files the annual code, conflicts and gifts, with the linked policy attestations.", ownerId: "chioma", departmentId: "CMP", period: "FY2026", weight: 10, status: "ON_TRACK", kpis: [
    { id: "KPI-07", name: "Code of conduct approved", unit: "%", direction: "HIGHER_IS_BETTER", target: 100, weight: 100, scores: [{ period: "2026-Q3", actual: 71, notes: "Measured before the October deadline." }] },
  ] },
  { id: "OBJ-06", title: "Health member access", description: "Keep hospitals accepting Harbourline members while the administrator is repaired.", ownerId: "amina", departmentId: "HLT", period: "FY2026", weight: 10, status: "AT_RISK", riskCode: "RSK-036", kpis: [
    { id: "KPI-08", name: "Hospital settlement cycles met", unit: "%", direction: "HIGHER_IS_BETTER", target: 100, weight: 100, scores: [{ period: "2026-Q2", actual: 70, notes: "Two cycles missed." }] },
  ] },
];

export const appraisals = [
  { id: "APR-01", userId: "tunde", reviewerId: "efe", period: "2026-H1", overallScore: 74, rating: "MEETS", status: "COMPLETED", narrative: "Tunde kept the property peer review running and pulled the unapproved brochure. Motor rate adequacy is still behind the plan.", riskNote: "Owns RSK-001. The motor loss-ratio KPI is outside target, and the risk remains on the underwriting watchlist." },
  { id: "APR-02", userId: "funke", reviewerId: "efe", period: "2026-H1", overallScore: 68, rating: "PARTIAL", status: "COMPLETED", narrative: "Claims files are better diary-managed than last year, but the service standard slipped in the second quarter.", riskNote: "Linked to RSK-020 and RSK-024. Fraud rules are only partly effective, and the life benefit backlog is still open." },
];

/** Staff who have finished the annual code, including its policy attestations. */
export const codeCompleteUserIds = ["ada", "efe", "chioma", "ireti", "ibrahim", "ngozi", "segun", "halima", "amina", "yetunde"];
/** Submitted, waiting for compliance. */
export const codeSubmittedUserIds = ["kemi"];
/** Still to file: tunde, funke, chinedu. */

export const coiApproved = ["ada", "efe", "chioma", "ireti", "ibrahim", "ngozi", "segun", "halima", "amina", "yetunde", "kemi"];
export const coiSubmitted = ["funke"];
/** Draft or missing: tunde, chinedu — tunde has a draft. */

export const giftsApproved = ["ada", "efe", "chioma", "ireti", "ibrahim", "ngozi", "segun", "halima", "chinedu", "yetunde", "kemi"];
export const giftsReturned = ["funke"];
