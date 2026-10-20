/**
 * The shape of the company profile, and how to label it for a person.
 *
 * Kept apart from the file access in profile-store.ts so the browser can
 * import it: a client component that reaches for node:fs cannot be bundled.
 */

export type Confidence = "verified" | "needs_review";

export type Fact = {
  value: string;
  confidence: Confidence;
  source: string;
  verifiedAt: string | null;
};

export type Profile = {
  facts: Record<string, Fact>;
  updatedAt?: string;
};

/** The facts every recurring bid form needs. Order is the review order. */
export const EXPECTED_KEYS = [
  "legalName", "dba", "entityType", "stateOfIncorporation",
  "registeredInMassachusetts", "federalId", "ueiSam",
  "massContractorLicense", "dcammCertNumber", "dcammCertExpires",
  "address", "mailingAddress", "phone", "fax", "email", "website",
  "president", "treasurer", "secretary", "authorizedSignatory",
  "notaryName", "yearsInBusiness", "employeeCount", "mechanicCount",
  "unionAffiliation", "osha10Compliant",
  "glCarrier", "glLimitPerOccurrence", "glLimitAggregate", "glExpires",
  "autoCarrier", "autoLimit", "workersCompCarrier", "workersCompLimit",
  "umbrellaCarrier", "umbrellaLimit",
  "reference1", "reference2", "reference3", "reference4", "reference5",
] as const;

/** Labels as a person would say them, not as the schema spells them. */
export const LABELS: Record<string, string> = {
  legalName: "Legal company name",
  dba: "Doing business as",
  entityType: "Entity type",
  stateOfIncorporation: "State of incorporation",
  registeredInMassachusetts: "Registered in Massachusetts",
  federalId: "Federal tax ID",
  ueiSam: "UEI (SAM.gov)",
  massContractorLicense: "Massachusetts licence",
  dcammCertNumber: "DCAMM certificate",
  dcammCertExpires: "DCAMM expires",
  address: "Street address",
  mailingAddress: "Mailing address",
  phone: "Phone",
  fax: "Fax",
  email: "Email",
  website: "Website",
  president: "President",
  treasurer: "Treasurer",
  secretary: "Secretary",
  authorizedSignatory: "Signs bid forms",
  notaryName: "Notary",
  yearsInBusiness: "Years in business",
  employeeCount: "Employees",
  mechanicCount: "Mechanics",
  unionAffiliation: "Union",
  osha10Compliant: "OSHA-10 compliant",
  glCarrier: "General liability carrier",
  glLimitPerOccurrence: "GL per occurrence",
  glLimitAggregate: "GL aggregate",
  glExpires: "GL expires",
  autoCarrier: "Automobile carrier",
  autoLimit: "Automobile limit",
  workersCompCarrier: "Workers comp carrier",
  workersCompLimit: "Workers comp limit",
  umbrellaCarrier: "Umbrella carrier",
  umbrellaLimit: "Umbrella limit",
  reference1: "Reference 1",
  reference2: "Reference 2",
  reference3: "Reference 3",
  reference4: "Reference 4",
  reference5: "Reference 5",
};

/** Groups shown as sections in the review panel. */
export const GROUPS: Array<{ title: string; keys: string[] }> = [
  { title: "Identity", keys: ["legalName", "dba", "entityType", "stateOfIncorporation", "registeredInMassachusetts"] },
  { title: "Registrations", keys: ["federalId", "ueiSam", "massContractorLicense", "dcammCertNumber", "dcammCertExpires"] },
  { title: "Contact", keys: ["address", "mailingAddress", "phone", "fax", "email", "website"] },
  { title: "People", keys: ["president", "treasurer", "secretary", "authorizedSignatory", "notaryName"] },
  { title: "Workforce", keys: ["yearsInBusiness", "employeeCount", "mechanicCount", "unionAffiliation", "osha10Compliant"] },
  { title: "Insurance", keys: ["glCarrier", "glLimitPerOccurrence", "glLimitAggregate", "glExpires", "autoCarrier", "autoLimit", "workersCompCarrier", "workersCompLimit", "umbrellaCarrier", "umbrellaLimit"] },
  { title: "References", keys: ["reference1", "reference2", "reference3", "reference4", "reference5"] },
];
