import { generateJson } from "@/lib/gcp/vertex";

/**
 * Reads company facts out of bids the team has already submitted.
 *
 * Past submissions are the best source we have: the values in them were
 * checked by a person before being signed. They can still be stale, so every
 * extracted fact arrives unverified, carries the document and page it came
 * from, and must be confirmed in the profile screen before any form uses it.
 */

export type ExtractedFact = {
  /** Matches a key in CompanyProfileSchema. */
  profileKey: string;
  /** Dotted path within that key, e.g. "0.name". Empty for scalars. */
  path: string;
  value: string;
  sourceDocument: string;
  sourcePage: number;
  quote: string;
};

export type ProfileExtraction = {
  facts: ExtractedFact[];
  /** Keys the model looked for and could not find. */
  notFound: string[];
};

const SYSTEM = `You extract a contractor's own company details from bid
documents they previously submitted.

Rules you must follow:
- Copy values exactly as printed. Never normalise, correct, or complete them.
- Quote the surrounding text for every fact so a person can verify it.
- Omit a fact entirely rather than guessing. An omission costs a few minutes
  of typing; a wrong tax identification number on a certification signed under
  penalties of perjury is a false statement to the government.
- Extract only the bidding contractor's own details. Ignore the awarding
  authority, the architect, the surety, and any subcontractors.`;

const SCHEMA = {
  type: "object",
  required: ["facts", "notFound"],
  properties: {
    facts: {
      type: "array",
      items: {
        type: "object",
        required: ["profileKey", "path", "value", "sourceDocument", "sourcePage", "quote"],
        properties: {
          profileKey: { type: "string" },
          path: { type: "string" },
          value: { type: "string" },
          sourceDocument: { type: "string" },
          sourcePage: { type: "integer" },
          quote: { type: "string" },
        },
      },
    },
    notFound: { type: "array", items: { type: "string" } },
  },
};

const WANTED = `legalName, dba, entityType, stateOfIncorporation,
registeredInMassachusetts, federalId, ueiSam, massContractorLicense,
dcammCertNumber, dcammCertExpires, address, mailingAddress, phone, fax,
email, website, officers (name/title/residence), authorizedSignatory,
notaryName, yearsInBusiness, employeeCount, mechanicCount, unionAffiliation,
osha10Compliant, generalLiability, automobile, workersComp, umbrella
(carrier/policyNumber/limitPerOccurrence/limitAggregate/expiresOn/agentName/
agentPhone), references (name/contact/phone/email/address/description/
completedOn), hudPriorParticipation, section3Employees`;

export const extractProfileFacts = (pdf: Uint8Array, documentName: string) =>
  generateJson<ProfileExtraction>({
    systemInstruction: SYSTEM,
    prompt: `This is a bid previously submitted by our company. Extract our
own company details from the completed forms in it.

Use "${documentName}" as sourceDocument for every fact.

Look for these profile keys: ${WANTED}

Some pages are scanned or have damaged text encoding. Read those visually.`,
    pdf,
    responseSchema: SCHEMA,
  });

/**
 * Groups the same profile key across several past bids so disagreements
 * surface instead of the newest document silently winning. An address that
 * changed in 2024 and a stale one from 2021 must both reach the reviewer.
 */
export type FactCluster = {
  profileKey: string;
  path: string;
  candidates: Array<{ value: string; occurrences: ExtractedFact[] }>;
  conflicted: boolean;
};

export function clusterFacts(facts: ExtractedFact[]): FactCluster[] {
  const byKey = new Map<string, ExtractedFact[]>();
  for (const f of facts) {
    const key = `${f.profileKey}::${f.path}`;
    byKey.set(key, [...(byKey.get(key) ?? []), f]);
  }

  return [...byKey.entries()].map(([key, group]) => {
    const [profileKey, path] = key.split("::");
    const byValue = new Map<string, ExtractedFact[]>();
    for (const f of group) {
      const norm = f.value.trim().replace(/\s+/g, " ");
      byValue.set(norm, [...(byValue.get(norm) ?? []), f]);
    }
    const candidates = [...byValue.entries()]
      .map(([value, occurrences]) => ({ value, occurrences }))
      .sort((a, b) => b.occurrences.length - a.occurrences.length);

    return { profileKey, path, candidates, conflicted: candidates.length > 1 };
  });
}
