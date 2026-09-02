"use client";
import { useState, useTransition } from "react";
import { updateUser, toggleUserActive, deleteUser, resetUserPassword } from "./actions";
import type { AppUser, Role } from "@/lib/types";

function randomPassword() {
  const words = ["ubud", "bali", "batu", "malang", "sanur", "canggu", "jaya", "bumi", "raja", "senja"];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  return `${pick()}-${pick()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function UserRow({ user, roles }: { user: AppUser; roles: Role[] }) {
  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [newPass, setNewPass] = useState(randomPassword());
  const [showNewPass, setShowNewPass] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (editing) {
    return (
      <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
        <td colSpan={5} className="px-5 py-4">
          <form
            action={(fd) => {
              start(async () => {
                await updateUser(fd);
                setEditing(false);
              });
            }}
            className="grid grid-cols-4 gap-3 items-end"
          >
            <input type="hidden" name="id" value={user.id} />
            <div>
              <label className="text-[11px] uppercase text-[var(--muted)] font-semibold">Name</label>
              <input name="full_name" defaultValue={user.full_name} required
                className="w-full mt-1 px-3 py-2 border border-[var(--border)] rounded-md text-sm" />
            </div>
            <div>
              <label className="text-[11px] uppercase text-[var(--muted)] font-semibold">Role</label>
              <select name="role_id" defaultValue={user.role_id} required
                className="w-full mt-1 px-3 py-2 border border-[var(--border)] rounded-md text-sm bg-[var(--surface)]">
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] uppercase text-[var(--muted)] font-semibold">Phone</label>
              <input name="phone" defaultValue={user.phone ?? ""}
                className="w-full mt-1 px-3 py-2 border border-[var(--border)] rounded-md text-sm" />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setEditing(false)}
                className="px-3 py-2 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--surface)]">
                Cancel
              </button>
              <button type="submit" disabled={pending}
                className="px-3 py-2 text-sm bg-brand text-white rounded-md hover:bg-brand-dark disabled:opacity-50">
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <>
    <tr className="border-b border-[var(--border)] hover:bg-[var(--surface-muted)]">
      <td className="px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-brand-soft text-brand-dark flex items-center justify-center text-[11px] font-semibold">
            {user.full_name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
          </div>
          <div className="font-medium text-ink">{user.full_name}</div>
        </div>
      </td>
      <td className="px-5 py-3 text-[var(--muted)]">{user.email}</td>
      <td className="px-5 py-3">
        <span className="text-[12px] font-medium bg-brand-soft text-brand-dark px-2 py-0.5 rounded-full">
          {user.role?.name ?? "—"}
        </span>
      </td>
      <td className="px-5 py-3">
        {user.is_active ? (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-green-800 bg-green-100 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-green-700" />
            Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--muted)] bg-[var(--surface-muted)] px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)]" />
            Deactivated
          </span>
        )}
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex items-center justify-end gap-3">
          <button onClick={() => setEditing(true)}
            className="text-[12px] font-medium text-brand hover:underline">
            Edit
          </button>
          <button onClick={() => { setResetting(true); setNewPass(randomPassword()); setFlash(null); }}
            className="text-[12px] font-medium text-[var(--muted)] hover:text-ink">
            Reset password
          </button>
          <form action={(fd) => start(async () => { await toggleUserActive(fd); })} className="inline">
            <input type="hidden" name="id" value={user.id} />
            <input type="hidden" name="is_active" value={String(!user.is_active)} />
            <button type="submit" disabled={pending}
              className="text-[12px] font-medium text-[var(--muted)] hover:text-ink">
              {user.is_active ? "Deactivate" : "Reactivate"}
            </button>
          </form>
          <form
            action={(fd) => start(async () => { try { await deleteUser(fd); } catch (e) { setFlash(e instanceof Error ? e.message : "Failed"); } })}
            onSubmit={(e) => { if (!confirm(`Delete ${user.full_name} permanently? This cannot be undone.`)) e.preventDefault(); }}
            className="inline"
          >
            <input type="hidden" name="id" value={user.id} />
            <button type="submit" disabled={pending}
              className="text-[12px] font-medium text-red-700 hover:underline">
              Delete
            </button>
          </form>
        </div>
        {flash && <div className="mt-1 text-[11.5px] text-red-700 text-right">{flash}</div>}
      </td>
    </tr>

    {resetting && (
      <tr className="bg-[var(--bg)]">
        <td colSpan={5} className="px-5 py-3">
          <form
            action={(fd) => {
              fd.set("password", newPass);
              start(async () => {
                try {
                  await resetUserPassword(fd);
                  setFlash(`New password set: ${newPass}`);
                  setResetting(false);
                } catch (e) {
                  setFlash(e instanceof Error ? e.message : "Failed");
                }
              });
            }}
            className="flex items-center gap-2"
          >
            <input type="hidden" name="id" value={user.id} />
            <span className="text-[12px] font-semibold text-[var(--muted)] uppercase tracking-wide">
              New password for {user.full_name}:
            </span>
            <input
              type={showNewPass ? "text" : "password"}
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              minLength={8}
              className="px-2.5 py-1.5 border border-[var(--border)] rounded-md text-sm font-mono flex-1"
            />
            <button type="button" onClick={() => setShowNewPass(!showNewPass)}
              className="px-2 py-1.5 text-[12px] border border-[var(--border)] rounded-md bg-[var(--surface)]">
              {showNewPass ? "Hide" : "Show"}
            </button>
            <button type="button" onClick={() => setNewPass(randomPassword())}
              className="px-2 py-1.5 text-[12px] border border-[var(--border)] rounded-md bg-[var(--surface)]">
              Regenerate
            </button>
            <button type="submit" disabled={pending}
              className="px-3 py-1.5 text-[12px] bg-brand text-white rounded-md hover:bg-brand-dark disabled:opacity-50">
              Save password
            </button>
            <button type="button" onClick={() => { setResetting(false); setFlash(null); }}
              className="px-3 py-1.5 text-[12px] border border-[var(--border)] rounded-md bg-[var(--surface)]">
              Cancel
            </button>
          </form>
        </td>
      </tr>
    )}
  </>
  );
}
