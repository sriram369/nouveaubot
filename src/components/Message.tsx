"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message as Msg } from "@/lib/conversations";

export default function Message({ message }: { message: Msg }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-steel-950 px-4 py-2.5 text-[14px] leading-relaxed text-paper">
          {message.attachment && (
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-steel-300">
              <span className="value">{message.attachment}</span>
            </div>
          )}
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="prose-chat max-w-[52rem] text-[14px] text-steel-900">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
    </div>
  );
}
