"use client";

import { useState } from "react";

export type TraceEntry = {
  name: string;
  status: "running" | "done";
  result?: unknown;
};

const LABELS: Record<string, string> = {
  read_packet: "Reading the packet",
  get_profile: "Checking the company profile",
  set_profile_fact: "Saving a company detail",
  extract_profile_from_past_bid: "Learning from a past bid",
  check_fill_readiness: "Checking what can be filled",
  fill_form: "Filling the form",
};

/** Shows what the agent is doing, so a long packet read is not a silent wait. */
export default function ToolTrace({ entries }: { entries: TraceEntry[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <ul className="mb-3 space-y-1">
      {entries.map((e, i) => (
        <li key={i} className="text-xs">
          <button
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            disabled={e.status === "running"}
            className="flex items-center gap-2 text-neutral-500 disabled:cursor-default"
          >
            <span className={e.status === "running" ? "animate-pulse" : ""}>
              {e.status === "running" ? "◌" : "✓"}
            </span>
            {LABELS[e.name] ?? e.name}
            {e.status === "done" && <span className="text-neutral-400">·  details</span>}
          </button>

          {open === i && (
            <pre className="mt-1 max-h-64 overflow-auto rounded bg-neutral-50 p-2 text-[11px] leading-relaxed dark:bg-neutral-900">
              {JSON.stringify(e.result, null, 2)}
            </pre>
          )}
        </li>
      ))}
    </ul>
  );
}
