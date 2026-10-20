import { z } from "zod";
import { PROFILE_KEYS } from "@/lib/profile/schema";

/**
 * Bid packets are flat PDFs: almost none of their pages carry AcroForm
 * fields, so filling means drawing text at known coordinates. A FormMap
 * records those coordinates once per *form*, not per packet.
 *
 * Forms are keyed by their own identity (DHCD 00.45.13, HUD 5369-A, ...)
 * rather than by the issuing authority, because Massachusetts housing
 * authorities reuse the same state and federal forms. Mapping NBHA's REAP
 * form therefore maps every other authority's REAP form too.
 */

export const FieldKind = z.enum([
  /** Pulled straight from the verified profile. Safe to auto-fill. */
  "profile",
  /** Derived per bid (project title, IFB number, bid amount). */
  "bid",
  /** Repeating block, e.g. the five references on DHCD 00.45.13. */
  "repeat",
  /** A human must supply it: notary seal, surety bond, wet signature. */
  "human",
]);
export type FieldKind = z.infer<typeof FieldKind>;

export const PlacementSchema = z.object({
  /** 1-indexed page within the form template, not within the packet. */
  page: z.number().int().positive(),
  /** PDF user-space points, origin bottom-left. */
  x: z.number(),
  y: z.number(),
  size: z.number().default(9),
  maxWidth: z.number().nullable().default(null),
});
export type Placement = z.infer<typeof PlacementSchema>;

export const FieldMapSchema = z.object({
  /** Stable id, e.g. "president" or "reference.1.phone". */
  id: z.string(),
  /** Label as printed on the form, for the review UI. */
  label: z.string(),
  kind: FieldKind,
  /** Which profile key feeds this field. Null for `bid` and `human` kinds. */
  profileKey: z.string().nullable().default(null),
  /** Dotted path inside the profile value, e.g. "carrier" or "0.name". */
  profilePath: z.string().nullable().default(null),
  placement: PlacementSchema,
  /**
   * Set when a model proposed this mapping. A proposed field is rendered
   * for approval and is never filled until a human clears it.
   */
  proposed: z.boolean().default(false),
  proposedBy: z.string().nullable().default(null),
});
export type FieldMap = z.infer<typeof FieldMapSchema>;

export const FormTemplateSchema = z.object({
  /** e.g. "dhcd-00.45.13-bidders-reference" */
  id: z.string(),
  title: z.string(),
  /** Issuing body, used only for display. */
  issuer: z.enum(["NBHA", "DHCD", "HUD", "COMMONWEALTH", "OTHER"]),
  /** Printed revision marker used to detect a changed form, e.g. "11/07/2017". */
  revision: z.string().nullable().default(null),
  pageCount: z.number().int().positive(),
  /**
   * Distinctive lines of text used to locate this form inside an unseen
   * packet. All must appear on the form's first page.
   */
  fingerprint: z.array(z.string()).min(1),
  /** True when the form must accompany the bid itself. */
  requiredWithBid: z.boolean().default(true),
  fields: z.array(FieldMapSchema),
});
export type FormTemplate = z.infer<typeof FormTemplateSchema>;

/** Where a template was found inside one specific packet. */
export const FormLocationSchema = z.object({
  templateId: z.string(),
  startPage: z.number().int().positive(),
  endPage: z.number().int().positive(),
  /** 0..1, how well the fingerprint matched. */
  score: z.number().min(0).max(1),
});
export type FormLocation = z.infer<typeof FormLocationSchema>;

export const isAutoFillable = (f: FieldMap) =>
  !f.proposed && (f.kind === "profile" || f.kind === "repeat");

export const KNOWN_PROFILE_KEYS = PROFILE_KEYS;
