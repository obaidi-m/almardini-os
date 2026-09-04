"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { Modal } from "./Modal";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

type Ctx = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Ctx | null>(null);

/** Global confirm dialog. Replaces the browser's native confirm() with a
 *  themed modal. Usage: `const confirm = useConfirm(); if (await confirm({message: "…"})) doThing();`
 *
 *  Mounted once at the root layout — one dialog serves the whole app.
 *  Returns false when the user cancels or dismisses (Esc / outside click). */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    opts: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);

  const confirm = useCallback<Ctx>((opts) => {
    return new Promise<boolean>((resolve) => {
      setState({ opts, resolve });
    });
  }, []);

  function close(result: boolean) {
    if (state) state.resolve(result);
    setState(null);
  }

  const isDanger = state?.opts.tone === "danger";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={state !== null}
        onClose={() => close(false)}
        title={state?.opts.title ?? "Are you sure?"}
        size="md"
      >
        <p className="text-[13.5px] text-ink leading-relaxed whitespace-pre-wrap">
          {state?.opts.message}
        </p>
        <div className="flex justify-end gap-2 pt-5">
          <button
            type="button"
            onClick={() => close(false)}
            className="px-3.5 py-1.5 text-[13px] font-medium text-[var(--text)] bg-white border border-[var(--border)] rounded-md hover:bg-[var(--surface-2)]"
          >
            {state?.opts.cancelLabel ?? "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            autoFocus
            className={`px-3.5 py-1.5 text-[13px] font-medium text-white rounded-md hover:opacity-90 ${
              isDanger ? "bg-red-700" : "bg-ink"
            }`}
          >
            {state?.opts.confirmLabel ?? (isDanger ? "Delete" : "Confirm")}
          </button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Ctx {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
