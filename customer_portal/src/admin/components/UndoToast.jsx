import React, { useEffect } from "react";
import { RotateCcw, X } from "lucide-react";

export default function UndoToast({ message, onUndo, onDismiss }) {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(timeout);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div
      role="status"
      className="fixed bottom-5 left-1/2 z-[120] flex w-[min(92vw,440px)] -translate-x-1/2 items-center gap-3 rounded-xl border border-[#e7d8b8] bg-[#33251e] px-4 py-3 text-white shadow-[0_12px_36px_rgba(38,25,16,0.28)]"
    >
      <span className="min-w-0 flex-1 text-[12px]">{message}</span>
      <button
        type="button"
        onClick={onUndo}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#fff4cd] px-3 py-2 text-[11px] font-bold text-[#5c4310] transition hover:bg-white"
      >
        <RotateCcw size={13} aria-hidden="true" />
        Undo
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss undo notification"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
