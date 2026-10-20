import { GoogleGenAI, Type, type FunctionDeclaration } from "@google/genai";

/**
 * One client for both backends. A Google AI Studio key is the quickest way to
 * run locally; setting GOOGLE_GENAI_USE_VERTEXAI switches to Vertex AI, which
 * uses the ambient service-account credentials instead of a key.
 */

export const READER_MODEL = process.env.GEMINI_MODEL ?? "gemini-pro-latest";

let client: GoogleGenAI | null = null;

export const genai = (): GoogleGenAI => {
  if (client) return client;

  if (process.env.GOOGLE_GENAI_USE_VERTEXAI === "true") {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    if (!project) throw new Error("Vertex mode needs GOOGLE_CLOUD_PROJECT.");
    client = new GoogleGenAI({
      vertexai: true,
      project,
      location: process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1",
    });
    return client;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY. Put a Google AI Studio key in .env.local.",
    );
  }
  client = new GoogleGenAI({ apiKey });
  return client;
};

export { Type };
export type { FunctionDeclaration };

export type JsonCall = {
  systemInstruction: string;
  prompt: string;
  /** Inline PDF bytes, when the model needs to see the pages themselves. */
  pdf?: Uint8Array;
  responseSchema: Record<string, unknown>;
  model?: string;
};

/**
 * Calls Gemini with a forced JSON schema and parses the result.
 *
 * Everything this returns is treated as a proposal. No value produced here is
 * written onto a bid form without a person approving it first.
 */
export async function generateJson<T>({
  systemInstruction,
  prompt,
  pdf,
  responseSchema,
  model = READER_MODEL,
}: JsonCall): Promise<T> {
  const parts: Array<Record<string, unknown>> = [];
  if (pdf) {
    parts.push({
      inlineData: {
        mimeType: "application/pdf",
        data: Buffer.from(pdf).toString("base64"),
      },
    });
  }
  parts.push({ text: prompt });

  const res = await genai().models.generateContent({
    model,
    contents: [{ role: "user", parts: parts as never }],
    config: {
      systemInstruction,
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: responseSchema as never,
    },
  });

  const text = res.text;
  if (!text) throw new Error("Gemini returned an empty response.");

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 300)}`);
  }
}
