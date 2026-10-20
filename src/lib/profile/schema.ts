import { z } from "zod";

/**
 * The company profile is the single source of truth for every value that
 * gets written onto a bid form. Nothing is ever written from a model's
 * output: these forms are signed under penalties of perjury (REAP, HUD
 * 5369-A), so a confidently-wrong value is a debarment risk, not a bug.
 */

/** How much we trust a value. Only `verified` fields may be auto-filled. */
export const Confidence = z.enum(["verified", "needs_review", "missing"]);
export type Confidence = z.infer<typeof Confidence>;

/** Every fact carries its provenance so a reviewer can check it at a glance. */
export const fact = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value,
    confidence: Confidence.default("needs_review"),
    /** Where this came from: "bid:Brockton-2024.pdf p3", "typed by Vin", ... */
    source: z.string().default(""),
    verifiedAt: z.string().datetime().nullable().default(null),
  });

export type Fact<T> = {
  value: T;
  confidence: Confidence;
  source: string;
  verifiedAt: string | null;
};

const text = () => fact(z.string());
const optionalText = () => fact(z.string().nullable());

export const OfficerSchema = z.object({
  name: z.string(),
  title: z.string(),
  residence: z.string().nullable().default(null),
});
export type Officer = z.infer<typeof OfficerSchema>;

export const ReferenceSchema = z.object({
  name: z.string(),
  contact: z.string().default(""),
  phone: z.string().default(""),
  email: z.string().default(""),
  address: z.string().default(""),
  description: z.string().default(""),
  /** DHCD 00.45.13 requires work completed within the past five years. */
  completedOn: z.string().default(""),
});
export type Reference = z.infer<typeof ReferenceSchema>;

export const InsuranceSchema = z.object({
  carrier: z.string(),
  policyNumber: z.string().default(""),
  limitPerOccurrence: z.string().default(""),
  limitAggregate: z.string().default(""),
  expiresOn: z.string().default(""),
  agentName: z.string().default(""),
  agentPhone: z.string().default(""),
});
export type Insurance = z.infer<typeof InsuranceSchema>;

export const CompanyProfileSchema = z.object({
  id: z.string(),
  updatedAt: z.string().datetime(),

  legalName: text(),
  dba: optionalText(),
  entityType: fact(z.enum(["corporation", "partnership", "individual", "dba"])),
  stateOfIncorporation: text(),
  registeredInMassachusetts: fact(z.boolean()),

  federalId: text(),
  ueiSam: text(),
  massContractorLicense: optionalText(),
  dcammCertNumber: optionalText(),
  dcammCertExpires: optionalText(),

  address: text(),
  mailingAddress: optionalText(),
  phone: text(),
  fax: optionalText(),
  email: text(),
  website: optionalText(),

  officers: fact(z.array(OfficerSchema)),
  /** Person who signs bid forms. Must appear in `officers`. */
  authorizedSignatory: fact(OfficerSchema),
  notaryName: optionalText(),

  yearsInBusiness: fact(z.number().int().nonnegative()),
  employeeCount: fact(z.number().int().nonnegative()),
  mechanicCount: fact(z.number().int().nonnegative()),
  unionAffiliation: optionalText(),
  osha10Compliant: fact(z.boolean()),

  generalLiability: fact(InsuranceSchema),
  automobile: fact(InsuranceSchema),
  workersComp: fact(InsuranceSchema),
  umbrella: fact(InsuranceSchema.nullable()),

  references: fact(z.array(ReferenceSchema)),

  /** HUD 2530 prior participation. Free-form until we see real packets. */
  hudPriorParticipation: fact(z.array(z.record(z.string(), z.string()))),
  section3Employees: fact(z.array(z.record(z.string(), z.string()))),
});

export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;

/** Dotted path into a profile, e.g. "officers", "generalLiability". */
export type ProfileKey = keyof Omit<CompanyProfile, "id" | "updatedAt">;

export const PROFILE_KEYS = Object.keys(
  CompanyProfileSchema.shape,
).filter((k) => k !== "id" && k !== "updatedAt") as ProfileKey[];
