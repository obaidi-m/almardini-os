"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "error";

export function FeedbackWidget() {
  const pathname = usePathname();
  const supabase = createClient();
  const [signedIn, setSignedIn] = useState(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) setSignedIn(!!data.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session?.user);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  if (!signedIn) return null;

  async function submit() {
    const msg = text.trim();
    if (!msg) return;
    setStatus("sending");
    setError(null);
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) {
      setStatus("error");
      setError("Not signed in");
      return;
    }
    const { error: insertError } = await supabase.from("feedback").insert({
      user_id: uid,
      page_url: pathname,
      message: msg,
    });
    if (insertError) {
      setStatus("error");
      setError(insertError.message);
      return;
    }
    setStatus("sent");
    setText("");
    setTimeout(() => {
      setOpen(false);
      setStatus("idle");
    }, 900);
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 rounded-full bg-brand text-white text-xs font-semibold px-3.5 py-2 shadow-lg hover:opacity-90"
          title="Leave a quick note about what feels wrong or missing"
        >
          Feedback
        </button>
      )}

      {open && (
        <div className="fixed bottom-4 right-4 z-40 w-[320px] rounded-xl border border-[var(--border)] bg-white shadow-2xl p-3">
          <div className="flex items-center justify-between pb-2">
            <div className="text-xs font-semibold text-ink">Note to self</div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setStatus("idle");
                setError(null);
              }}
              className="text-[var(--muted)] hover:text-ink text-xs"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="What felt wrong or missing on this page?"
            className="w-full resize-none rounded-lg border border-[var(--border)] px-2.5 py-2 text-[13px] outline-none focus:border-brand"
            autoFocus
            disabled={status === "sending" || status === "sent"}
          />
          <div className="mt-1 text-[10px] text-[var(--muted)] truncate" title={pathname}>
            page: {pathname}
          </div>
          {error && <div className="mt-1 text-[11px] text-red-600">{error}</div>}
          <div className="mt-2 flex items-center justify-end gap-2">
            {status === "sent" ? (
              <span className="text-[11px] text-emerald-700 font-medium">Saved</span>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={status === "sending" || !text.trim()}
                className="rounded-lg bg-brand text-white text-xs font-semibold px-3 py-1.5 disabled:opacity-50"
              >
                {status === "sending" ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
