"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type NavItem = { href: string; label: string; icon: React.ReactNode };

const nav: NavItem[] = [
  { href: "/admin",          label: "Overview",        icon: <IconHome /> },
  { href: "/admin/users",    label: "Users",           icon: <IconUsers /> },
  { href: "/admin/roles",    label: "Roles",           icon: <IconShield /> },
  { href: "/admin/services", label: "Service catalog", icon: <IconCatalog /> },
  { href: "/admin/company-roles", label: "Company roles", icon: <IconTag /> },
];

export function Sidebar({ userName, userEmail }: { userName: string; userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-[240px] bg-[var(--surface-muted)] border-r border-[var(--border)] p-4 flex flex-col gap-6 sticky top-[66px] h-[calc(100vh-66px)]">
      <Link
        href="/"
        className="flex items-center gap-2 px-2.5 py-2 rounded-md text-[13px] font-medium text-[var(--muted)] hover:text-ink hover:bg-white/60"
      >
        <IconBack />
        Back to app
      </Link>

      <nav className="flex flex-col gap-0.5">
        <div className="text-[10px] tracking-widest text-[var(--muted)] uppercase font-semibold px-2 pb-2">
          Admin
        </div>
        {nav.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13.5px] font-medium ${
                active
                  ? "bg-[var(--surface-muted)] text-ink"
                  : "text-[var(--text)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              <span className="w-4 h-4 text-[var(--muted)]">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-3 border-t border-[var(--border)] flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-brand-soft text-brand-dark flex items-center justify-center text-[11px] font-semibold shrink-0">
          {userName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "??"}
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-ink truncate">{userName}</div>
          <div className="text-[11px] text-[var(--muted)] truncate">{userEmail}</div>
        </div>
        <button
          onClick={signOut}
          className="ml-auto text-[var(--muted)] hover:text-ink text-xs"
          title="Sign out"
        >
          <IconSignOut />
        </button>
      </div>
    </aside>
  );
}

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 12l9-9 9 9M5 10v10h14V10" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21c0-4 3-6 7-6s7 2 7 6" />
      <circle cx="17" cy="6" r="3" />
      <path d="M17 12c3 0 5 1.5 5 5" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function IconCatalog() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 4h16v4H4zM4 12h16v8H4z" />
      <path d="M8 16h4" />
    </svg>
  );
}
function IconTag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20 12l-8 8-9-9V3h8z" />
      <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" />
    </svg>
  );
}
function IconBack() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function IconSignOut() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15">
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5" />
      <path d="M5 12h11" />
    </svg>
  );
}
