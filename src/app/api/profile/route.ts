import { NextRequest } from "next/server";
import {
  readProfile,
  writeProfile,
  summarize,
  type Confidence,
} from "@/lib/profile-store";

export async function GET() {
  try {
    const profile = await readProfile();
    return Response.json({ profile, summary: summarize(profile) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read the profile.";
    console.error("[profile GET]", err);
    return Response.json({ error: message }, { status: 500 });
  }
}

/** Sets or confirms one fact. Confirming is always a deliberate act. */
export async function PATCH(req: NextRequest) {
  try {
    const { key, value, confidence, source } = (await req.json()) as {
      key?: string;
      value?: string;
      confidence?: Confidence;
      source?: string;
    };

    if (!key) return Response.json({ error: "A key is required." }, { status: 400 });

    const profile = await readProfile();
    const existing = profile.facts[key];

    if (value === undefined && !existing) {
      return Response.json(
        { error: `There is no value recorded for ${key} to confirm.` },
        { status: 400 },
      );
    }

    const next = confidence ?? existing?.confidence ?? "needs_review";
    profile.facts[key] = {
      value: value ?? existing.value,
      confidence: next,
      source: source ?? existing?.source ?? "entered in nouveaubot",
      verifiedAt: next === "verified" ? new Date().toISOString() : null,
    };

    await writeProfile(profile);
    return Response.json({ profile, summary: summarize(profile) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save the profile.";
    console.error("[profile PATCH]", err);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { key } = (await req.json()) as { key?: string };
    if (!key) return Response.json({ error: "A key is required." }, { status: 400 });

    const profile = await readProfile();
    delete profile.facts[key];
    await writeProfile(profile);

    return Response.json({ profile, summary: summarize(profile) });
  } catch (err) {
    console.error("[profile DELETE]", err);
    return Response.json({ error: "Could not remove the fact." }, { status: 500 });
  }
}
