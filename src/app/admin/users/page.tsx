import { createClient } from "@/lib/supabase/server";
import { InviteUserForm } from "./InviteUserForm";
import { UserRow } from "./UserRow";
import type { AppUser, Role } from "@/lib/types";

export default async function UsersPage() {
  const supabase = createClient();

  const [{ data: usersRaw }, { data: roles }] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, full_name, role_id, phone, is_active, created_at, updated_at, invited_by, role:roles(id, code, name, description, permissions, is_system, created_at, updated_at)")
      .order("created_at", { ascending: false }),
    supabase.from("roles").select("*").order("name"),
  ]);

  const users = (usersRaw ?? []) as unknown as AppUser[];
  const roleList = (roles ?? []) as Role[];

  return (
    <div>
      <div className="flex items-end justify-between mb-7">
        <div>
          <h1 className="font-serif text-[26px] text-ink">Users</h1>
          <p className="text-[var(--muted)] mt-1 max-w-lg">
            Add team members directly with a password you set — no email invite. Assign a
            role to control exactly what they see across the system.
          </p>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-6 mb-8">
        <div className="text-[11px] tracking-widest uppercase text-[var(--muted)] font-semibold mb-4">
          Add new user
        </div>
        <InviteUserForm roles={roleList} />
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="font-serif text-[16px] text-ink">Team</h2>
          <span className="text-xs text-[var(--muted)]">{users.length} member{users.length === 1 ? "" : "s"}</span>
        </div>
        {users.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)] text-sm">
            No users yet. Invite the first team member above.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--muted)] bg-[var(--bg)] border-b border-[var(--border)]">
                <th className="px-5 py-2.5 font-semibold">Name</th>
                <th className="px-5 py-2.5 font-semibold">Email</th>
                <th className="px-5 py-2.5 font-semibold">Role</th>
                <th className="px-5 py-2.5 font-semibold">Status</th>
                <th className="px-5 py-2.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => <UserRow key={u.id} user={u} roles={roleList} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
