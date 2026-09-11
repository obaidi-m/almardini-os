// Rebuilt at most every 60s per path — actions call revalidatePath
// to bust it immediately on mutations.
export const revalidate = 60;

import { createClient } from "@/lib/supabase/server";
import { NewRoleForm } from "./NewRoleForm";
import { RoleCard } from "./RoleCard";
import type { Role } from "@/lib/types";

type RoleWithCount = Role & { user_count: number };

export default async function RolesPage() {
  const supabase = createClient();

  const [{ data: rolesRaw }, { data: users }] = await Promise.all([
    supabase.from("roles").select("*").order("is_system", { ascending: false }).order("name"),
    supabase.from("users").select("role_id"),
  ]);

  const counts = new Map<string, number>();
  (users ?? []).forEach((u) => {
    counts.set(u.role_id, (counts.get(u.role_id) ?? 0) + 1);
  });

  const roles: RoleWithCount[] = (rolesRaw ?? []).map((r) => ({
    ...(r as Role),
    user_count: counts.get(r.id) ?? 0,
  }));

  return (
    <div>
      <div className="flex items-end justify-between mb-7">
        <div>
          <h1 className="font-serif text-[26px] text-ink">Roles &amp; permissions</h1>
          <p className="text-[var(--muted)] mt-1 max-w-xl">
            Decide who sees what. Every role is a set of permissions; every team member
            gets exactly one role. Owner and Ops Lead are protected — they can&apos;t be deleted.
          </p>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-6 mb-8">
        <div className="text-[11px] tracking-widest uppercase text-[var(--muted)] font-semibold mb-4">
          Create new role
        </div>
        <NewRoleForm />
      </div>

      <div className="flex flex-col gap-3">
        {roles.map((r) => <RoleCard key={r.id} role={r} />)}
      </div>
    </div>
  );
}
