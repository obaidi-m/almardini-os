"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Paths whose querystring (filters, sort, tabs) is remembered for the current
// browser tab. sessionStorage is deliberate: it survives page-to-page nav and
// full reloads within the tab, but a new tab or a fresh login starts clean.
const REMEMBERED_PATHS = new Set<string>([
  "/cases",
  "/companies",
  "/clients",
  "/permits",
  "/renewals",
  "/subscriptions",
  "/partners",
  "/virtual-offices",
  "/search",
  "/admin/feedback",
  "/admin/activity",
  "/admin/services",
]);

const PREFIX = "filters:";

function keyFor(pathname: string): string | null {
  return REMEMBERED_PATHS.has(pathname) ? PREFIX + pathname : null;
}

export function FilterMemory() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    const key = keyFor(pathname);
    const prev = lastPathRef.current;
    lastPathRef.current = pathname;

    if (!key) return;
    const current = searchParams?.toString() ?? "";
    const arriving = prev !== pathname;

    try {
      if (arriving && !current) {
        // First visit to this page in this tab motion — restore last query
        // if we have one saved.
        const saved = sessionStorage.getItem(key);
        if (saved) router.replace(`${pathname}?${saved}`);
        return;
      }
      // Already on the page: whatever the user does — set a filter or
      // clear one — becomes the new remembered state. Storing the empty
      // string means a subsequent visit starts clean, so "All" / "Reset"
      // links that go to the bare path don't get overridden.
      sessionStorage.setItem(key, current);
    } catch {
      // sessionStorage can throw in privacy modes — ignore.
    }
  }, [pathname, searchParams, router]);

  return null;
}

/** Drop-in <Link> that, at click time, redirects to the saved query for
 *  its href — so the sidebar takes you straight to your filtered list with
 *  no visible "All → filtered" flash. Falls back to the plain href on
 *  cmd/ctrl-click (new tab) and when nothing is saved. */
export function RememberedLink({
  href,
  children,
  className,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const router = useRouter();
  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        // Let modifier-clicks (open in new tab/window) use the plain href
        // so the new tab gets a clean list rather than one filtered by
        // this tab's private sessionStorage.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        try {
          const saved = sessionStorage.getItem(PREFIX + href);
          if (saved) {
            e.preventDefault();
            router.push(`${href}?${saved}`);
          }
        } catch {
          // ignore
        }
      }}
    >
      {children}
    </Link>
  );
}

/** Wipe all remembered filters — call on sign-out and on the login page. */
export function clearFilterMemory() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) sessionStorage.removeItem(k);
  } catch {
    // ignore
  }
}
