"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  busy: boolean;
  disabled: boolean;
  onSend: (text: string, files: File[]) => void;
};

const MAX_BYTES_PER_FILE = 50 * 1024 * 1024;
const MAX_FILES = 25;

export default function Composer({ busy, disabled, onSend }: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const submit = () => {
    if (busy || disabled || (!text.trim() && files.length === 0)) return;
    onSend(text.trim(), files);
    setText("");
    setFiles([]);
    setRejected([]);
    if (area.current) area.current.style.height = "auto";
  };

  /** Adds to the selection rather than replacing it, so a person can pick
      from several folders in turn without losing the earlier choices. */
  const add = (incoming: FileList | null) => {
    if (!incoming) return;

    const tooLarge: string[] = [];
    const accepted: File[] = [];

    for (const file of Array.from(incoming)) {
      if (file.size > MAX_BYTES_PER_FILE) {
        tooLarge.push(file.name);
        continue;
      }
      accepted.push(file);
    }

    setRejected(tooLarge);
    setFiles((current) => {
      const seen = new Set(current.map((f) => `${f.name}:${f.size}`));
      const fresh = accepted.filter((f) => !seen.has(`${f.name}:${f.size}`));
      return [...current, ...fresh].slice(0, MAX_FILES);
    });
  };

  const remove = (index: number) =>
    setFiles((current) => current.filter((_, i) => i !== index));

  const totalMb = files.reduce((sum, f) => sum + f.size, 0) / 1e6;

  return (
    <div
      className="border-t border-steel-300/60 bg-white px-6 py-4"
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) add(e.dataTransfer.files);
      }}
    >
      {files.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 flex items-baseline gap-2 text-[11px] text-steel-500">
            <span>
              {files.length} {files.length === 1 ? "file" : "files"}
            </span>
            <span className="value">{totalMb.toFixed(1)} MB</span>
            <button
              onClick={() => setFiles([])}
              className="ml-auto underline hover:text-steel-950"
            >
              Clear all
            </button>
          </div>

          <ul className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="group flex items-center gap-1.5 rounded bg-steel-950/6 py-1 pl-2 pr-1 text-[11px]"
              >
                <span className="value max-w-56 truncate">{f.name}</span>
                <button
                  onClick={() => remove(i)}
                  aria-label={`Remove ${f.name}`}
                  className="rounded px-1 text-steel-500 hover:bg-steel-950/10 hover:text-conflict"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rejected.length > 0 && (
        <p className="mb-2 text-xs text-conflict">
          Over 50 MB, not attached: {rejected.join(", ")}
        </p>
      )}

      <div
        className={cn(
          "flex items-end gap-2 rounded-xl border bg-white px-2 py-2 transition-colors",
          dragging && "border-signal bg-signal/4",
          !dragging && disabled && "border-steel-300/60",
          !dragging && !disabled && "border-steel-300 focus-within:border-signal",
        )}
      >
        <label
          className={cn(
            "cursor-pointer rounded-lg px-2.5 py-2 text-sm text-steel-500 hover:bg-steel-950/5 hover:text-steel-950",
            disabled && "pointer-events-none opacity-40",
          )}
          title="Attach files"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
          <input
            type="file"
            multiple
            className="hidden"
            disabled={disabled}
            onChange={(e) => {
              add(e.target.files);
              // Reset so picking the same file again still fires a change.
              e.target.value = "";
            }}
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
              : "Attach packets, or tell me a company detail"
          }
          className="max-h-[200px] flex-1 resize-none bg-transparent py-2 text-[14px] outline-none placeholder:text-steel-500 disabled:cursor-not-allowed"
        />

        <button
          onClick={submit}
          disabled={busy || disabled || (!text.trim() && files.length === 0)}
          className="rounded-lg bg-signal px-3.5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-30"
        >
          {busy ? "Working" : "Send"}
        </button>
      </div>

      <p className="mt-2 text-[11px] text-steel-500">
        Any file type. Drop a folder of past bids here to build the profile.
      </p>
    </div>
  );
}
