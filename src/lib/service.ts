/** How a service is rendered wherever it's shown next to a case:
 *  "CODE — Name" when we have the code, plain name otherwise.
 *  One place so every list/detail stays in lockstep. */
export function serviceLabel(s: { code?: string | null; name?: string | null } | null | undefined): string {
  if (!s) return "";
  const name = s.name ?? "";
  return s.code ? `${s.code} — ${name}` : name;
}
