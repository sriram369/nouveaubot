import { NextRequest } from "next/server";
import { streamChat, hermesConfigured, type HermesMessage } from "@/lib/hermes";

export const maxDuration = 300;

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

const line = (obj: unknown) => new TextEncoder().encode(JSON.stringify(obj) + "\n");

/**
 * Forwards a conversation to nouveauhermes and streams the reply back.
 *
 * Attachments are written to a directory Hermes can read and referenced by
 * path in the message, because the agent reads files with its own tools
 * rather than receiving bytes over this wire.
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

    const file = form.get("attachment");
    if (file instanceof File) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        return Response.json(
          { error: `Attachment is ${Math.round(file.size / 1e6)} MB; the limit is 50 MB.` },
          { status: 413 },
        );
      }

      const { writeFile, mkdir } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const { homedir } = await import("node:os");

      const dir = join(homedir(), ".hermes", "nouveau", "uploads");
      await mkdir(dir, { recursive: true });

      // Keep the original name so the agent can refer to it the way the user does.
      const safeName = file.name.replace(/[^\w.\-]/g, "_");
      const path = join(dir, `${Date.now()}-${safeName}`);
      await writeFile(path, Buffer.from(await file.arrayBuffer()));

      const last = messages[messages.length - 1];
      last.content =
        `${last.content}\n\n[The user attached a file. It is saved at ${path} — ` +
        `read it with your own tools.]`;
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
