"use client";
import { useEffect } from "react";

/** Global click-outside handler that closes any open <details> element
 *  once the user clicks anywhere that isn't inside it. Applies to every
 *  sort/filter dropdown built with <details><summary>...</summary></details>
 *  so we don't have to wire the same effect into each page.
 *
 *  Mounted once at the root layout — a single listener handles them all. */
export function DetailsAutoClose() {
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node | null;
      // Close any open <details> that does not contain the click target.
      // Native <details> closes on second summary click; this only closes
      // the ones the user has moved on from.
      const open = document.querySelectorAll<HTMLDetailsElement>("details[open]");
      for (const el of open) {
        if (target && el.contains(target)) continue;
        el.open = false;
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const open = document.querySelectorAll<HTMLDetailsElement>("details[open]");
      for (const el of open) el.open = false;
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  return null;
}
