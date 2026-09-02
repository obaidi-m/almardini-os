"use client";
import { useState, useTransition } from "react";
import { createCompanyRoleAction } from "./actions";

export function NewCompanyRoleForm() {
  const [pending, start] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);

  return (
    <form
      action={(fd) => {
        setFlash(null);
        start(async () => {
          try {
            await createCompanyRoleAction(fd);
            (document.getElementById("new-role-form") as HTMLFormElement | null)?.reset();
          } catch (e) {
            setFlash(e instanceof Error ? e.message : "Failed");
          }
        });
      }}
      id="new-role-form"
      className="grid grid-cols-[1fr_1fr_150px_100px] gap-4 items-end"
    >
      <div>
        <label className="text-[11px] uppercase text-[var(--muted)] font-medium">English label *</label>
        <input name="label_en" required placeholder="e.g. Secretary" className={`${inp} w-full mt-1`} />
      </div>
      <div>
        <label className="text-[11px] uppercase text-[var(--muted)] font-medium">Indonesian label</label>
        <input name="label_id" placeholder="e.g. Sekretaris" className={`${inp} w-full mt-1`} />
      </div>
      <div>
        <label className="text-[11px] uppercase text-[var(--muted)] font-medium">Code (auto)</label>
        <input name="code" placeholder="auto from English" className={`${inp} w-full mt-1 font-mono text-[12px]`} />
      </div>
      <div className="text-right">
        <button type="submit" disabled={pending} className="px-3 py-1.5 text-[13px] font-medium bg-ink text-white rounded-md hover:opacity-90 disabled:opacity-50">
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      {flash && <div className="col-span-4 text-[12px] text-red-700">{flash}</div>}
    </form>
  );
}

const inp =
  "px-2.5 py-1.5 border border-[var(--border)] rounded-md text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";
