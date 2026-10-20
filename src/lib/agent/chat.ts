import { vertex, READER_MODEL } from "@/lib/gcp/vertex";
import { declarations, runTool, type AgentState } from "@/lib/agent/tools";

export const SYSTEM_PROMPT = `You help a commercial elevator contractor bid on
public housing authority work. You talk with their sales team, read bid
packets, and fill the repetitive forms from company data they have confirmed.

How you work:
- Be brief and concrete. These are busy people with deadlines.
- Never state a company fact you have not read from the profile or been told
  in this conversation. If you do not have it, say so and ask.
- Never invent a tax identification number, licence number, insurance limit,
  or reference. These forms are signed under penalties of perjury, and a
  wrong value is a false statement to the government, not a typo.
- When a packet states a deadline more than once and the statements disagree,
  say so immediately and tell them to confirm it in writing with the awarding
  authority. Do not pick one.
- Bid price, surety bonds, notarisation, and state-issued certificates are
  never yours to produce. Flag them and move on.
- When the user tells you a company fact, save it with set_profile_fact.
- Before offering to fill a form, call check_fill_readiness and report what is
  missing. Do not promise a filled form you cannot produce.`;

export type ChatTurn = {
  role: "user" | "model";
  text: string;
};

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: unknown }
  | { type: "error"; message: string };

const MAX_TOOL_ROUNDS = 6;

/**
 * Runs one assistant turn, looping while the model calls tools. Events are
 * yielded as they happen so the interface can show tool activity rather than
 * a silent pause while a 239-page packet is read.
 */
export async function* runTurn(
  history: ChatTurn[],
  state: AgentState,
): AsyncGenerator<AgentEvent> {
  const model = vertex().getGenerativeModel({
    model: READER_MODEL,
    systemInstruction: SYSTEM_PROMPT,
    tools: [{ functionDeclarations: declarations }],
    generationConfig: { temperature: 0.2 },
  });

  const contents: Array<Record<string, unknown>> = history.map((t) => ({
    role: t.role,
    parts: [{ text: t.text }],
  }));

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await model.generateContent({ contents: contents as never });
    const candidate = result.response.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];

    const calls = parts.filter((p) => "functionCall" in p && p.functionCall);
    const texts = parts
      .map((p) => ("text" in p ? p.text : ""))
      .filter((t): t is string => Boolean(t));

    for (const text of texts) yield { type: "text", text };

    if (calls.length === 0) return;

    contents.push({ role: "model", parts });

    const responses: Array<Record<string, unknown>> = [];
    for (const part of calls) {
      const call = (part as { functionCall: { name: string; args: Record<string, unknown> } })
        .functionCall;
      yield { type: "tool", name: call.name, args: call.args ?? {} };

      let output: unknown;
      try {
        output = await runTool(call.name, call.args ?? {}, state);
      } catch (err) {
        output = { error: err instanceof Error ? err.message : "Tool failed." };
      }

      yield { type: "tool_result", name: call.name, result: output };
      responses.push({
        functionResponse: { name: call.name, response: { result: output } },
      });
    }

    contents.push({ role: "user", parts: responses });
  }

  yield {
    type: "error",
    message: "Stopped after six tool rounds without a final answer.",
  };
}
