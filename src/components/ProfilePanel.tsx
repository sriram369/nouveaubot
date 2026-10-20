"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { GROUPS, LABELS, type Profile } from "@/lib/profile-schema";

type Summary = { verified: number; pending: number; expected: number; missing: number };

export default function ProfilePanel({ onClose }: { onClose: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    try {
      const res = await fetch("/api/profile");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setProfile(json.profile);
      setSummary(json.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the profile.");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async (key: string, value: string, confidence: "verified" | "needs_review") => {
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value, confidence, source: "entered in nouveaubot" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setProfile(json.profile);
      setSummary(json.summary);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    }
  };

  const confirm = async (key: string) => {
    const fact = profile?.facts[key];
    if (fact) await save(key, fact.value, "verified");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-steel-950/25" onClick={onClose}>
      <section
        className="flex h-full w-[32rem] max-w-full flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-steel-300/60 px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight">Company profile</h2>
              <p className="mt-0.5 text-[12px] text-steel-500">
                Only confirmed facts are printed on a form.
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded px-2 py-1 text-steel-500 hover:bg-steel-950/6"
            >
              ×
            </button>
          </div>

          {summary && (
            <div className="mt-4 flex gap-5 text-[12px]">
              <Count n={summary.verified} label="confirmed" tone="confirmed" />
              <Count n={summary.pending} label="awaiting you" tone="unconfirmed" />
              <Count n={summary.missing} label="not recorded" tone="muted" />
            </div>
          )}
        </header>

        {error && (
          <p className="border-b border-conflict/20 bg-conflict/5 px-6 py-3 text-[13px] text-conflict">
            {error}
          </p>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {GROUPS.map((group) => (
            <section key={group.title} className="mb-6">
              <h3 className="mb-2 text-[12px] font-medium text-steel-500">{group.title}</h3>

              <ul>
                {group.keys.map((key) => {
                  const fact = profile?.facts[key];
                  const isEditing = editing === key;

                  return (
                    <li
                      key={key}
                      className="flex items-baseline gap-3 border-b border-steel-300/40 py-2 text-[13px]"
                    >
                      <span className="w-44 shrink-0 text-steel-500">
                        {LABELS[key] ?? key}
                      </span>

                      {isEditing ? (
                        <form
                          className="flex flex-1 gap-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void save(key, draft, "verified");
                          }}
                        >
                          <input
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                            className="value flex-1 rounded border border-signal px-2 py-1 text-[13px] outline-none"
                          />
                          <button
                            type="submit"
                            className="rounded bg-signal px-2.5 py-1 text-[11px] font-medium text-white"
                          >
                            Save
                          </button>
                        </form>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditing(key);
                              setDraft(fact?.value ?? "");
                            }}
                            className={cn(
                              "value flex-1 truncate text-left hover:underline",
                              !fact && "text-steel-500/60",
                            )}
                            title={fact?.source ? `Source: ${fact.source}` : "Not recorded"}
                          >
                            {fact?.value ?? "Add"}
                          </button>

                          {fact && fact.confidence === "verified" && (
                            <span className="shrink-0 text-[11px] text-confirmed">Confirmed</span>
                          )}

                          {fact && fact.confidence !== "verified" && (
                            <button
                              onClick={() => void confirm(key)}
                              className="shrink-0 rounded border border-unconfirmed/40 px-2 py-0.5 text-[11px] text-unconfirmed hover:bg-unconfirmed/8"
                            >
                              Confirm
                            </button>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <footer className="border-t border-steel-300/60 px-6 py-3">
          <p className="text-[11px] leading-snug text-steel-500">
            Stored at <span className="value">~/.hermes/nouveau/profile.json</span>, which
            nouveauhermes reads directly. Never committed to the repository.
          </p>
        </footer>
      </section>
    </div>
  );
}

function Count({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span
        className={cn(
          "value text-[15px] font-medium",
          tone === "confirmed" && "text-confirmed",
          tone === "unconfirmed" && "text-unconfirmed",
          tone === "muted" && "text-steel-500",
        )}
      >
        {n}
      </span>
      <span className="text-steel-500">{label}</span>
    </span>
  );
}
