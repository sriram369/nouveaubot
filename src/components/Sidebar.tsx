"use client";

import { cn } from "@/lib/utils";
import type { Conversation } from "@/lib/conversations";

type Props = {
  conversations: Conversation[];
  activeId: string;
  agentOnline: boolean | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
};

const relative = (ts: number) => {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
};

export default function Sidebar({
  conversations,
  activeId,
  agentOnline,
  onSelect,
  onCreate,
  onDelete,
}: Props) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-steel-300/60 bg-white">
      <div className="flex items-center justify-between px-4 py-4">
        <span className="text-[15px] font-semibold tracking-tight">nouveaubot</span>
        <button
          onClick={onCreate}
          className="rounded-md px-2 py-1 text-xs font-medium text-signal hover:bg-signal/8"
        >
          New bid
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 && (
          <p className="px-2 py-3 text-xs text-steel-500">
            No bids yet. Attach a packet to start one.
          </p>
        )}

        {conversations.map((c) => (
          <div
            key={c.id}
            className={cn(
              "group relative mb-0.5 rounded-md",
              c.id === activeId ? "bg-steel-950/6" : "hover:bg-steel-950/3",
            )}
          >
            <button
              onClick={() => onSelect(c.id)}
              className="flex w-full items-baseline gap-2 px-2.5 py-2 text-left"
            >
              <span
                className={cn(
                  "flex-1 truncate text-[13px]",
                  c.id === activeId ? "font-medium" : "text-steel-700",
                )}
              >
                {c.title}
              </span>
              <span className="value shrink-0 text-[10px] text-steel-500">
                {relative(c.updatedAt)}
              </span>
            </button>

            <button
              onClick={() => onDelete(c.id)}
              aria-label={`Delete ${c.title}`}
              className="absolute right-1 top-1.5 hidden rounded px-1.5 py-0.5 text-xs text-steel-500 hover:bg-steel-950/8 hover:text-conflict group-hover:block"
            >
              ×
            </button>
          </div>
        ))}
      </nav>

      {/* The profile is what actually blocks every fill, so its state is
          permanently visible rather than buried a screen away. */}
      <div className="border-t border-steel-300/60 px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-steel-500">Company profile</span>
          <span className="value text-xs font-medium text-unconfirmed">0 of 40</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-steel-300/50">
          <div className="h-full w-0 bg-confirmed" />
        </div>
        <p className="mt-2 text-[11px] leading-snug text-steel-500">
          Nothing fills until facts are confirmed.
        </p>

        <div className="mt-3 flex items-center gap-1.5 border-t border-steel-300/60 pt-3">
          <span
            className={cn(
              "size-1.5 rounded-full",
              agentOnline === null && "bg-steel-300",
              agentOnline === true && "bg-confirmed",
              agentOnline === false && "bg-conflict",
            )}
          />
          <span className="text-[11px] text-steel-500">
            {agentOnline === null && "Checking nouveauhermes"}
            {agentOnline === true && "nouveauhermes online"}
            {agentOnline === false && "nouveauhermes offline"}
          </span>
        </div>
      </div>
    </aside>
  );
}
