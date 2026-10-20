"use client";

import { useState } from "react";
import type { PacketReading } from "@/lib/packet/read";
import PacketResult from "@/components/PacketResult";

type ReadResponse = {
  bidId: string | null;
  reading: PacketReading;
  saved: boolean;
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "done" | "error">("idle");
  const [result, setResult] = useState<ReadResponse | null>(null);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setStatus("reading");
    setError("");
    setResult(null);

    const body = new FormData();
    body.append("packet", file);

    try {
      const res = await fetch("/api/packet/read", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "The packet could not be read.");
      setResult(json);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
      setStatus("error");
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">nouveaubot</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Reads a bid packet, finds what must be submitted, and fills the forms
          from verified company data.
        </p>
      </header>

      <form onSubmit={submit} className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
        <label className="block text-sm font-medium">Bid packet (PDF)</label>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-2 block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:text-white dark:file:bg-neutral-100 dark:file:text-neutral-900"
        />
        {file && (
          <p className="mt-2 text-xs text-neutral-500">
            {file.name} — {(file.size / 1e6).toFixed(1)} MB
          </p>
        )}

        <button
          type="submit"
          disabled={!file || status === "reading"}
          className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {status === "reading" ? "Reading packet…" : "Read packet"}
        </button>

        {status === "reading" && (
          <p className="mt-3 text-xs text-neutral-500">
            A 239-page packet takes roughly a minute.
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}
      </form>

      {result && (
        <>
          {!result.saved && (
            <p className="mt-6 rounded-md bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Storage is not configured, so this reading was not saved.
            </p>
          )}
          <PacketResult reading={result.reading} />
        </>
      )}
    </main>
  );
}
