import type { EntityService, EntityServiceStatus } from "@/lib/types";

// The `status` column on entity_services stores manual/lifecycle state:
//   active      — the current live row (default)
//   expired     — a historical snapshot left behind after a renewal
//   terminated  — client cancelled
//   paused      — temporarily inactive
//
// "Active vs expired by date" is NOT a stored decision — it's just whether
// today has passed expires_date. Deriving it here keeps the pill and the
// date math from ever contradicting each other.
export function effectiveStatus(
  row: Pick<EntityService, "status" | "expires_date">,
  today: string = new Date().toISOString().slice(0, 10),
): EntityServiceStatus {
  if (row.status === "terminated") return "terminated";
  if (row.status === "paused") return "paused";
  if (row.expires_date && row.expires_date < today) return "expired";
  return "active";
}
