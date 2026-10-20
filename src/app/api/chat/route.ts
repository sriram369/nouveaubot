import { NextRequest } from "next/server";
import { streamChat, hermesConfigured, type HermesMessage } from "@/lib/hermes";

export const maxDuration = 300;

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const MAX_ATTACHMENTS = 25;

const line = (obj: unknown) => new TextEncoder().encode(JSON.stringify(obj) + "\n");

/**
 * Forwards a conversation to nouveauhermes and streams the reply back.
 *
 * Attachments are written to a per-send directory Hermes can read and are
 * referenced by path in the message, because the agent reads files with its
 * own tools rather than receiving bytes over this wire.
 */
export async function POST(req: NextRequest) {
  if (!hermesConfigured()) {
    return Response.json(
      {
        error:
          "nouveauhermes is not configured. Set HERMES_API_URL and HERMES_API_KEY " +
          "in .env.local, then start it with `hermes gateway run`.",
      },
      { status: 503 },
    );
  }

  let messages: HermesMessage[];

  try {
    const form = await req.formData();
    const raw = JSON.parse(String(form.get("messages") ?? "[]"));

    if (!Array.isArray(raw) || raw.length === 0) {
      return Response.json({ error: "Send at least one message." }, { status: 400 });
    }
    messages = raw as HermesMessage[];

    const attachments = form.getAll("attachments").filter((a): a is File => a instanceof File);

    if (attachments.length > MAX_ATTACHMENTS) {
      return Response.json(
        { error: `${attachments.length} files attached; the limit is ${MAX_ATTACHMENTS}.` },
        { status: 413 },
      );
    }

    const oversized = attachments.filter((f) => f.size > MAX_ATTACHMENT_BYTES);
    if (oversized.length > 0) {
      return Response.json(
        { error: `Over 50 MB: ${oversized.map((f) => f.name).join(", ")}.` },
        { status: 413 },
      );
    }

    if (attachments.length > 0) {
      const { writeFile, mkdir } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const { homedir } = await import("node:os");

      // One directory per send, so a batch of past bids stays together and the
      // agent can be pointed at the folder rather than at each file.
      const batch = `${Date.now()}`;
      const dir = join(homedir(), ".hermes", "nouveau", "uploads", batch);
      await mkdir(dir, { recursive: true });

      const written: string[] = [];
      for (const file of attachments) {
        // Keep the original name: the agent should refer to a document the
        // way the person does.
        const safeName = file.name.replace(/[^\w.\-]/g, "_") || "attachment";
        const path = join(dir, safeName);
        await writeFile(path, Buffer.from(await file.arrayBuffer()));
        written.push(path);
      }

      const last = messages[messages.length - 1];
      last.content =
        `${last.content}\n\n[The user attached ${written.length} ` +
        `${written.length === 1 ? "file" : "files"} in ${dir}:\n` +
        written.map((w) => `  ${w}`).join("\n") +
        `\nRead them with your own tools.]`;
    }
  } catch (err) {
    console.error("[chat] request", err);
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamChat(messages, { signal: req.signal })) {
          controller.enqueue(line(chunk));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "nouveauhermes failed.";
        console.error("[chat]", err);
        controller.enqueue(line({ type: "error", message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
