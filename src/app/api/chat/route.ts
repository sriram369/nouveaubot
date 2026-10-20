import { NextRequest } from "next/server";
import { runTurn, type ChatTurn } from "@/lib/agent/chat";
import { getSession } from "@/lib/agent/session";
import { vertexConfigured } from "@/lib/gcp/optional";

export const maxDuration = 300;

const MAX_PACKET_BYTES = 50 * 1024 * 1024;

const line = (obj: unknown) => new TextEncoder().encode(JSON.stringify(obj) + "\n");

export async function POST(req: NextRequest) {
  if (!vertexConfigured()) {
    return Response.json(
      {
        error:
          "Vertex AI is not configured. Set GOOGLE_CLOUD_PROJECT in .env.local " +
          "and run `gcloud auth application-default login`.",
      },
      { status: 503 },
    );
  }

  let sessionId: string;
  let history: ChatTurn[];

  try {
    const form = await req.formData();
    sessionId = String(form.get("sessionId") ?? "");
    if (!sessionId) return Response.json({ error: "Missing sessionId." }, { status: 400 });

    history = JSON.parse(String(form.get("history") ?? "[]")) as ChatTurn[];
    if (!Array.isArray(history) || history.length === 0) {
      return Response.json({ error: "History must contain at least one turn." }, { status: 400 });
    }

    const state = getSession(sessionId);
    const file = form.get("packet");

    if (file instanceof File) {
      if (file.type !== "application/pdf") {
        return Response.json({ error: "Only PDF attachments are accepted." }, { status: 415 });
      }
      if (file.size > MAX_PACKET_BYTES) {
        return Response.json(
          { error: `Attachment is ${Math.round(file.size / 1e6)} MB; the limit is 50 MB.` },
          { status: 413 },
        );
      }
      state.packetBytes = new Uint8Array(await file.arrayBuffer());
      state.packetName = file.name;
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of runTurn(history, state)) {
            controller.enqueue(line(event));
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "The agent failed.";
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
  } catch (err) {
    console.error("[chat] request", err);
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }
}
