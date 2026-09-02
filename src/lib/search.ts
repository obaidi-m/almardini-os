// Build a PostgREST `.or(...)` filter for a case-insensitive substring search
// across multiple columns, safely escaping the user's input.
//
// PostgREST's `or` filter uses `,` as a separator and `(` `)` for grouping.
// It also treats `%` `_` `*` as `ilike` wildcards. If we splice raw user text
// into the filter, characters like `,` `(` `"` break the parser and the user
// gets wrong results (or a 400). Wrapping the value in double quotes tells
// PostgREST "this whole thing is one value" — we just have to escape `"` and
// `\` that would end the quoted section early, and `%` `_` `*` if we want
// literal matching (we do — users don't know ilike syntax).

export function escapeIlike(term: string): string {
  return term
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/\*/g, "\\*");
}

export function buildIlikeOr(fields: readonly string[], term: string): string {
  const value = `"%${escapeIlike(term)}%"`;
  return fields.map((f) => `${f}.ilike.${value}`).join(",");
}
