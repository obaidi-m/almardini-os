"use client";
import { useState, useTransition } from "react";
import { updateRoleMeta, updateRolePermissions, deleteRole } from "./actions";
import { PERMISSION_CATALOG, SYSTEM_ROLE_CODES } from "@/lib/permissions";
import type { Role } from "@/lib/types";
import { useConfirm } from "@/components/ui/ConfirmProvider";

type Props = { role: Role & { user_count: number } };

export function RoleCard({ role }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(role.permissions));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const confirm = useConfirm();

  const isOwner = role.code === "owner";
  const isSystem = role.is_system || SYSTEM_ROLE_CODES.includes(role.code);
  const grantsAll = selected.has("*");

  function toggle(code: string) {
    const next = new Set(selected);
    next.has(code) ? next.delete(code) : next.add(code);
    setSelected(next);
  }

  function save() {
    setMsg(null);
    const fd = new FormData();
    fd.append("id", role.id);
    fd.append("permissions", JSON.stringify(Array.from(selected)));
    start(async () => {
      try {
        await updateRolePermissions(fd);
        setMsg({ tone: "ok", text: "Permissions saved." });
      } catch (e) {
        setMsg({ tone: "err", text: e instanceof Error ? e.message : "Failed to save" });
      }
    });
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] overflow-hidden">
      <div className="px-5 py-4 flex items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-[17px] text-ink">{role.name}</h3>
            {isSystem && (
              <span className="text-[10px] uppercase tracking-wider font-semibold bg-gold-soft text-[#8A5A0F] px-2 py-0.5 rounded-full">
                System
              </span>
            )}
          </div>
          <div className="text-[12.5px] text-[var(--muted)] mt-0.5">
            <span className="font-mono">{role.code}</span>
            {role.description && <> · {role.description}</>}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-4 text-[12.5px]">
          <span className="text-[var(--muted)]">
            <span className="font-mono text-ink">{role.user_count}</span> user{role.user_count === 1 ? "" : "s"}
          </span>
          <span className="text-[var(--muted)]">
            <span className="font-mono text-ink">{grantsAll ? "All" : role.permissions.length}</span> permissions
          </span>
          <button
            className="text-brand font-medium hover:underline"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Collapse" : "Manage"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[var(--border)] px-5 py-5 bg-[var(--bg)]">
          {/* Meta editing */}
          <div className="mb-5">
            {editingMeta ? (
              <form
                action={(fd) => start(async () => {
                  try { await updateRoleMeta(fd); setEditingMeta(false); setMsg({ tone: "ok", text: "Role details saved." }); }
                  catch (e) { setMsg({ tone: "err", text: e instanceof Error ? e.message : "Failed" }); }
                })}
                className="grid grid-cols-3 gap-3 items-end"
              >
                <input type="hidden" name="id" value={role.id} />
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase mb-1">Name</label>
                  <input name="name" defaultValue={role.name} required
                    className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase mb-1">Code</label>
                  <input name="code" defaultValue={role.code} disabled={isSystem}
                    className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded-md text-sm font-mono disabled:bg-[var(--surface-muted)]" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase mb-1">Description</label>
                  <input name="description" defaultValue={role.description ?? ""}
                    className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded-md text-sm" />
                </div>
                <div className="col-span-3 flex justify-end gap-2">
                  <button type="button" onClick={() => setEditingMeta(false)}
                    className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-md bg-[var(--surface)]">Cancel</button>
                  <button type="submit" disabled={pending}
                    className="px-3 py-1.5 text-sm bg-brand text-white rounded-md hover:bg-brand-dark disabled:opacity-50">
                    Save details
                  </button>
                </div>
              </form>
            ) : (
              <button onClick={() => setEditingMeta(true)}
                className="text-[12px] font-medium text-brand hover:underline">
                Edit role name / description
              </button>
            )}
          </div>

          {isOwner ? (
            <div className="p-4 bg-gold-soft border border-gold rounded-md text-[13px] text-[#8A5A0F]">
              <b>Owner</b> always has full system access. Its permissions cannot be edited — this is a safety guarantee so you can never lock yourself out.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[13px] font-medium text-ink">Permissions</div>
                  <div className="text-[12px] text-[var(--muted)]">Tick each capability this role should have.</div>
                </div>
                <label className="flex items-center gap-2 text-[13px] font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={grantsAll}
                    onChange={(e) => {
                      const next = new Set(selected);
                      e.target.checked ? next.add("*") : next.delete("*");
                      setSelected(next);
                    }}
                    className="w-4 h-4 accent-brand"
                  />
                  Grant full access (⋆)
                </label>
              </div>

              <div className={`grid gap-4 ${grantsAll ? "opacity-40 pointer-events-none" : ""}`}
                   style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                {PERMISSION_CATALOG.map((group) => (
                  <div key={group.key} className="border border-[var(--border)] rounded-md bg-[var(--surface)] p-3">
                    <div className="font-medium text-ink text-[13.5px]">{group.label}</div>
                    <div className="text-[11.5px] text-[var(--muted)] mb-2.5">{group.description}</div>
                    <div className="flex flex-col gap-1.5">
                      {group.permissions.map((p) => (
                        <label key={p.code} className="flex items-start gap-2 text-[13px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selected.has(p.code)}
                            onChange={() => toggle(p.code)}
                            className="w-4 h-4 mt-0.5 accent-brand shrink-0"
                          />
                          <span>
                            {p.label}
                            {p.hint && <span className="text-[11px] text-[var(--muted)] block">{p.hint}</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mt-5">
                <div className="text-[12px] min-h-[18px]">
                  {msg?.tone === "err" && <span className="text-red-700">{msg.text}</span>}
                  {msg?.tone === "ok" && <span className="text-brand-dark">{msg.text}</span>}
                </div>
                <div className="flex gap-2">
                  {!isSystem && (
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Delete role",
                          message: `Delete role "${role.name}"?`,
                          confirmLabel: "Delete",
                          tone: "danger",
                        });
                        if (!ok) return;
                        const fd = new FormData(); fd.set("id", role.id);
                        start(async () => {
                          setMsg(null);
                          try { await deleteRole(fd); }
                          catch (e) { setMsg({ tone: "err", text: e instanceof Error ? e.message : "Failed" }); }
                        });
                      }}
                      className="px-3 py-2 text-sm text-red-700 hover:bg-red-50 rounded-md"
                    >
                      Delete role
                    </button>
                  )}
                  <button
                    onClick={save}
                    disabled={pending}
                    className="px-4 py-2 bg-brand text-white rounded-md font-medium text-sm hover:bg-brand-dark disabled:opacity-50"
                  >
                    {pending ? "Saving…" : "Save permissions"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
