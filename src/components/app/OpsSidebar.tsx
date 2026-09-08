"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LanguageToggle } from "@/components/app/LanguageToggle";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

type NavItem = { href: string; labelKey: MessageKey; icon: React.ReactNode };

const nav: NavItem[] = [
  { href: "/", labelKey: "nav.dashboard", icon: <IconHome /> },
  { href: "/clients", labelKey: "nav.clients", icon: <IconUsers /> },
  { href: "/companies", labelKey: "nav.companies", icon: <IconBuilding /> },
  { href: "/cases", labelKey: "nav.cases", icon: <IconFolder /> },
  { href: "/partners", labelKey: "nav.partners", icon: <IconHandshake /> },
  { href: "/renewals", labelKey: "nav.renewals", icon: <IconClock /> },
  { href: "/subscriptions", labelKey: "nav.subscriptions", icon: <IconRefresh /> },
  { href: "/virtual-offices", labelKey: "nav.virtual_offices", icon: <IconKey /> },
  { href: "/permits", labelKey: "nav.permits", icon: <IconBadge /> },
];

export function OpsSidebar({
  userName,
  userEmail,
  isOwner,
}: {
  userName: string;
  userEmail: string;
  isOwner: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { t } = useT();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-[240px] bg-[var(--surface-muted)] border-r border-[var(--border)] p-4 flex flex-col gap-4 sticky top-[66px] h-[calc(100vh-66px)]">
      <nav className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between px-2 pb-2">
          <div className="text-[10px] tracking-widest text-[var(--muted)] uppercase font-semibold">
            {t("nav.operations")}
          </div>
          <LanguageToggle />
        </div>
        {nav.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] font-medium transition-colors ${
                active
                  ? "bg-brand text-white shadow-[0_6px_16px_-8px_rgba(20,138,124,0.6)]"
                  : "text-[var(--text)] hover:bg-white/60"
              }`}
            >
              <span className={`w-4 h-4 ${active ? "text-white" : "text-[var(--muted)]"}`}>{item.icon}</span>
              {t(item.labelKey)}
            </Link>
          );
        })}
        {isOwner && (
          <>
            <div className="text-[10px] tracking-widest text-[var(--muted)] uppercase font-semibold px-2 pt-4 pb-2">
              {t("nav.admin")}
            </div>
            <Link
              href="/admin"
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] font-medium transition-colors ${
                pathname.startsWith("/admin")
                  ? "bg-brand text-white shadow-[0_6px_16px_-8px_rgba(20,138,124,0.6)]"
                  : "text-[var(--text)] hover:bg-white/60"
              }`}
            >
              <span className={`w-4 h-4 ${pathname.startsWith("/admin") ? "text-white" : "text-[var(--muted)]"}`}><IconCog /></span>
              {t("nav.admin_panel")}
            </Link>
          </>
        )}
      </nav>

      <div className="mt-auto pt-3 border-t border-[var(--border)] flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-brand-soft text-brand-dark flex items-center justify-center text-[11px] font-semibold shrink-0">
          {userName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "??"}
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-ink truncate">{userName}</div>
          <div className="text-[11px] text-[var(--muted)] truncate">{userEmail}</div>
        </div>
        <button onClick={signOut} className="ml-auto text-[var(--muted)] hover:text-ink text-xs" title={t("nav.sign_out")}>
          <IconSignOut />
        </button>
      </div>
    </aside>
  );
}

function IconHome() { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 12l9-9 9 9M5 10v10h14V10" /></svg>); }
function IconUsers() { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="4" /><path d="M2 21c0-4 3-6 7-6s7 2 7 6" /><circle cx="17" cy="6" r="3" /><path d="M17 12c3 0 5 1.5 5 5" /></svg>); }
function IconBuilding() { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01M10 21v-4h4v4" /></svg>); }
function IconFolder() { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>); }
function IconHandshake() { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 12l4-4 4 4-2 2 4 4 6-6-8-8H5z" /></svg>); }
function IconClock() { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>); }
function IconKey() { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="8" cy="15" r="4" /><path d="M10.85 12.15L20 3M18 5l2 2M15 8l2 2" /></svg>); }
function IconBadge() { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="4" width="16" height="16" rx="2" /><circle cx="12" cy="10" r="2.5" /><path d="M8 17c1-2 3-3 4-3s3 1 4 3" /></svg>); }
function IconRefresh() { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12a8 8 0 0 1 14-5.3L20 4M20 4v5h-5" /><path d="M20 12a8 8 0 0 1-14 5.3L4 20M4 20v-5h5" /></svg>); }
function IconCog() { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.8a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.4a7 7 0 0 0-2 1.2L5.1 5.8l-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-.8a7 7 0 0 0 2 1.2L10 21h4l.5-2.4a7 7 0 0 0 2-1.2l2.4.8 2-3.4-2-1.6a7 7 0 0 0 .1-1.2z" /></svg>); }
function IconSignOut() { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l-5-5 5-5" /><path d="M5 12h11" /></svg>); }
