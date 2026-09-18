"use client";

import { useEffect, useRef } from "react";
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
