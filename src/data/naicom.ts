export const NAICOM_SOURCE_URL =
  "https://naicom.gov.ng/wp-content/uploads/2025/08/4_REVISED-PRUDENTIAL-GUIDELINES-FOR-INS-INSTIT-IN-NIG-OCT-2022.pdf";

export const NAICOM_WORK =
  "National Insurance Commission, Revised Prudential Guidelines for Insurance Institutions in Nigeria (effective 1 October 2022), Part A, Section 6 — Risk Management Framework for Insurers and Reinsurers.";

export function naicomCitation(paragraph: string): string {
  return `${NAICOM_WORK} Paragraph ${paragraph}. ${NAICOM_SOURCE_URL}`;
}

export type FrameworkElement = {
  code: string;
  title: string;
  text: string;
  controls?: string[];
  policies?: string[];
};

/** Paragraph text from the published guideline. PDF text-layer spacing is repaired; duties and numbers are not rewritten. */
export const naicomRequirements: FrameworkElement[] = [
  {
    code: "6.1.3",
    title: "Risk management framework defined",
    text: "For the purposes of this guideline, a risk management framework is the totality of systems, structures, policies, processes and people within the company by which the company identifies, assesses, mitigates and monitors all internal and external sources of risk that could have a material impact on the company's operations.",
  },
  {
    code: "6.1.4",
    title: "Minimum standard of prudent risk management",
    text: "The guideline sets minimum standard required from each and every insurer and reinsurer by which they can provide a reasonable assurance to the Commission, policyholders, shareholders and other stakeholders that the risks to which they are exposed are being soundly and prudently managed.",
  },
  {
    code: "6.2.1",
    title: "Minimum contents of the risk management framework",
    text: "All insurers and reinsurers shall establish and maintain a Risk Management Framework. The Risk Management Framework must, at a minimum, include the following: (a) Documented Risk Management Strategy; (b) Documented Risk Management Policies, Procedures and Controls; (c) A written Business Plan that is approved by the Board; (d) Chief Risk Officer; (e) Enterprise Risk Management Committee; (f) Up-to-date Risk Register; (g) A Review Process; (h) A well-defined Risk Governance and Responsibilities; (i) A system for Independent Review.",
    policies: ["POL-ERM"],
  },
  {
    code: "6.2.2",
    title: "Material risks the framework must cover",
    text: "The Risk Management Framework must address all material risks, and should at a minimum cover the following areas: (a) Market risk/Investment risk; (b) Credit risk; (c) Operational risk; (d) Liquidity risk; (e) Reinsurance risk; (f) Underwriting risk; (g) Provisioning risk/Reserving risk; (h) Claims management risk; (i) Group risk; (j) Reputational risk; (k) Legal/Litigation risk; (l) Such other risks to which the company may be exposed.",
    policies: ["POL-ERM"],
  },
  {
    code: "6.2.3",
    title: "Risk process, appetite, oversight and culture",
    text: "All insurers and reinsurers shall establish a process for identifying, assessing, controlling, mitigating and monitoring all material risks. This must be developed having regard to the company's risk management philosophy, set of shared beliefs, attitudes, values, culture and operating style. Accordingly: (a) There must be defined risk appetite which should state the amount of risk the company is willing to accept and retain. (b) The company must be clear about who is in charge of risk oversight, assign authority and responsibility and set out an appropriate organizational structure. (c) The company must set standards for Integrity, Ethical Values and a Risk Culture. (d) The company must secure commitment to competence, knowledge and skill of staff in relation to the management of risk.",
    policies: ["POL-ERM", "POL-COC"],
  },
  {
    code: "6.2.4",
    title: "Board responsibility for the framework and appetite",
    text: "The Board of Directors shall have responsibility for: (a) Ensuring an adequate Risk Management Framework including principle for how risks should be identified, assessed, monitored and controlled or mitigated within the company's operations. (b) Defining the company's risk appetite in line with the company's financial resources, business strategies, management expertise and overall willingness to take risk. (c) Reviewing and approving the Risk Management policies and procedures. (d) Re-evaluating the framework and risk appetite at least annually, considering changes in the risk profile of the business (changes in products, markets, operating environment). (e) Ensuring that the Risk Management Framework is regularly audited by appropriately trained and competent personnel that are operationally independent of the risk management activities.",
    policies: ["POL-ERM"],
  },
  {
    code: "6.2.5",
    title: "Senior management implementation",
    text: "The Senior Management shall have responsibility for implementing the framework for risk management approved by the Board. In implementing the framework, the Senior Management shall have responsibility for: (a) Ensuring an appropriate organizational structure, with appropriate level of independence between staff responsible for risk management and those responsible for insurance operation. (b) Ensuring an appropriate level of skilled resources for managing risk, with clearly assigned responsibilities. (c) Developing policies and procedures for identifying, assessing, monitoring and controlling or mitigating risks that reflect the principles set by the Board. The policies and procedures must cover material risk that affects insurance business. (d) Translating the risk appetite expressed by the Board into a system of risk limitation strategies and controls.",
    policies: ["POL-ERM", "POL-UW"],
  },
  {
    code: "6.2.6",
    title: "Risk management department and Chief Risk Officer reporting",
    text: "All insurers and reinsurers shall establish a Risk Management Department/Unit. (a) The Risk Management Department/Unit shall be responsible for measuring, monitoring and controlling risk, consistent with the established policies and procedures. (b) The Risk Management Department/Unit shall be headed by a Chief Risk Officer. (c) The Chief Risk Officer shall be responsible for establishing the risk culture throughout the company. (d) The Chief Risk Officer shall possess all necessary skills and shall have access to all resources relevant for attaining complete understanding of the risks associated with the insurance business. (e) The Chief Risk Officer shall submit a periodic report to the senior management and to the Board on key aspects of the operation of the Risk Management Framework and significant risk exposures. (f) The reporting must include any significant breaches of risk management policies or risk limits and any material loss incidents, and address all material risk classes as well as considering the overall risk profile. (g) The Risk Management Department/Unit shall on a regular basis re-assess the methodologies, models and assumptions used to measure and limit risk.",
    policies: ["POL-ERM"],
  },
  {
    code: "6.2.7",
    title: "Three lines of defence",
    text: "All insurers and reinsurers shall, at a minimum, adopt the 'three lines of defence' model of risk governance with clearly defined roles and responsibilities.",
    policies: ["POL-ERM"],
  },
  {
    code: "6.2.8",
    title: "Independent review of the framework",
    text: "All insurers and reinsurers shall ensure that the Risk Management Framework is subject to effective and comprehensive review by operationally independent, appropriately trained and competent persons. The frequency and scope of the review should be appropriate to the company, having regards to such factors as the size, business mix, complexity of the company's operations and the extent of any change to its business profile or its risk appetite.",
    controls: ["CTL-14"],
  },
  {
    code: "6.2.9",
    title: "Annual Risk Management Declaration",
    text: "The Board of all insurers and reinsurers shall provide the Commission with a declaration on risk management (Risk Management Declaration), relating to each financial year of the company, signed by at least two directors. This declaration must be submitted to the Commission yearly along with the annual returns and accounts of each company and the declaration must conform to the acceptable format as may be prescribed by the Commission from time to time. Appendix 2 of the guideline states that the Board must provide the declaration stating that, to the best of its knowledge and belief, having made appropriate enquiries: (a) the company has systems in place for the purpose of ensuring compliance with this guideline; (b) the Board is satisfied with the efficacy of the processes and systems surrounding the production of financial information of the company; (c) the company has in place a Risk Management Strategy, developed in accordance with the requirements of this guideline, setting out its approach to risk management; and (d) the systems that are in place for managing and monitoring risks, and the risk management framework, are appropriate to the company, having regard to such factors as the size, business mix and complexity of the company's operations.",
    policies: ["POL-ERM"],
  },
  {
    code: "6.2.10",
    title: "Annual return updating the section 6 requirements",
    text: "Annual return to be provided to the Commission providing update of all the above requirements from page 34–37 paragraph 6.2.9.",
    controls: ["CTL-14"],
  },
  {
    code: "6.3.1.1",
    title: "Elements of a risk management strategy",
    text: "The risk management strategy is a high level document which contains: (a) the company's strategy for managing risk; (b) the extent and circumstances under which the company is prepared to accept risk; and (c) the key elements of the risk management framework, which gives effect to the strategy for managing risk.",
    policies: ["POL-ERM"],
  },
  {
    code: "6.3.1.2",
    title: "What the strategy must set out",
    text: "A company's risk management strategy must therefore, at a minimum: (a) detail the company's approach to the matters listed in paragraph 6.3.1.1; (b) identify the policies and procedures for dealing with the process for identifying and assessing material risks, the process for establishing and implementing mitigation and control mechanisms for material risks, the process for monitoring and reporting of risk issues (including communication and escalation mechanisms), and the process for monitoring and reporting and ensuring continual compliance with the requirements of this guideline; (c) the company's approach to management of capital; and (d) the company's approach to disaster recovery/business continuity management. It must also describe the relationship within the risk management framework between the Board, Board committees and senior management; identify those in positions with managerial responsibility for the risk management framework and instilling an appropriate risk culture across the life of the company; and describe the process by which the risk management framework is reviewed and the intended coverage and timing for these reviews.",
    policies: ["POL-ERM", "POL-BCP"],
  },
  {
    code: "6.3.2.2",
    title: "Risk identification and the risk register",
    text: "Risk identification involves itemising specific occurrence which will have material impact on financial condition, capital and/or sustainability of a company. At this stage, it is vital that all potential categories of risk are identified. The objective is to achieve a comprehensive risk list or risk register which contains details of all types of risks, their assessment, owners and status of the risks. Companies are able to identify the risks they are exposed to through a detailed process of examining their operational activities.",
    policies: ["POL-ERM"],
  },
  {
    code: "6.3.2.3",
    title: "Risk assessment, risk map and residual risk",
    text: "Risk assessment is vital to determine the probability of a risk occurring and the frequency and severity or impact on the business. The frequency of occurrence and impact can be measured in “High”, “Medium” and “Low” terms. Risk assessment can use qualitative and quantitative methods although quantitative methods can be more precise. A risk map should be designed that highlights the findings of risk assessment. The map should indicate key risks faced and factored into the risk appetite of the company. At the same time, the company should perform a comprehensive information and communication technology (ICT) risk assessment. The risk assessment outcome must be complemented with a risk control mechanism. Having assessed relevant risks, management should determine how it will respond by reviewing likelihood and impact, evaluating costs and benefits, and selecting options that bring residual (remaining risk) within the entity's risk tolerances. The response may be through any or all of the following: (a) avoidance or not participating in events that give rise to risk; (b) forbidding certain risky business; (c) reduction in specific actions taken to reduce likelihood or impact or both; (d) sharing portions of the risk (co-insurance or pool); (e) acceptance and coping with the risk.",
    policies: ["POL-ERM", "POL-SEC"],
  },
  {
    code: "6.3.2.4",
    title: "Monitoring appetite and reporting breaches",
    text: "Companies should monitor the actual risk taken relative to the established risk appetite and risk limits. This will require a basis for measuring the level of risk in each risk class being taken. Risk monitoring may be achieved by regular management approaches such as variance analysis, comparisons of information with disparate sources and dealing with unexpected occurrences. Risk reporting involves periodic reporting on key aspects of the operation of the risk management framework and significant risk exposures. The reporting must cover significant breaches of risk management policies or risk limits and any material loss incident.",
    policies: ["POL-ERM"],
  },
  {
    code: "6.3.3.1",
    title: "Market risk / investment risk",
    text: "This is the risk to a company's financial condition resulting from adverse movements in the level or volatility of market prices. All insurers and reinsurers should establish a basis for measuring and calculating the probability of loss and possible impact on the company's capital resources caused by adverse changes in the price of stock and shares, property, exchange rates and other market conditions that are relevant. Companies should have regards to investment limits set in the operational guidelines for insurers and reinsurers and diversify assets to prevent overconcentration and overexposure to any particular market.",
    controls: ["CTL-06"],
    policies: ["POL-ERM"],
  },
  {
    code: "6.3.3.2",
    title: "Credit risk",
    text: "This is the risk that a counterparty will default on payment or fail to perform an obligation to the company. Insurers and reinsurers should establish a system for conducting due diligence on the credit worthiness of any party to which they have credit exposure. Companies should set limits of credit exposure and should have a process for monitoring and controlling such exposure.",
    controls: ["CTL-04", "CTL-05"],
  },
  {
    code: "6.3.3.3",
    title: "Operational risk",
    text: "This is the risk of loss from inadequate or failed internal processes, from people and systems or from external events which arises from the potential that inadequate information systems, operational problems, breaches in internal controls, fraud, or unforeseen catastrophes will result in unexpected losses. Companies should have policies that cover staffing issues and process and systems issues, including measures for preventing system failure, measures to comply with regulatory requirements, measures for business continuity, documentation, IT reliability, IT security, confidentiality, data integrity and authorised access. Companies should assess their vulnerability to operational risks and prioritise their action accordingly. A robust control environment should be put in place, which must include documented policies and procedures which incorporate appropriate checks and balances and a risk register which identifies potential and actual operational risks and controls put in place to mitigate those risks.",
    controls: ["CTL-08", "CTL-10", "CTL-18"],
    policies: ["POL-BCP", "POL-SEC"],
  },
  {
    code: "6.3.3.4",
    title: "Liquidity risk",
    text: "This is the risk that the company will have insufficient cash flow to meet its operational and financial payment obligations because of inability to liquidate assets or obtain funding. Companies should prepare a report to be submitted to their management on a regular basis providing a liquidity overview, covering an appropriate period of time, comparing expected inflows and outflows and specifying the assumptions. Management should consider the actions that would be taken in the event of a liquidity squeeze and document the contingency plans that will be used.",
    controls: ["CTL-06"],
  },
  {
    code: "6.3.3.5",
    title: "Reinsurance risk",
    text: "This is the risk of inadequate reinsurance cover which may be triggered by a situation such as the insolvency of a reinsurer, discovery of exposures without current reinsurance coverage, or exhaustion of reinsurance covers through multiple losses. Insurance companies must ensure that they maintain adequate reinsurance arrangements and treaties in respect of the classes or category of insurance business the insurer is authorized to transact. It must have a documented policy stating: (a) systems for the selection of reinsurance brokers and other reinsurance advisers; (b) systems for selecting and monitoring reinsurance programmes; (c) clearly defined managerial responsibilities and controls; (d) presence of a well-resourced reinsurance department that prepares clear methodologies for determining all aspects of a reinsurance programme. (e) Senior management should review an insurer's reinsurance management systems on a regular basis.",
    controls: ["CTL-03"],
    policies: ["POL-REI"],
  },
  {
    code: "6.3.3.6",
    title: "Underwriting risk",
    text: "Underwriting is the process by which an insurer determines whether and under what conditions to accept a risk. Weaknesses in the systems and controls surrounding the underwriting process can expose an insurer to the risk of unexpected losses which may threaten the capital adequacy of the insurer. All insurers must have an underwriting policies and procedure manual. The company's underwriting process must be subject to internal audit and there should be a peer review of policies underwritten. In addition, companies should have a process for assessing brokers' procedures and systems to ensure that the quality of information provided to the insurer is of a suitable standard; and in the case of reinsurers, audits of ceding companies to ensure that reinsurance assumed is in accordance with treaties in place.",
    controls: ["CTL-01", "CTL-02"],
    policies: ["POL-UW"],
  },
  {
    code: "6.3.3.7",
    title: "Provisioning / reserving risk",
    text: "Reserving risk is the risk that insurance liabilities recorded by the insurer, net of reinsurance and other recoveries in respect of those liabilities, will be inadequate to meet the net amount payable when the insurance liabilities crystallise. Companies should maintain appropriate systems, controls and procedures to ensure that the provision for insurance liabilities is, at all times, sufficient to cover any liabilities that have been incurred, or are yet to be incurred on contracts of insurance accepted by the insurer, as far as can be reasonably estimated.",
    controls: ["CTL-07"],
  },
  {
    code: "6.3.3.8",
    title: "Claims management risk",
    text: "This is the risk that the insurer may be unable to manage the settlement process by which insurers fulfil their contractual obligation to policyholders. All insurers should have in place a claims management policy and procedure for ensuring that claims are handled fairly and promptly. In establishing and maintaining effective claims handling systems and procedures, senior management of insurers should consider: (a) systems and controls to ensure that all liabilities or potential liabilities notified to the insurer are recorded promptly and accurately, and that a proper record is established for each notified claim; (b) suitable systems for claims handling procedures, timeliness of processing and dealing with backlogs; (c) controls to ensure that estimates for reported claims and additional estimates based on statistical evidence are appropriately made on a consistent basis and are properly categorised; (d) regular reviews of the actual outcome of the estimates made, including statistical techniques to compare the estimates with the eventual cost of settling the claims; (e) systems to ensure that claim files without activity are reviewed on a regular basis; (f) procedures to assess the validity of notified claims by reference to the underlying contracts of insurance and reinsurance treaties; (g) procedures for the use of suitable experts such as loss adjusters, lawyers, actuaries and accountants, and to monitor their use; and (h) systems to identify and handle large or unusual claims, including systems to ensure that senior management are involved from the outset in the processing of claims that are significant because of their size or nature.",
    controls: ["CTL-08", "CTL-09"],
    policies: ["POL-CLM"],
  },
  {
    code: "6.3.3.9",
    title: "Business risk",
    text: "This is the risk that a company's market position may be eroded resulting in the future profitability of the company being reduced. Companies are to ensure that such risks are clearly identified and considered when setting or revising corporate strategy.",
  },
  {
    code: "6.3.3.10",
    title: "Reputational risk",
    text: "This is the risk of events that undermine public trust in a company's brand. Trust and integrity are essential for maintaining longstanding customer relationship and for building new ones.",
    policies: ["POL-COC"],
  },
  {
    code: "6.3.3.11",
    title: "Legal risk",
    text: "This arises from the potential that unenforceable contracts, litigations, or adverse judgments can disrupt or otherwise negatively affect the operations or condition of the company.",
    policies: ["POL-UW", "POL-CLM"],
  },
  {
    code: "6.4.1",
    title: "Own Risk and Solvency Assessment",
    text: "An insurer shall perform its own risk and solvency assessment (ORSA), at a minimum, annually, to assess the adequacy of its risk management, and current projected future solvency position with a time horizon which is consistent with that used in its business planning when undertaking its ORSA.",
    policies: ["POL-ERM"],
  },
  {
    code: "6.4.2",
    title: "ORSA documentation",
    text: "The insurer shall document the rationale, calculations and action plans arising from this assessment.",
  },
  {
    code: "6.4.3",
    title: "Board and senior management ownership of ORSA",
    text: "An insurer shall ensure that its board and senior management take responsibility for the ORSA.",
  },
  {
    code: "6.4.4",
    title: "ORSA submission to the Commission",
    text: "An insurer shall on an annual basis submit the results of its ORSA to the Commission not later than 60 days after the year end.",
    controls: ["CTL-14"],
  },
  {
    code: "6.5.1",
    title: "Financial Condition Report",
    text: "An insurer shall on an annual basis appoint an independent actuary who shall conduct and submit a Financial Condition Report with details of, inter alia, measures governing the business operations, corporate governance, risk management, solvency and financial performance of an insurer.",
    controls: ["CTL-07"],
  },
  {
    code: "6.5.2",
    title: "Filing and publication of the Financial Condition Report",
    text: "A copy of the Financial Condition Report shall be submitted to the Commission with the insurer’s annual returns and shall be published on the insurer’s website within 14 days of the date the report was filed with the Commission.",
    controls: ["CTL-14"],
  },
];
