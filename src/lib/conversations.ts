/**
 * Conversations kept in the browser.
 *
 * The agent keeps its own memory; this is only so a person can leave a bid
 * half-discussed, open another, and come back. One conversation per
 * solicitation is the expected shape, since that is how the work arrives.
 */

export type Role = "user" | "assistant";

export type Message = {
  id: string;
  role: Role;
  content: string;
  /** File name, when the person attached something to this message. */
  attachment?: string;
};

export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

const KEY = "nouveaubot.conversations.v1";

export const newConversation = (): Conversation => ({
  id: crypto.randomUUID(),
  title: "New bid",
  messages: [],
  updatedAt: Date.now(),
});

export function load(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Conversation[]) : [];
  } catch {
    // A corrupt entry should not cost someone the rest of their history.
    return [];
  }
}

export function save(conversations: Conversation[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(conversations));
  } catch (err) {
    // Quota is the realistic failure here, and losing the write is survivable.
    console.warn("Could not save conversations:", err);
  }
}

/**
 * Names a conversation from its first message. A solicitation number is the
 * most useful handle when several bids are open at once, so prefer one.
 */
export function deriveTitle(text: string, attachment?: string): string {
  const solicitation = text.match(/\b[A-Z]{2,6}[-\s]?\d{2}[-\s]?\d{2,4}\b/);
  if (solicitation) return solicitation[0].replace(/\s/g, "-");

  if (attachment) return attachment.replace(/\.[^.]+$/, "").slice(0, 42);

  const firstLine = text.trim().split("\n")[0];
  return firstLine.length > 42 ? `${firstLine.slice(0, 42)}…` : firstLine || "New bid";
}
