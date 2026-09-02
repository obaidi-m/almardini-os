"use client";
import { useState, useTransition } from "react";
import { createCategory, updateCategory, deleteCategory } from "./actions";
import type { ServiceCategory } from "@/lib/types";

export function CategoryManager({ categories, counts }: { categories: ServiceCategory[]; counts: Map<string, number> }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] mb-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <div className="text-[11px] tracking-widest uppercase text-[var(--muted)] font-semibold">
            Categories
          </div>
          <div className="text-[13px] text-[var(--muted)] mt-0.5">
            {categories.length} categor{categories.length === 1 ? "y" : "ies"} — group services into buckets like Immigration, Company formation, Tax.
          </div>
        </div>
        <span className="text-brand text-sm font-medium">{open ? "Close" : "Manage"}</span>
      </button>

      {open && (
        <div className="border-t border-[var(--border)] px-5 py-4">
          <form
            action={(fd) => {
              setError(null);
              start(async () => {
                try {
                  await createCategory(fd);
                  (document.getElementById("new-cat-form") as HTMLFormElement)?.reset();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed to add category");
                }
              });
            }}
            id="new-cat-form"
            className="flex gap-2 items-end mb-4"
          >
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wide mb-1.5">
                New category name
              </label>
              <input name="name" required placeholder="e.g. Legal &amp; notary"
                className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-brand focus:border-brand" />
            </div>
            <button type="submit" disabled={pending}
              className="px-4 py-2 bg-brand text-white rounded-md font-medium text-sm hover:bg-brand-dark disabled:opacity-50">
              {pending ? "Adding…" : "Add category"}
            </button>
          </form>
          {error && <div className="mb-3 text-[12px] text-red-700">{error}</div>}

          <div className="flex flex-col divide-y divide-[var(--border)]">
            {categories.map((c) => (
              <div key={c.id} className="py-2.5 flex items-center gap-3">
                {editingId === c.id ? (
                  <form
                    action={(fd) => start(async () => {
                      try { await updateCategory(fd); setEditingId(null); }
                      catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
                    })}
                    className="flex-1 flex items-center gap-2"
                  >
                    <input type="hidden" name="id" value={c.id} />
                    <input
                      name="name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      className="flex-1 px-3 py-1.5 border border-[var(--border)] rounded-md text-sm"
                    />
                    <button type="submit"
                      className="px-3 py-1.5 text-sm bg-brand text-white rounded-md hover:bg-brand-dark">
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-md bg-[var(--surface)]">
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="flex-1">
                      <div className="font-medium text-ink text-[14px]">{c.name}</div>
                      <div className="text-[11.5px] text-[var(--muted)] font-mono">
                        {c.code} · {counts.get(c.id) ?? 0} service{(counts.get(c.id) ?? 0) === 1 ? "" : "s"}
                      </div>
                    </div>
                    <button
                      onClick={() => { setEditingId(c.id); setEditName(c.name); }}
                      className="text-[12px] font-medium text-brand hover:underline"
                    >
                      Rename
                    </button>
                    <form
                      action={(fd) => start(async () => {
                        try { await deleteCategory(fd); }
                        catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
                      })}
                      onSubmit={(e) => { if (!confirm(`Delete category "${c.name}"?`)) e.preventDefault(); }}
                    >
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className="text-[12px] font-medium text-red-700 hover:underline">
                        Delete
                      </button>
                    </form>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
