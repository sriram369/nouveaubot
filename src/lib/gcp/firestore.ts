import { cert, getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Firestore holds three things: the company profile, the reusable form maps,
 * and one record per bid. Packet PDFs live in Cloud Storage; only their
 * object paths are stored here.
 */
export const db = () => {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    initializeApp({
      credential: raw ? cert(JSON.parse(raw)) : applicationDefault(),
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
    });
  }
  return getFirestore();
};

export const collections = {
  profiles: "profiles",
  formTemplates: "formTemplates",
  bids: "bids",
} as const;

/** There is one company profile; a fixed id keeps it easy to read. */
export const PROFILE_ID = "nouveau";
