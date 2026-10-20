import { NextRequest, NextResponse } from "next/server";
import { CompanyProfileSchema } from "@/lib/profile/schema";
import { db, collections, PROFILE_ID } from "@/lib/gcp/firestore";

export async function GET() {
  try {
    const snap = await db().collection(collections.profiles).doc(PROFILE_ID).get();
    if (!snap.exists) return NextResponse.json({ profile: null });
    return NextResponse.json({ profile: snap.data() });
  } catch (err) {
    console.error("[profile GET]", err);
    return NextResponse.json({ error: "Could not load the company profile." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CompanyProfileSchema.safeParse({
      ...body,
      id: PROFILE_ID,
      updatedAt: new Date().toISOString(),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Profile failed validation.", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    await db().collection(collections.profiles).doc(PROFILE_ID).set(parsed.data);
    return NextResponse.json({ profile: parsed.data });
  } catch (err) {
    console.error("[profile PUT]", err);
    return NextResponse.json({ error: "Could not save the company profile." }, { status: 500 });
  }
}
