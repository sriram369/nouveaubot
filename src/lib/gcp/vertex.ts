import { VertexAI } from "@google-cloud/vertexai";

const required = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}.`);
  return v;
};

/** Long-context reading of a whole bid packet; also handles scanned pages. */
export const READER_MODEL = "gemini-2.5-pro";

let client: VertexAI | null = null;

export const vertex = (): VertexAI => {
  if (!client) {
    client = new VertexAI({
      project: required("GOOGLE_CLOUD_PROJECT"),
      location: process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1",
    });
  }
  return client;
};

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
 * Everything this returns is treated as a proposal. No value produced here
 * is written onto a bid form without a person approving it first.
 */
export async function generateJson<T>({
  systemInstruction,
  prompt,
  pdf,
  responseSchema,
  model = READER_MODEL,
}: JsonCall): Promise<T> {
  const generative = vertex().getGenerativeModel({
    model,
    systemInstruction,
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: responseSchema as never,
    },
  });

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (pdf) {
    parts.unshift({
      inlineData: {
        mimeType: "application/pdf",
        data: Buffer.from(pdf).toString("base64"),
      },
    });
  }

  const result = await generative.generateContent({
    contents: [{ role: "user", parts: parts as never }],
  });

  const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Vertex returned an empty response.");

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Vertex returned invalid JSON: ${text.slice(0, 300)}`);
  }
}
