"use client";
import { useState, useTransition } from "react";
import type { CompanyRoleRecord } from "./page";
import { updateCompanyRoleAction, deleteCompanyRoleAction } from "./actions";

export function CompanyRoleRow({ role }: { role: CompanyRoleRecord }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);

  if (editing) {
    return (
      <div className="grid grid-cols-[1fr_1fr_150px_100px] gap-4 px-2 py-2.5 border-b border-[var(--border)] items-center">
        <form
          action={(fd) => {
            start(async () => {
              try {
                await updateCompanyRoleAction(fd);
                setEditing(false);
              } catch (e) {
                setFlash(e instanceof Error ? e.message : "Failed");
              }
            });
          }}
          className="contents"
        >
          <input type="hidden" name="code" value={role.code} />
          <input
            name="label_en"
            defaultValue={role.label_en}
            required
            className={inp}
            autoFocus
          />
          <input name="label_id" defaultValue={role.label_id ?? ""} className={inp} />
          <span className="font-mono text-[12px] text-[var(--muted)]">{role.code}</span>
          <div className="text-right space-x-2">
            <button type="submit" disabled={pending} className="text-[12px] font-medium text-brand hover:underline disabled:opacity-50">
              {pending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-[12px] text-[var(--muted)] hover:text-ink">
              Cancel
            </button>
          </div>
        </form>
        {flash && <div className="col-span-4 text-[11.5px] text-red-700">{flash}</div>}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[1fr_1fr_150px_100px] gap-4 px-2 py-2.5 border-b border-[var(--border)] items-center text-[13.5px] hover:bg-[var(--surface-muted)]">
      <div className="text-ink font-medium">{role.label_en}</div>
      <div className="text-[var(--muted)]">{role.label_id ?? "—"}</div>
      <div className="font-mono text-[12px] text-[var(--muted)]">{role.code}</div>
      <div className="text-right space-x-2">
        <button onClick={() => setEditing(true)} className="text-[12px] font-medium text-brand hover:underline">
          Edit
        </button>
        <form
          action={(fd) => {
            if (!confirm(`Delete "${role.label_en}"? This can't be undone.`)) return;
            start(async () => {
              try { await deleteCompanyRoleAction(fd); }
              catch (e) { setFlash(e instanceof Error ? e.message : "Failed"); }
            });
          }}
          className="inline"
        >
          <input type="hidden" name="code" value={role.code} />
          <button type="submit" disabled={pending} className="text-[12px] text-[var(--muted)] hover:text-red-700 disabled:opacity-50">
            Delete
          </button>
        </form>
      </div>
      {flash && <div className="col-span-4 text-[11.5px] text-red-700">{flash}</div>}
    </div>
  );
}

const inp =
  "px-2 py-1 border border-[var(--border)] rounded-md text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";
