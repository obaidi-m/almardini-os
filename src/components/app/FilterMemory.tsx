"use client";

import { useEffect } from "react";
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

  useEffect(() => {
    if (!pathname) return;
    const key = keyFor(pathname);
    if (!key) return;

    const current = searchParams?.toString() ?? "";
    try {
      if (current) {
        sessionStorage.setItem(key, current);
      } else {
        const saved = sessionStorage.getItem(key);
        if (saved) router.replace(`${pathname}?${saved}`);
      }
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
