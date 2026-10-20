"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  busy: boolean;
  disabled: boolean;
  onSend: (text: string, file: File | null) => void;
};

const MAX_BYTES = 50 * 1024 * 1024;

export default function Composer({ busy, disabled, onSend }: Props) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [tooLarge, setTooLarge] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const submit = () => {
    if (busy || disabled || (!text.trim() && !file)) return;
    onSend(text.trim(), file);
    setText("");
    setFile(null);
    setTooLarge(false);
    if (area.current) area.current.style.height = "auto";
  };

  const pick = (chosen: File | null) => {
    if (chosen && chosen.size > MAX_BYTES) {
      setTooLarge(true);
      return;
    }
    setTooLarge(false);
    setFile(chosen);
  };

  return (
    <div className="border-t border-steel-300/60 bg-white px-6 py-4">
      {file && (
        <div className="mb-2 flex items-center gap-2 text-xs">
          <span className="value rounded bg-steel-950/6 px-2 py-1">{file.name}</span>
          <span className="value text-steel-500">{(file.size / 1e6).toFixed(1)} MB</span>
          <button
            onClick={() => setFile(null)}
            className="text-steel-500 underline hover:text-steel-950"
          >
            Remove
          </button>
        </div>
      )}

      {tooLarge && (
        <p className="mb-2 text-xs text-conflict">
          That file is over 50 MB. Split it or send the relevant pages.
        </p>
      )}

      <div
        className={cn(
          "flex items-end gap-2 rounded-xl border bg-white px-2 py-2 transition-colors",
          disabled ? "border-steel-300/60" : "border-steel-300 focus-within:border-signal",
        )}
      >
        <label
          className={cn(
            "cursor-pointer rounded-lg px-2.5 py-2 text-sm text-steel-500 hover:bg-steel-950/5 hover:text-steel-950",
            disabled && "pointer-events-none opacity-40",
          )}
          title="Attach a file"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
          <input
            type="file"
            className="hidden"
            disabled={disabled}
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
        </label>

        <textarea
          ref={area}
          rows={1}
          value={text}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            grow(e.target);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={
            disabled
              ? "Start nouveauhermes to begin"
              : "Attach a packet, or tell me a company detail"
          }
          className="max-h-[200px] flex-1 resize-none bg-transparent py-2 text-[14px] outline-none placeholder:text-steel-500 disabled:cursor-not-allowed"
        />

        <button
          onClick={submit}
          disabled={busy || disabled || (!text.trim() && !file)}
          className="rounded-lg bg-signal px-3.5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-30"
        >
          {busy ? "Working" : "Send"}
        </button>
      </div>

      <p className="mt-2 text-[11px] text-steel-500">
        Any file type. Large packets take about a minute to read.
      </p>
    </div>
  );
}
