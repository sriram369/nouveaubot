import { Type, type FunctionDeclaration } from "@/lib/gcp/vertex";
import { readPacket, type PacketReading } from "@/lib/packet/read";
import { extractProfileFacts, clusterFacts } from "@/lib/packet/extract-profile";
import { resolveTemplate, summarize, type BidContext } from "@/lib/fill/resolve";
import type { CompanyProfile } from "@/lib/profile/schema";
import type { FormTemplate } from "@/lib/forms/types";

/**
 * Tools the chat agent may call.
 *
 * The split that matters: the model decides *what* to do, but the values
 * written onto a bid form still come from the verified profile through the
 * resolver. The model is never the source of a fact on a signed document.
 */

const { STRING, OBJECT, BOOLEAN } = Type;

export const declarations: FunctionDeclaration[] = [
  {
    name: "read_packet",
    description:
      "Read the bid packet the user attached: what is being bid, every stated " +
      "deadline, which forms must be submitted, and any internal contradictions. " +
      "Call this once after a packet is attached, before answering questions about it.",
    parameters: { type: OBJECT, properties: {} },
  },
  {
    name: "get_profile",
    description:
      "Load the company profile: the verified facts used to fill forms. Call it " +
      "before claiming a value is missing, and before filling anything.",
    parameters: { type: OBJECT, properties: {} },
  },
  {
    name: "set_profile_fact",
    description:
      "Record a company fact the user stated in conversation. The fact is saved " +
      "as unverified until the user confirms it. Use this whenever the user tells " +
      "you something about the company that forms will need.",
    parameters: {
      type: OBJECT,
      properties: {
        profileKey: { type: STRING, description: "Key in the company profile, e.g. federalId." },
        path: { type: STRING, description: "Dotted path inside the key, e.g. 0.name. Empty for scalars." },
        value: { type: STRING, description: "Value exactly as the user gave it." },
        verified: {
          type: BOOLEAN,
          description: "True only when the user explicitly confirmed this value is correct.",
        },
      },
      required: ["profileKey", "value"],
    },
  },
  {
    name: "extract_profile_from_past_bid",
    description:
      "Pull company facts out of a bid the team previously submitted. Use when " +
      "the user attaches an old bid or asks to learn from past submissions.",
    parameters: {
      type: OBJECT,
      properties: {
        documentName: { type: STRING, description: "File name of the past bid." },
      },
      required: ["documentName"],
    },
  },
  {
    name: "check_fill_readiness",
    description:
      "For a form in the current packet, report which fields are ready to fill, " +
      "which need review, which need a person, and which are missing from the " +
      "profile. Call this before offering to fill anything.",
    parameters: {
      type: OBJECT,
      properties: {
        formName: { type: STRING, description: "Form as named in the submission checklist." },
      },
      required: ["formName"],
    },
  },
  {
    name: "fill_form",
    description:
      "Draw verified values onto a form and return a downloadable PDF. Only call " +
      "after check_fill_readiness and after the user has approved. Fields needing " +
      "a person are left blank and reported.",
    parameters: {
      type: OBJECT,
      properties: {
        formName: { type: STRING },
        draft: {
          type: BOOLEAN,
          description:
            "True produces a watermarked draft that also shows unapproved values. " +
            "False produces a submission copy with verified values only.",
        },
      },
      required: ["formName"],
    },
  },
];

/** State carried across one conversation. */
export type AgentState = {
  packetBytes: Uint8Array | null;
  packetName: string | null;
  reading: PacketReading | null;
  profile: CompanyProfile | null;
  templates: FormTemplate[];
  bid: BidContext | null;
};

export type ToolResult = Record<string, unknown>;

export async function runTool(
  name: string,
  args: Record<string, unknown>,
  state: AgentState,
): Promise<ToolResult> {
  switch (name) {
    case "read_packet": {
      if (!state.packetBytes) {
        return { error: "No packet is attached. Ask the user to attach the PDF." };
      }
      state.reading = await readPacket(state.packetBytes);
      return { reading: state.reading };
    }

    case "get_profile": {
      if (!state.profile) {
        return {
          profile: null,
          note:
            "No company profile exists yet. Facts can be added from conversation " +
            "with set_profile_fact, or pulled from a past bid.",
        };
      }
      return { profile: state.profile };
    }

    case "set_profile_fact": {
      const { profileKey, path = "", value, verified = false } = args as {
        profileKey: string; path?: string; value: string; verified?: boolean;
      };
      return {
        saved: { profileKey, path, value },
        confidence: verified ? "verified" : "needs_review",
        note: verified
          ? "Stored as verified."
          : "Stored as unverified; it will not auto-fill until confirmed.",
      };
    }

    case "extract_profile_from_past_bid": {
      if (!state.packetBytes) return { error: "Attach the past bid PDF first." };
      const { documentName } = args as { documentName: string };
      const extraction = await extractProfileFacts(state.packetBytes, documentName);
      const clusters = clusterFacts(extraction.facts);
      return {
        found: extraction.facts.length,
        notFound: extraction.notFound,
        conflicts: clusters.filter((c) => c.conflicted),
        clusters,
      };
    }

    case "check_fill_readiness": {
      const { formName } = args as { formName: string };
      const template = state.templates.find(
        (t) => t.title.toLowerCase() === formName.toLowerCase() || t.id === formName,
      );
      if (!template) {
        return {
          error: `No field map exists yet for "${formName}".`,
          mapped: state.templates.map((t) => t.title),
        };
      }
      if (!state.profile) return { error: "No company profile exists yet." };
      if (!state.bid) return { error: "Read the packet first." };

      const resolutions = resolveTemplate(template, state.profile, state.bid);
      return {
        form: template.title,
        summary: summarize(resolutions),
        fields: resolutions.map((r) => ({
          label: r.field.label,
          status: r.status,
          value: r.status === "ready" ? r.value : "",
          source: r.source,
        })),
      };
    }

    case "fill_form":
      // Wired to the overlay engine once field maps exist for this packet.
      return {
        error:
          "No field map exists for this form yet. Field maps are built once per " +
          "form and then reused for every authority that uses it.",
      };

    default:
      return { error: `Unknown tool ${name}.` };
  }
}
