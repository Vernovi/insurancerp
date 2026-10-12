import type { FrameworkElement } from "./naicom";

export const NDPA_SOURCE_URL = "https://ndpc.gov.ng/";

export const NDPA_WORK = "Nigeria Data Protection Act, 2023.";

export function ndpaCitation(section: string): string {
  return `${NDPA_WORK} Section ${section}. ${NDPA_SOURCE_URL}`;
}

/** Operative duties quoted from the Act. Wording follows the published sections; surrounding commentary is not added. */
export const ndpaRequirements: FrameworkElement[] = [
  {
    code: "s.24",
    title: "Principles of personal data processing",
    text: "A data controller or data processor shall ensure that personal data is — (a) processed in a fair, lawful and transparent manner; (b) collected for specified, explicit, and legitimate purposes, and not to be further processed in a way incompatible with these purposes; (c) adequate, relevant, and limited to the minimum necessary for the purposes for which the personal data was collected or further processed; (d) retained for not longer than is necessary to achieve the lawful bases for which the personal data was collected or further processed; (e) accurate, complete, not misleading, and, where necessary, kept up to date having regard to the purposes for which the personal data is collected or is further processed; and (f) processed in a manner that ensures appropriate security of personal data, including protection against unauthorised or unlawful processing, access, loss, destruction, damage, or any form of data breach.",
    policies: ["POL-DPP"],
    controls: ["CTL-17"],
  },
  {
    code: "s.25",
    title: "Lawful basis of processing",
    text: "Data processing shall be lawful where — (a) the data subject has given and not withdrawn consent for the specific purpose or purposes for which personal data is to be processed; or (b) the processing is necessary (i) for the performance of a contract to which the data subject is a party or to take steps at the request of the data subject prior to entering into a contract, (ii) for compliance with a legal obligation to which the data controller or data processor is subject, (iii) to protect the vital interest of the data subject or another person, (iv) for the performance of a task carried out in the public interest or in the exercise of official authority vested in the data controller or data processor, or (v) for the purposes of the legitimate interests pursued by the data controller or data processor, or by a third party to whom the data is disclosed.",
    policies: ["POL-DPP"],
  },
  {
    code: "s.26",
    title: "Consent",
    text: "A data controller shall bear the burden of proof for establishing a data subject's consent. Silence or inactivity of the data subject shall not constitute consent. Where processing is based on consent, the data subject shall be informed of the right to withdraw consent prior to giving it. A request for consent shall be in clear, simple language and an accessible format, and shall be in the affirmative.",
    policies: ["POL-DPP", "POL-HLT"],
  },
  {
    code: "s.27",
    title: "Information to the data subject",
    text: "Before a data controller collects personal data directly from a data subject, the data controller shall inform the data subject of the identity and contact of the controller, the specific lawful basis and purposes of processing, the recipients or categories of recipients, the existence of the data subject's rights, the retention period, the right to lodge a complaint with the Commission, and the existence of automated decision-making, including profiling.",
    policies: ["POL-DPP"],
  },
  {
    code: "s.28",
    title: "Data privacy impact assessment",
    text: "Where the processing of personal data may likely result in high risk to the rights and freedoms of a data subject by virtue of its nature, scope, context, and purposes, a data controller shall, prior to the processing, carry out a data privacy impact assessment. The controller shall consult the Commission prior to the processing if the assessment indicates that the processing would result in a high risk to the rights and freedoms of a data subject.",
    policies: ["POL-DPP"],
    controls: ["CTL-17"],
  },
  {
    code: "s.29",
    title: "Data processor obligations",
    text: "Where a data controller engages a data processor, it shall ensure that the processor complies with the principles and obligations of the Act, assists with data-subject rights, implements appropriate security measures, and provides information needed to demonstrate compliance. The measures include a written agreement between the data controller and the data processor.",
    policies: ["POL-DPP", "POL-OUT"],
    controls: ["CTL-16"],
  },
  {
    code: "s.32",
    title: "Data protection officer",
    text: "A data controller of major importance shall designate a data protection officer with expert knowledge of data protection law and practices. The data protection officer shall advise the controller and its employees, monitor compliance with the Act and the controller's policies, and act as the contact point for the Commission.",
    policies: ["POL-DPP"],
  },
  {
    code: "s.34",
    title: "Rights of a data subject",
    text: "A data subject has the right to obtain from a data controller, without constraint or unreasonable delay, confirmation of whether personal data relating to the data subject is being processed and, where that is the case, the purposes, categories, recipients, retention, and the existence of rights to rectification, erasure, restriction and objection; a copy of the personal data; correction or deletion of inaccurate data; erasure; and restriction of processing in the circumstances set out in the Act.",
    policies: ["POL-DPP"],
  },
  {
    code: "s.39",
    title: "Security, integrity and confidentiality",
    text: "A data controller and data processor shall implement appropriate technical and organisational measures to ensure the security, integrity and confidentiality of personal data in its possession or under its control, including protections against accidental or unlawful destruction, loss, misuse, alteration, unauthorised disclosure, or access, taking into account the amount and sensitivity of the personal data, the nature and likelihood of harm, the extent of processing, the retention period, and the availability and cost of measures.",
    policies: ["POL-SEC", "POL-DPP"],
    controls: ["CTL-11", "CTL-12"],
  },
  {
    code: "s.40",
    title: "Personal data breaches",
    text: "A data controller shall, within 72 hours of becoming aware of a breach which is likely to result in a risk to the rights and freedoms of individuals, notify the Commission of the breach and, where feasible, describe the nature of the personal data breach including the categories and approximate numbers of data subjects and personal data records concerned. Where a breach is likely to result in a high risk to the rights and freedoms of a data subject, the controller shall communicate the breach to the data subject in plain and clear language. Controllers and processors shall keep a record of all personal data breaches.",
    policies: ["POL-SEC", "POL-DPP"],
    controls: ["CTL-11"],
  },
  {
    code: "s.41",
    title: "Cross-border transfers",
    text: "A data controller or data processor shall not transfer or permit personal data to be transferred from Nigeria to another country unless the recipient is subject to a law, binding corporate rules, contractual clauses, code of conduct, or certification mechanism that affords an adequate level of protection, or one of the conditions in section 43 of the Act applies. The basis of the transfer and the adequacy of protection shall be recorded.",
    policies: ["POL-DPP", "POL-OUT"],
  },
  {
    code: "s.44",
    title: "Registration of controllers and processors of major importance",
    text: "Data controllers and data processors of major importance shall register with the Commission within six months after the commencement of the Act or on becoming a data controller or data processor of major importance. Registration is made by notifying the Commission of the matters listed in section 44(2), including the name and address of the controller and of its data protection officer, a description of the personal data and data subjects, the purposes of processing, and the countries to which personal data is intended to be transferred.",
    policies: ["POL-DPP"],
  },
];

export const ISO31000_SOURCE = "ISO 31000:2018 Risk management — Guidelines. Titles only; the standard text is not reproduced.";

export const iso31000Requirements: FrameworkElement[] = [
  ["Principles — integrated", "Integrated"],
  ["Principles — structured and comprehensive", "Structured and comprehensive"],
  ["Principles — customized", "Customized"],
  ["Principles — inclusive", "Inclusive"],
  ["Principles — dynamic", "Dynamic"],
  ["Principles — best available information", "Best available information"],
  ["Principles — human and cultural factors", "Human and cultural factors"],
  ["Principles — continual improvement", "Continual improvement"],
  ["Process — scope, context and criteria", "Scope, context and criteria"],
  ["Process — risk identification", "Risk identification"],
  ["Process — risk analysis", "Risk analysis"],
  ["Process — risk evaluation", "Risk evaluation"],
  ["Process — risk treatment", "Risk treatment"],
  ["Process — monitoring and review", "Monitoring and review"],
  ["Process — recording and reporting", "Recording and reporting"],
  ["Process — communication and consultation", "Communication and consultation"],
].map(([code, title], index) => ({
  code: `31000-${index + 1}`,
  title,
  text: `${title} is an element title from ISO 31000:2018 (${code}). The text of the standard is not reproduced here. Read the published standard for the requirement.`,
  policies: code.startsWith("Process — risk") ? ["POL-ERM"] : undefined,
}));

export const ISO27001_SOURCE =
  "ISO/IEC 27001:2022 Annex A. Control titles only; the standard text is not reproduced.";

export const iso27001Requirements: FrameworkElement[] = [
  ["A.5.1", "Policies for information security", ["POL-SEC"]],
  ["A.5.7", "Threat intelligence", ["POL-SEC"]],
  ["A.5.19", "Information security in supplier relationships", ["POL-OUT", "POL-SEC"]],
  ["A.5.23", "Information security for use of cloud services", ["POL-SEC", "POL-OUT"]],
  ["A.5.24", "Information security incident management planning and preparation", ["POL-SEC"]],
  ["A.5.30", "ICT readiness for business continuity", ["POL-BCP", "POL-SEC"]],
  ["A.8.2", "Privileged access rights", ["POL-SEC"]],
  ["A.8.7", "Protection against malware", ["POL-SEC"]],
  ["A.8.13", "Information backup", ["POL-BCP", "POL-SEC"]],
  ["A.8.16", "Monitoring activities", ["POL-SEC"]],
].map(([code, title, policies]) => ({
  code: String(code),
  title: String(title),
  text: `${title} (${code}) is a control title from ISO/IEC 27001:2022 Annex A. The control text is not reproduced here. Read the published standard for the requirement.`,
  policies: policies as string[],
  controls: code === "A.8.2" ? ["CTL-11"] : code === "A.8.13" || code === "A.5.30" ? ["CTL-12", "CTL-13"] : ["CTL-11"],
}));
