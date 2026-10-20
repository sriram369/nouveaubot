"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Message from "@/components/Message";
import Composer from "@/components/Composer";
import {
  type Conversation,
  deriveTitle,
  load,
  newConversation,
  save,
} from "@/lib/conversations";

export default function Page() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [online, setOnline] = useState<boolean | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const inFlight = useRef<AbortController | null>(null);

  const active = conversations.find((c) => c.id === activeId);

  useEffect(() => {
    const stored = load();
    if (stored.length > 0) {
      setConversations(stored);
      setActiveId(stored[0].id);
    } else {
      const first = newConversation();
      setConversations([first]);
      setActiveId(first.id);
    }
  }, []);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((j) => setOnline(Boolean(j.online)))
      .catch(() => setOnline(false));
  }, []);

  useEffect(() => {
    if (conversations.length > 0) save(conversations);
  }, [conversations]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages.length, busy]);

  const patch = useCallback(
    (id: string, fn: (c: Conversation) => Conversation) =>
      setConversations((cs) => cs.map((c) => (c.id === id ? fn(c) : c))),
    [],
  );

  const create = () => {
    const fresh = newConversation();
    setConversations((cs) => [fresh, ...cs]);
    setActiveId(fresh.id);
    setError("");
  };

  const remove = (id: string) => {
    setConversations((cs) => {
      const left = cs.filter((c) => c.id !== id);
      if (left.length === 0) {
        const fresh = newConversation();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) setActiveId(left[0].id);
      return left;
    });
  };

  async function send(text: string, files: File[]) {
    if (!active) return;

    const names = files.map((f) => f.name);
    const prompt =
      text ||
      (names.length === 1
        ? `I've attached ${names[0]}. Take a look.`
        : `I've attached ${names.length} documents. Take a look.`);

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user" as const,
      content: prompt,
      attachments: names.length > 0 ? names : undefined,
    };

    const history = [
      ...active.messages.map(({ role, content }) => ({ role, content })),
      { role: "user" as const, content: prompt },
    ];

    const replyId = crypto.randomUUID();
    patch(active.id, (c) => ({
      ...c,
      title: c.messages.length === 0 ? deriveTitle(prompt, names) : c.title,
      messages: [
        ...c.messages,
        userMessage,
        { id: replyId, role: "assistant" as const, content: "" },
      ],
      updatedAt: Date.now(),
    }));

    setBusy(true);
    setError("");

    // A turn that reads a 239-page packet is slow; a turn that has stalled
    // looks identical from here. The ceiling tells them apart, and the stop
    // button means they never have to wait to find out.
    const controller = new AbortController();
    inFlight.current = controller;
    const ceiling = setTimeout(() => controller.abort("timeout"), 5 * 60_000);

    const body = new FormData();
    body.append("messages", JSON.stringify(history));
    for (const f of files) body.append("attachments", f);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        body,
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "nouveauhermes could not be reached.");
      }

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
          const chunk = JSON.parse(raw);

          if (chunk.type === "text") {
            patch(active.id, (c) => ({
              ...c,
              messages: c.messages.map((m) =>
                m.id === replyId ? { ...m, content: m.content + chunk.text } : m,
              ),
              updatedAt: Date.now(),
            }));
          } else if (chunk.type === "error") {
            setError(chunk.message);
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        setError(
          controller.signal.reason === "timeout"
            ? "nouveauhermes did not finish within five minutes. It may still be working — check `hermes gateway status`."
            : "Stopped.",
        );
      } else {
        setError(err instanceof Error ? err.message : "Unexpected error.");
      }
    } finally {
      clearTimeout(ceiling);
      inFlight.current = null;
      setBusy(false);
    }
  }

  const stop = () => inFlight.current?.abort("stopped");

  return (
    <div className="flex h-dvh">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        agentOnline={online}
        onSelect={setActiveId}
        onCreate={create}
        onDelete={remove}
      />

      <main className="flex flex-1 flex-col bg-paper">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
            {active?.messages.length === 0 && <Empty />}

            {active?.messages.map((m) => (
              <Message key={m.id} message={m} />
            ))}

            {busy && (
              <div className="flex items-center gap-3 text-[13px] text-steel-500">
                <span className="animate-pulse">Working</span>
                <button
                  onClick={stop}
                  className="rounded border border-steel-300 px-2 py-0.5 text-[11px] hover:border-steel-500 hover:text-steel-950"
                >
                  Stop
                </button>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-conflict/30 bg-conflict/5 px-4 py-3 text-[13px] text-conflict">
                {error}
              </div>
            )}

            <div ref={bottom} />
          </div>
        </div>

        <Composer busy={busy} disabled={online === false} onSend={send} />
      </main>
    </div>
  );
}

function Empty() {
  return (
    <div className="pt-12">
      <h1 className="text-[22px] font-semibold tracking-tight">
        What are we bidding?
      </h1>
      <p className="mt-2 max-w-md text-[14px] leading-relaxed text-steel-700">
        Attach an Invitation for Bids and I&apos;ll tell you what has to go in it,
        when it is due, and which forms I can prepare from company data you have
        confirmed.
      </p>

      <dl className="mt-8 max-w-md space-y-3 border-t border-steel-300/60 pt-6 text-[13px]">
        <Row term="I prepare" detail="Corporate ID, REAP, references, EEO, Section 3, HUD 5369-A and 2530" />
        <Row term="You obtain" detail="Bid bond, notarised affidavits, DCAMM certificates" />
        <Row term="Never me" detail="The bid price" />
      </dl>
    </div>
  );
}

function Row({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="flex gap-4">
      <dt className="w-24 shrink-0 text-steel-500">{term}</dt>
      <dd className="flex-1 text-steel-900">{detail}</dd>
    </div>
  );
}
