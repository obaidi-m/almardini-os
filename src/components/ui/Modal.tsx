"use client";
import { useEffect } from "react";

/** Notion-style floating panel. Click outside or press Esc to close.
 *  The underlying page stays mounted, so closing brings the user right back
 *  to where they were — no navigation, no lost scroll. */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = "lg",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const maxW = size === "md" ? "max-w-md" : size === "xl" ? "max-w-4xl" : "max-w-2xl";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto bg-black/25 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxW} bg-surface rounded-2xl shadow-[0_2px_4px_rgba(15,31,29,0.06),0_16px_36px_-8px_rgba(15,31,29,0.14)] my-4`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3 border-b border-[var(--border)]">
            <div className="min-w-0">
              {title && (
                <h2 className="font-serif text-[18px] leading-tight text-ink tracking-tight">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-[12.5px] text-[var(--muted)] mt-0.5">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 text-[var(--muted)] hover:text-ink hover:bg-[var(--surface-2)] rounded-md p-1.5 -mt-1"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6l-12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
