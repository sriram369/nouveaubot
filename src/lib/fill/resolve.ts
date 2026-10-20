import type { CompanyProfile, Fact } from "@/lib/profile/schema";
import type { FieldMap, FormTemplate } from "@/lib/forms/types";

/** Per-bid values that cannot come from the company profile. */
export type BidContext = {
  ifbNumber: string;
  projectTitle: string;
  awardingAuthority: string;
  bidDate: string;
  /** Sales sets this. Never inferred. */
  bidAmount: string | null;
};

export type ResolutionStatus =
  /** Verified profile value, safe to draw. */
  | "ready"
  /** Value exists but is unverified, or the mapping was model-proposed. */
  | "needs_review"
  /** Only a person can supply it (notary, surety, wet signature). */
  | "human_required"
  /** Mapped, but the profile has nothing there. */
  | "missing";

export type Resolution = {
  field: FieldMap;
  value: string;
  status: ResolutionStatus;
  /** Shown in the review UI so a checker can trace every value. */
  source: string;
};

const isFact = (v: unknown): v is Fact<unknown> =>
  typeof v === "object" && v !== null && "value" in v && "confidence" in v;

/** Walk a dotted path such as "0.name" or "carrier". */
const walk = (value: unknown, path: string | null): unknown => {
  if (!path) return value;
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc === null || acc === undefined) return undefined;
    if (Array.isArray(acc)) return acc[Number(part)];
    if (typeof acc === "object") return (acc as Record<string, unknown>)[part];
    return undefined;
  }, value);
};

const render = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string" || typeof v === "number") return String(v);
  return "";
};

const fromBid = (field: FieldMap, bid: BidContext): Resolution => {
  const key = field.profilePath ?? field.id;
  const value = render((bid as unknown as Record<string, unknown>)[key]);
  return {
    field,
    value,
    status: value ? "ready" : "missing",
    source: value ? `bid.${key}` : "",
  };
};

export function resolveField(
  field: FieldMap,
  profile: CompanyProfile,
  bid: BidContext,
): Resolution {
  if (field.kind === "human") {
    return { field, value: "", status: "human_required", source: "" };
  }
  if (field.kind === "bid") return fromBid(field, bid);

  if (!field.profileKey) {
    return { field, value: "", status: "missing", source: "" };
  }

  const slot = (profile as unknown as Record<string, unknown>)[field.profileKey];
  if (!isFact(slot)) {
    return { field, value: "", status: "missing", source: "" };
  }

  const value = render(walk(slot.value, field.profilePath));
  if (!value) return { field, value: "", status: "missing", source: slot.source };

  // A model-proposed mapping is never trusted on its own, even when the
  // underlying profile value is verified: the mapping itself is the guess.
  const status: ResolutionStatus =
    field.proposed || slot.confidence !== "verified" ? "needs_review" : "ready";

  return { field, value, status, source: slot.source || field.profileKey };
}

export const resolveTemplate = (
  template: FormTemplate,
  profile: CompanyProfile,
  bid: BidContext,
): Resolution[] =>
  template.fields.map((f) => resolveField(f, profile, bid));

export const summarize = (rs: Resolution[]) => ({
  ready: rs.filter((r) => r.status === "ready").length,
  needsReview: rs.filter((r) => r.status === "needs_review").length,
  humanRequired: rs.filter((r) => r.status === "human_required").length,
  missing: rs.filter((r) => r.status === "missing").length,
  total: rs.length,
});
