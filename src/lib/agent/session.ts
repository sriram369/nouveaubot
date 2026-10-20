import type { AgentState } from "@/lib/agent/tools";

/**
 * Conversation state for local development, held in process memory.
 *
 * A packet is tens of megabytes, so it is kept here rather than sent back and
 * forth with every message. Replace this with Cloud Storage plus Firestore
 * before deploying behind more than one instance.
 */
const sessions = new Map<string, AgentState>();

const MAX_SESSIONS = 50;

export const emptyState = (): AgentState => ({
  packetBytes: null,
  packetName: null,
  reading: null,
  profile: null,
  templates: [],
  bid: null,
});

export function getSession(id: string): AgentState {
  const existing = sessions.get(id);
  if (existing) return existing;

  // Bound memory: drop the oldest session once the map grows past the cap.
  if (sessions.size >= MAX_SESSIONS) {
    const oldest = sessions.keys().next().value;
    if (oldest) sessions.delete(oldest);
  }

  const fresh = emptyState();
  sessions.set(id, fresh);
  return fresh;
}
