"use client";

import { useEffect, useState } from "react";

/**
 * The agent sends its reply in a couple of batches rather than token by
 * token, so a long turn shows nothing until it is nearly done. This carries
 * that wait honestly: elapsed time, and a note once a wait is long enough
 * that a person would start to wonder.
 */

type Props = {
  /** Set when the turn includes attachments, which are much slower. */
  heavy: boolean;
  onStop: () => void;
};

const note = (seconds: number, heavy: boolean): string => {
  if (seconds < 4) return "Thinking";
  if (heavy && seconds < 90) return "Reading the documents";
  if (seconds < 20) return "Working";
  if (seconds < 60) return "Still working";
  if (seconds < 150) return "Long one — large packets take a minute or two";
  return "Taking longer than usual";
};

export default function Thinking({ heavy, onStop }: Props) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-3">
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-steel-500"
            style={{
              animation: "nb-bounce 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </span>

      <span className="text-[13px] text-steel-500" aria-live="polite">
        {note(seconds, heavy)}
      </span>

      <span className="value text-[11px] tabular-nums text-steel-500/70">
        {seconds}s
      </span>

      <button
        onClick={onStop}
        className="rounded border border-steel-300 px-2 py-0.5 text-[11px] text-steel-500 hover:border-steel-500 hover:text-steel-950"
      >
        Stop
      </button>
    </div>
  );
}
