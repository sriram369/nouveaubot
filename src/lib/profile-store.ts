import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { EXPECTED_KEYS, type Profile } from "@/lib/profile-schema";

/**
 * Reads and writes the company profile that nouveauhermes also uses.
 *
 * It lives inside the agent's own directory rather than in this repository:
 * it holds a tax identification number, officer names, and insurance details,
 * and it is shared state between the web app and the agent's skill scripts.
 */

export * from "@/lib/profile-schema";

export const PROFILE_PATH = join(homedir(), ".hermes", "nouveau", "profile.json");

export async function readProfile(): Promise<Profile> {
  try {
    const raw = await readFile(PROFILE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return { facts: parsed.facts ?? {}, updatedAt: parsed.updatedAt };
  } catch (err) {
    // A profile that does not exist yet is the normal starting state; a
    // corrupt one must not be silently replaced with an empty one.
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { facts: {} };
    throw new Error(
      `The profile at ${PROFILE_PATH} could not be read: ` +
        `${err instanceof Error ? err.message : "unknown error"}`,
    );
  }
}

export async function writeProfile(profile: Profile): Promise<void> {
  await mkdir(join(homedir(), ".hermes", "nouveau"), { recursive: true });
  const body = { ...profile, updatedAt: new Date().toISOString() };
  // Readable by the owner only: this file holds a tax identification number.
  await writeFile(PROFILE_PATH, JSON.stringify(body, null, 2) + "\n", { mode: 0o600 });
}

export const summarize = (profile: Profile) => {
  const facts = profile.facts ?? {};
  const verified = Object.values(facts).filter((f) => f.confidence === "verified").length;
  const pending = Object.values(facts).filter((f) => f.confidence !== "verified").length;
  return {
    verified,
    pending,
    expected: EXPECTED_KEYS.length,
    missing: EXPECTED_KEYS.filter((k) => !facts[k]).length,
  };
};
