import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Resolution } from "@/lib/fill/resolve";
import type { FormLocation } from "@/lib/forms/types";

export type OverlayOptions = {
  /**
   * When true, values still awaiting human approval are drawn in amber so a
   * reviewer can see the whole page in context. Such a draft is watermarked
   * and must never be submitted.
   */
  includeUnapproved?: boolean;
};

const INK = rgb(0.06, 0.09, 0.16);
const PENDING = rgb(0.72, 0.42, 0.03);

/**
 * Draws resolved values onto a copy of the packet.
 *
 * Only `ready` values are drawn by default. `needs_review` values are drawn
 * only for a watermarked draft, and `human_required` values are never drawn
 * at all - those blanks are reported in the remaining-items checklist so a
 * person fills them deliberately.
 */
export async function overlayForm(
  packet: Uint8Array,
  location: FormLocation,
  resolutions: Resolution[],
  opts: OverlayOptions = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(packet);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();

  for (const r of resolutions) {
    const drawable =
      r.status === "ready" ||
      (opts.includeUnapproved && r.status === "needs_review");
    if (!drawable || !r.value) continue;

    // Placement pages are relative to the form, not the packet.
    const index = location.startPage - 1 + (r.field.placement.page - 1);
    const page = pages[index];
    if (!page) {
      throw new Error(
        `Field "${r.field.id}" maps to page ${index + 1}, which is outside the packet.`,
      );
    }

    const { x, y, size, maxWidth } = r.field.placement;
    let text = r.value;
    if (maxWidth) {
      while (text.length > 1 && font.widthOfTextAtSize(text, size) > maxWidth) {
        text = text.slice(0, -1);
      }
    }

    page.drawText(text, {
      x,
      y,
      size,
      font,
      color: r.status === "ready" ? INK : PENDING,
    });
  }

  if (opts.includeUnapproved) await watermarkDraft(doc);
  return doc.save();
}

async function watermarkDraft(doc: PDFDocument) {
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (const page of doc.getPages()) {
    const { width } = page.getSize();
    page.drawText("DRAFT - NOT FOR SUBMISSION", {
      x: width / 2 - 150,
      y: 24,
      size: 11,
      font,
      color: rgb(0.78, 0.2, 0.2),
      opacity: 0.75,
    });
  }
}

/** Items a person must still obtain before the bid can go out. */
export const remainingItems = (resolutions: Resolution[]) =>
  resolutions
    .filter((r) => r.status === "human_required" || r.status === "missing")
    .map((r) => ({
      field: r.field.id,
      label: r.field.label,
      page: r.field.placement.page,
      reason:
        r.status === "human_required"
          ? "Requires a person (signature, notary, or surety)."
          : "No value in the company profile.",
    }));
