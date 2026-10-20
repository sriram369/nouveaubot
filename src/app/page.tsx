"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatTurn } from "@/lib/agent/chat";
import ToolTrace, { type TraceEntry } from "@/components/ToolTrace";

type Message = ChatTurn & { trace?: TraceEntry[] };

const GREETING =
  "Attach a bid packet and I'll tell you what has to go in it. Or ask me " +
  "about a form, or hand me an old bid to learn the company details from.";

export default function Chat() {
  // Generated after mount: crypto.randomUUID is unavailable while prerendering.
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => setSessionId(crypto.randomUUID()), []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if ((!text && !file) || busy || !sessionId) return;

    const prompt = text || `I've attached ${file?.name}. Read it.`;
    const history: ChatTurn[] = [
      ...messages.map(({ role, text }) => ({ role, text })),
      { role: "user", text: prompt },
    ];

    setMessages((m) => [...m, { role: "user", text: prompt }]);
    setInput("");
    setBusy(true);
    setError("");

    const body = new FormData();
    body.append("sessionId", sessionId);
    body.append("history", JSON.stringify(history));
    if (file) body.append("packet", file);
    setFile(null);

    try {
      const res = await fetch("/api/chat", { method: "POST", body });

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "The agent could not be reached.");
      }

      setMessages((m) => [...m, { role: "model", text: "", trace: [] }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const raw of lines) {
          if (!raw.trim()) continue;
          const event = JSON.parse(raw);

          setMessages((m) => {
            const next = [...m];
            const last = { ...next[next.length - 1] };

            if (event.type === "text") {
              last.text = last.text ? `${last.text}\n\n${event.text}` : event.text;
            } else if (event.type === "tool") {
              last.trace = [...(last.trace ?? []), { name: event.name, status: "running" }];
            } else if (event.type === "tool_result") {
              const trace = [...(last.trace ?? [])];
              const i = trace.findLastIndex((t) => t.name === event.name && t.status === "running");
              if (i >= 0) trace[i] = { ...trace[i], status: "done", result: event.result };
              last.trace = trace;
            } else if (event.type === "error") {
              last.text = last.text || `Something went wrong: ${event.message}`;
            }

            next[next.length - 1] = last;
            return next;
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex h-dvh max-w-3xl flex-col px-4">
      <header className="shrink-0 border-b border-neutral-200 py-4 dark:border-neutral-800">
        <h1 className="text-sm font-semibold tracking-tight">nouveaubot</h1>
        <p className="text-xs text-neutral-500">Bid paperwork, filled from confirmed company data.</p>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto py-6">
        {messages.length === 0 && (
          <p className="rounded-lg bg-neutral-50 p-4 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
            {GREETING}
          </p>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl bg-neutral-900 px-4 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "max-w-full text-sm leading-relaxed"
              }
            >
              {m.trace && m.trace.length > 0 && <ToolTrace entries={m.trace} />}
              {m.text.split("\n\n").map((p, j) => (
                <p key={j} className={j > 0 ? "mt-3" : ""}>
                  {p}
                </p>
              ))}
            </div>
          </div>
        ))}

        {busy && <p className="text-xs text-neutral-400">Working…</p>}
        {error && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}
        <div ref={bottom} />
      </div>

      <form onSubmit={send} className="shrink-0 border-t border-neutral-200 py-4 dark:border-neutral-800">
        {file && (
          <div className="mb-2 flex items-center gap-2 text-xs text-neutral-500">
            <span className="rounded bg-neutral-100 px-2 py-1 dark:bg-neutral-800">
              {file.name} · {(file.size / 1e6).toFixed(1)} MB
            </span>
            <button type="button" onClick={() => setFile(null)} className="underline">
              remove
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <label className="cursor-pointer rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700">
            PDF
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(e);
              }
            }}
            placeholder="Ask about the packet, or tell me a company detail…"
            className="flex-1 resize-none rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-neutral-300"
          />

          <button
            type="submit"
            disabled={busy || !sessionId || (!input.trim() && !file)}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
          >
            Send
          </button>
        </div>
      </form>
    </main>
  );
}
