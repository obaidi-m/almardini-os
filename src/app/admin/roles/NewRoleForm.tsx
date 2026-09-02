"use client";
import { useState, useTransition } from "react";
import { createRole } from "./actions";

export function NewRoleForm() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  return (
    <form
      action={(fd) => {
        setError(null);
        setOk(false);
        start(async () => {
          try {
            await createRole(fd);
            setOk(true);
            (document.getElementById("new-role-form") as HTMLFormElement)?.reset();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to create role");
          }
        });
      }}
      id="new-role-form"
      className="grid grid-cols-3 gap-3"
    >
      <div>
        <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wide mb-1.5">Role name</label>
        <input name="name" required placeholder="Junior PRO"
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-brand focus:border-brand" />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wide mb-1.5">Code (optional)</label>
        <input name="code" placeholder="junior_pro"
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm font-mono focus:outline-brand focus:border-brand" />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wide mb-1.5">Description (optional)</label>
        <input name="description" placeholder="What this role is for"
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-brand focus:border-brand" />
      </div>
      <div className="col-span-3 flex items-center justify-between mt-1">
        <div className="text-[12px] min-h-[18px]">
          {error && <span className="text-red-700">{error}</span>}
          {ok && !error && <span className="text-brand-dark">Role created. Now assign permissions below.</span>}
        </div>
        <button type="submit" disabled={pending}
          className="px-4 py-2 bg-brand text-white rounded-md font-medium text-sm hover:bg-brand-dark disabled:opacity-50">
          {pending ? "Creating…" : "Create role"}
        </button>
      </div>
    </form>
  );
}
