"use client";
import { useState, useTransition } from "react";
import { createUserDirect } from "./actions";
import type { Role } from "@/lib/types";

/** Generate a memorable-ish random password: three short words + digits */
function randomPassword() {
  const words = ["ubud", "bali", "batu", "malang", "sanur", "canggu", "jaya", "bumi", "raja", "senja", "hujan", "damai"];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${pick()}-${pick()}-${num}`;
}

export function InviteUserForm({ roles }: { roles: Role[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<{ email: string; password: string } | null>(null);
  const [password, setPassword] = useState(randomPassword());
  const [showPassword, setShowPassword] = useState(true);

  return (
    <form
      action={(fd) => {
        setError(null);
        setOk(null);
        // ensure the current visible password is what's submitted
        fd.set("password", password);
        const email = String(fd.get("email") || "");
        start(async () => {
          try {
            await createUserDirect(fd);
            setOk({ email, password });
            const el = document.getElementById("add-user-form") as HTMLFormElement | null;
            el?.reset();
            setPassword(randomPassword());
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to add user");
          }
        });
      }}
      id="add-user-form"
      className="grid grid-cols-2 gap-3"
    >
      <Field label="Full name">
        <input name="full_name" required placeholder="Rina Andriani"
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-brand focus:border-brand" />
      </Field>
      <Field label="Email">
        <input name="email" type="email" required placeholder="rina@almardini.id"
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-brand focus:border-brand" />
      </Field>
      <Field label="Role">
        <select name="role_id" required
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm bg-[var(--surface)] focus:outline-brand focus:border-brand">
          <option value="">Select a role…</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Phone (optional)">
        <input name="phone" placeholder="+62 851 9500 1200"
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-brand focus:border-brand" />
      </Field>

      <div className="col-span-2">
        <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wide mb-1.5">
          Password
        </label>
        <div className="flex gap-2">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="flex-1 px-3 py-2 border border-[var(--border)] rounded-md text-sm font-mono focus:outline-brand focus:border-brand"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="px-3 py-2 text-[12px] font-medium border border-[var(--border)] rounded-md bg-[var(--surface)] hover:bg-[var(--surface-muted)]"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
          <button
            type="button"
            onClick={() => setPassword(randomPassword())}
            className="px-3 py-2 text-[12px] font-medium border border-[var(--border)] rounded-md bg-[var(--surface)] hover:bg-[var(--surface-muted)]"
          >
            Regenerate
          </button>
        </div>
        <div className="text-[11.5px] text-[var(--muted)] mt-1.5">
          You&apos;ll share this with the user directly (WhatsApp, in person). They can change it later.
        </div>
      </div>

      <div className="col-span-2 flex items-center justify-between mt-1">
        <div className="text-[12px] min-h-[18px]">
          {error && <span className="text-red-700">{error}</span>}
          {ok && !error && (
            <span className="text-brand-dark">
              User created. Share these credentials with them:{" "}
              <b className="font-mono">{ok.email}</b> / <b className="font-mono">{ok.password}</b>
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-brand text-white rounded-md font-medium text-sm hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? "Creating…" : "Add user"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
