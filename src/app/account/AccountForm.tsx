"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AccountForm({ email }: { email: string }) {
  const supabase = createClient();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    setErr(null);
    if (next.length < 8) return setErr("Password must be at least 8 characters.");
    if (next !== confirm) return setErr("New passwords don't match.");

    setPending(true);
    // Prove the caller actually knows the current password before Supabase
    // rotates it — otherwise anyone who steals a live session could lock the
    // real user out.
    const check = await supabase.auth.signInWithPassword({ email, password: current });
    if (check.error) {
      setPending(false);
      return setErr("Current password is incorrect.");
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    setPending(false);
    if (error) return setErr(error.message);
    setOk("Password changed.");
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Card title="Sign-in">
        <FieldRow label="Email" value={<span className="font-mono text-[13px]">{email}</span>} />
        <p className="text-[11.5px] text-[var(--muted)] pt-3">
          To change your email, ask an admin.
        </p>
      </Card>

      <Card title="Change password">
        <form onSubmit={submit}>
          <FieldRow
            label="Current"
            value={
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
                autoComplete="current-password"
                className={cellInput}
              />
            }
          />
          <FieldRow
            label="New"
            value={
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className={cellInput}
              />
            }
          />
          <FieldRow
            label="Confirm new"
            value={
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className={cellInput}
              />
            }
          />

          {err && (
            <div className="mt-3 text-[12.5px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {err}
            </div>
          )}
          {ok && (
            <div className="mt-3 text-[12.5px] text-green-800 bg-green-50 border border-green-200 rounded-md px-3 py-2">
              {ok}
            </div>
          )}

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={pending}
              className="px-3.5 py-1.5 text-[13px] font-medium bg-ink text-white rounded-md hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Change password"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface rounded-2xl shadow-[0_1px_3px_rgba(15,31,29,0.06),0_8px_24px_-6px_rgba(15,31,29,0.10)] p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-serif text-[15px] text-ink leading-none">{title}</h2>
      </div>
      <div className="-mb-1">{children}</div>
    </section>
  );
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 py-2 items-center border-t border-[var(--border)] first:border-t-0">
      <div className="text-[11.5px] text-[var(--muted)] font-medium">{label}</div>
      <div className="text-[13.5px] text-ink">{value}</div>
    </div>
  );
}

const cellInput =
  "w-full px-2.5 py-1.5 bg-white border border-[var(--border)] rounded-md text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";
