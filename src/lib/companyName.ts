/**
 * Every Indonesian PT (Perseroan Terbatas) name in the system carries the
 * "PT " prefix. Ops types the entity's name in different ways though —
 * sometimes with "PT" already, sometimes just the trading name — and the
 * inconsistency shows up as duplicate rows and mismatched sort order.
 *
 * Normalize on the way in: strip surrounding whitespace, and prepend "PT "
 * when the name doesn't already start with a PT-token. The token is
 * matched case-insensitively and can be followed by a space or a period
 * ("PT.") since both spellings show up in the wild — but the prefix we
 * write back is always the canonical "PT ".
 */
export function ensurePtPrefix(name: string): string {
  const trimmed = name.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  // Already carries a PT prefix (case-insensitive, optionally with a dot).
  if (/^pt\.?\s+/i.test(trimmed)) {
    // Canonicalize the prefix casing/spacing: uppercase "PT", one space.
    return trimmed.replace(/^pt\.?\s+/i, "PT ");
  }
  return `PT ${trimmed}`;
}
