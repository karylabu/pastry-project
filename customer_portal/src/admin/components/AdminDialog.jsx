import React from "react";
import { AlertCircle, CheckCircle2, CircleHelp, X } from "lucide-react";

export default function AdminDialog({ dialog, onClose, onConfirm }) {
  if (!dialog) return null;

  const isConfirmation = dialog.kind === "confirm";
  const isSuccess = dialog.kind === "success";
  const Icon = isConfirmation ? CircleHelp : isSuccess ? CheckCircle2 : AlertCircle;

  return (
    <div
      className="fixed inset-0 z-[11000] flex items-center justify-center bg-[#241812]/55 px-4 py-5 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="admin-dialog-title"
        aria-describedby="admin-dialog-description"
        className="w-full max-w-md overflow-hidden rounded-lg border border-[#eee4de] bg-white shadow-[0_24px_70px_rgba(38,25,16,0.28)]"
      >
        <div className="flex items-start gap-4 p-5 sm:p-6">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${isSuccess ? "bg-emerald-50 text-emerald-600" : isConfirmation ? "bg-[#fff4cd] text-[#9b7810]" : "bg-[#fff1e9] text-[#a64d31]"}`}>
            <Icon size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="admin-dialog-title" className="text-base font-semibold text-[#33251e]">{dialog.title}</h2>
            <p id="admin-dialog-description" className="mt-1.5 whitespace-pre-line text-sm leading-6 text-[#74675f]">{dialog.message}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#8f8076] transition hover:bg-[#f6f1ec] hover:text-[#33251e]"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-[#f0e7e0] bg-[#fbfaf5] p-4 sm:flex-row sm:justify-end">
          {isConfirmation && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#eadfd8] bg-white px-4 py-2.5 text-sm font-semibold text-[#6a5a50] transition hover:bg-[#fff8df]"
            >
              {dialog.cancelLabel || "Cancel"}
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={isConfirmation ? onConfirm : onClose}
            className={`rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${isConfirmation ? "bg-[#8f432d] hover:bg-[#713522] focus-visible:ring-[#c87a5c]" : isSuccess ? "bg-[#68815d] hover:bg-[#526b49] focus-visible:ring-emerald-300" : "bg-[#8f432d] hover:bg-[#713522] focus-visible:ring-[#c87a5c]"}`}
          >
            {isConfirmation ? dialog.confirmLabel || "Continue" : dialog.closeLabel || "Got it"}
          </button>
        </div>
      </section>
    </div>
  );
}
