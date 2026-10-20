import { NextRequest, NextResponse } from "next/server";
import { readPacket } from "@/lib/packet/read";
import { putPacket } from "@/lib/gcp/storage";
import { db, collections } from "@/lib/gcp/firestore";
import { persistenceConfigured, vertexConfigured } from "@/lib/gcp/optional";

export const maxDuration = 300;

const MAX_BYTES = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("packet");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Attach a PDF as the 'packet' field." }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF packets are accepted." }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Packet is ${Math.round(file.size / 1e6)} MB; the limit is 50 MB.` },
        { status: 413 },
      );
    }

    if (!vertexConfigured()) {
      return NextResponse.json(
        {
          error:
            "Vertex AI is not configured. Set GOOGLE_CLOUD_PROJECT and run " +
            "`gcloud auth application-default login`.",
        },
        { status: 503 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const reading = await readPacket(bytes);

    // Without a bucket and Firestore we still return the reading, so the app
    // is useful before any cloud resources exist.
    if (!persistenceConfigured()) {
      return NextResponse.json({ bidId: null, reading, saved: false });
    }

    const bid = db().collection(collections.bids).doc();
    const objectPath = `packets/${bid.id}/${file.name}`;
    await putPacket(objectPath, bytes);

    await bid.set({
      id: bid.id,
      packetPath: objectPath,
      packetName: file.name,
      uploadedAt: new Date().toISOString(),
      reading,
      // Read with a model, so nothing here is acted on until a person
      // confirms it - the deadline above all.
      confirmedByUser: false,
    });

    return NextResponse.json({ bidId: bid.id, reading, saved: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error reading packet.";
    console.error("[packet/read]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
