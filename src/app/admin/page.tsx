// Rebuilt at most every 60s per path — actions call revalidatePath
// to bust it immediately on mutations.
export const revalidate = 60;

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AdminOverview() {
  const supabase = createClient();

  const [{ count: userCount }, { count: activeCount }, { count: serviceCount }, { count: roleCount }] =
    await Promise.all([
      supabase.from("users").select("*", { count: "exact", head: true }),
      supabase.from("users").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("service_types").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("roles").select("*", { count: "exact", head: true }),
    ]);

  return (
    <div>
      <h1 className="font-serif text-[26px] text-ink">Admin overview</h1>
      <p className="text-[var(--muted)] mt-1 max-w-lg">
        Configure the system without touching code. Add team members, define roles, and
        maintain the service catalog Almardini sells.
      </p>

      <div className="grid grid-cols-4 gap-3 mt-8">
        <Stat label="Team members" value={userCount ?? 0} sub={`${activeCount ?? 0} active`} />
        <Stat label="Roles defined" value={roleCount ?? 0} sub="6 seeded by default" />
        <Stat label="Services in catalog" value={serviceCount ?? 0} sub="Active only" />
        <Stat label="System version" value="v0.1" sub="Admin preview" />
      </div>

      <div className="grid grid-cols-3 gap-3 mt-8">
        <ShortcutCard
          href="/admin/users"
          title="Users"
          body="Invite team members, assign a role, deactivate accounts."
        />
        <ShortcutCard
          href="/admin/roles"
          title="Roles &amp; permissions"
          body="Decide who sees what. Tick permissions per role; system roles are protected."
        />
        <ShortcutCard
          href="/admin/services"
          title="Service catalog"
          body="Visa types, PT PMA, KITAS variants. Set the price we charge per service."
        />
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] px-5 py-4">
      <div className="text-xs text-[var(--muted)] font-medium">{label}</div>
      <div className="font-serif text-[30px] text-ink leading-none mt-2 tabular-nums">{value}</div>
      <div className="text-[11.5px] text-[var(--muted)] mt-1">{sub}</div>
    </div>
  );
}

function ShortcutCard({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link
      href={href}
      className="block bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 hover:border-brand transition-colors group"
    >
      <div className="flex items-center justify-between">
        <div className="font-serif text-[18px] text-ink" dangerouslySetInnerHTML={{ __html: title }} />
        <span className="text-brand text-lg group-hover:translate-x-0.5 transition-transform">→</span>
      </div>
      <p className="text-[13px] text-[var(--muted)] mt-2">{body}</p>
    </Link>
  );
}
