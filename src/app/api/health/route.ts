import { hermesHealthy } from "@/lib/hermes";

/** Whether nouveauhermes is actually reachable, not merely configured. */
export async function GET() {
  return Response.json({ online: await hermesHealthy() });
}
