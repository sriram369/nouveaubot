import { generateJson } from "@/lib/gcp/vertex";

/**
 * First pass over an unseen bid packet: work out what is being bid, what
 * must be submitted, and when it is due. Everything here is a proposal for
 * a person to confirm - particularly the deadline, which packets routinely
 * state inconsistently across their cover page and advertisement.
 */

export type RequiredSubmittal = {
  name: string;
  startPage: number | null;
  endPage: number | null;
  /** A person must obtain this (bond, notary, state certificate). */
  externallyObtained: boolean;
  notes: string;
};

export type DateFinding = {
  label: string;
  date: string;
  sourcePage: number;
  quote: string;
};

export type PacketReading = {
  ifbNumber: string;
  projectTitle: string;
  awardingAuthority: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  estimatedValue: string;
  contractTermYears: number | null;
  bidDepositPercent: number | null;
  /** Every stated deadline, kept separate so conflicts stay visible. */
  deadlines: DateFinding[];
  walkthroughs: DateFinding[];
  requiredSubmittals: RequiredSubmittal[];
  /** Pages that are specification or boilerplate and are never filled in. */
  readOnlyPageRanges: Array<{ start: number; end: number; reason: string }>;
  conflicts: string[];
};

const SYSTEM = `You read United States public-procurement bid packets for a
contractor's proposal team.

Rules you must follow:
- Report only what the document states. Never infer a missing value.
- Page numbers are 1-indexed positions in the PDF, not printed page labels.
- Record every stated deadline separately, even when they disagree. Do not
  reconcile them, and list each disagreement in "conflicts". Packets often
  carry a stale cover page, and a missed deadline is unrecoverable.
- Check each stated date against its stated weekday and flag mismatches.
- Mark a submittal as externally obtained when it cannot be produced by the
  bidder alone: surety bonds, notarized statements, and certificates issued
  by a government body.`;

const SCHEMA = {
  type: "object",
  required: [
    "ifbNumber", "projectTitle", "awardingAuthority", "contactName",
    "contactEmail", "contactPhone", "estimatedValue", "contractTermYears",
    "bidDepositPercent", "deadlines", "walkthroughs", "requiredSubmittals",
    "readOnlyPageRanges", "conflicts",
  ],
  properties: {
    ifbNumber: { type: "string" },
    projectTitle: { type: "string" },
    awardingAuthority: { type: "string" },
    contactName: { type: "string" },
    contactEmail: { type: "string" },
    contactPhone: { type: "string" },
    estimatedValue: { type: "string" },
    contractTermYears: { type: "integer", nullable: true },
    bidDepositPercent: { type: "number", nullable: true },
    deadlines: {
      type: "array",
      items: {
        type: "object",
        required: ["label", "date", "sourcePage", "quote"],
        properties: {
          label: { type: "string" },
          date: { type: "string" },
          sourcePage: { type: "integer" },
          quote: { type: "string" },
        },
      },
    },
    walkthroughs: {
      type: "array",
      items: {
        type: "object",
        required: ["label", "date", "sourcePage", "quote"],
        properties: {
          label: { type: "string" },
          date: { type: "string" },
          sourcePage: { type: "integer" },
          quote: { type: "string" },
        },
      },
    },
    requiredSubmittals: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "startPage", "endPage", "externallyObtained", "notes"],
        properties: {
          name: { type: "string" },
          startPage: { type: "integer", nullable: true },
          endPage: { type: "integer", nullable: true },
          externallyObtained: { type: "boolean" },
          notes: { type: "string" },
        },
      },
    },
    readOnlyPageRanges: {
      type: "array",
      items: {
        type: "object",
        required: ["start", "end", "reason"],
        properties: {
          start: { type: "integer" },
          end: { type: "integer" },
          reason: { type: "string" },
        },
      },
    },
    conflicts: { type: "array", items: { type: "string" } },
  },
};

export const readPacket = (pdf: Uint8Array) =>
  generateJson<PacketReading>({
    systemInstruction: SYSTEM,
    prompt: `Read this bid packet and report its structure.

Find the bid submission checklist (often titled "Bid Submission Checklist"
or "Bidder's Checklist") and use it as the authoritative list of required
submittals. For each one, give the page range where its blank form appears.

Mark the long boilerplate sections as read-only: general conditions,
prevailing wage rate tables, technical specifications, and policy text. Our
team never writes on those pages and we want them excluded from review.`,
    pdf,
    responseSchema: SCHEMA,
  });
