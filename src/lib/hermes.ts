/**
 * nouveauhermes — the single agent behind nouveaubot.
 *
 * Hermes runs as its own process and exposes an OpenAI-compatible endpoint.
 * It owns the agent loop, the tools, the skills, and the memory; this module
 * is only the wire. Nothing here decides anything about a bid.
 */

export type HermesMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const endpoint = () => {
  const url = process.env.HERMES_API_URL;
  const key = process.env.HERMES_API_KEY;
  if (!url || !key) {
    throw new Error(
      "nouveauhermes is not configured. Set HERMES_API_URL and HERMES_API_KEY " +
        "in .env.local, and start the agent with `hermes gateway run`.",
    );
  }
  return { url, key };
};

export const hermesConfigured = () =>
  Boolean(process.env.HERMES_API_URL && process.env.HERMES_API_KEY);

/** Reachable, as opposed to merely configured. */
export async function hermesHealthy(): Promise<boolean> {
  if (!hermesConfigured()) return false;
  try {
    const { url } = endpoint();
    const res = await fetch(url.replace(/\/v1\/?$/, "/health"), {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type StreamChunk =
  | { type: "text"; text: string }
  | { type: "error"; message: string };

/**
 * Streams one assistant turn from nouveauhermes.
 *
 * Tool calls, skill loading, and memory all happen inside Hermes, so this
 * sees only the resulting text.
 */
export async function* streamChat(
  messages: HermesMessage[],
  opts: { model?: string; signal?: AbortSignal } = {},
): AsyncGenerator<StreamChunk> {
  const { url, key } = endpoint();

  const res = await fetch(`${url}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model ?? process.env.HERMES_MODEL ?? "gemini-pro-latest",
      messages,
      stream: true,
    }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    yield {
      type: "error",
      message:
        res.status === 401
          ? "nouveauhermes rejected the key. Check HERMES_API_KEY against the gateway's configured key."
          : `nouveauhermes returned ${res.status}. ${detail.slice(0, 200)}`,
    };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;

      try {
        const parsed = JSON.parse(payload);
        const text = parsed.choices?.[0]?.delta?.content;
        if (text) yield { type: "text", text };
      } catch {
        // A partial frame: the next read completes it.
      }
    }
  }
}
