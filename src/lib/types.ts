// Hand-typed shapes matching the initial schema.
// Once you run `supabase gen types typescript` these will be replaced by the
// generated types in database.types.ts — until then, this keeps the app typed.

export type Role = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: string[];
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

export type AppUser = {
  id: string;
  email: string;
  full_name: string;
  role_id: string;
  phone: string | null;
  is_active: boolean;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
  role?: Role;
};

export type ServiceCategory = {
  id: string;
  code: string;
  name: string;
  sort_order: number;
};

export type PreferredChannel = "whatsapp" | "email";

export type Client = {
  id: string;
  code: string;
  full_name: string;
  nationality: string | null;
  passport_no: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  phone: string | null;
  email: string | null;
  preferred_channel: PreferredChannel;
  introduced_by_partner_id: string | null;
  drive_folder_url: string | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  introduced_by?: { id: string; name: string; code: string } | null;
};

export type Company = {
  id: string;
  code: string;
  name: string;
  nib: string | null;
  incorporation_date: string | null;
  address: string | null;
  drive_folder_url: string | null;
  notes: string | null;
  introduced_by_partner_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  introduced_by?: { id: string; name: string; code: string } | null;
};

/** Company roles are stored in the `company_roles` table, editable from
 *  the admin panel. See /admin/company-roles. Reads happen per-page. */

export type VirtualOfficeTier = "silver" | "gold" | "platinum";
export type VirtualOfficeStatus = "active" | "expired" | "terminated";

export type VirtualOffice = {
  id: string;
  company_id: string;
  tier: VirtualOfficeTier;
  term_months: number;
  start_date: string | null;
  end_date: string;
  pic_name: string | null;
  pic_phone: string | null;
  status: VirtualOfficeStatus;
  notes: string | null;
  drive_folder_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CaseStatus = "new" | "in_progress" | "done" | "delivered";
export type CasePriority = "low" | "normal" | "high" | "urgent";
export type RecurringInterval = "quarterly" | "annually";
export type PartnerRole = "referrer" | "agent";

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  new: "New",
  in_progress: "In progress",
  done: "Ready",
  delivered: "Delivered",
};

export const NEXT_STATUS: Record<CaseStatus, CaseStatus | null> = {
  new: "in_progress",
  in_progress: "done",
  done: "delivered",
  delivered: null,
};

export const CASE_PRIORITY_LABELS: Record<CasePriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export type PartnerType = "referrer" | "agent" | "both";

export type Partner = {
  id: string;
  code: string;
  name: string;
  type: PartnerType;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ServiceScheduleKind = "one_off" | "annual_fixed" | "quarterly_fixed";

export type ServiceType = {
  id: string;
  code: string | null;
  name: string;
  category_id: string;
  duration: string | null;
  description: string | null;
  schedule_kind: ServiceScheduleKind;
  annual_month: number | null;
  annual_day: number | null;
  quarterly_day: number | null;
  quarterly_months: number[] | null;
  validity_amount: number | null;
  validity_unit: "days" | "months" | "years" | null;
  has_deliverable: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  category?: ServiceCategory;
};

export const DEFAULT_QUARTERLY_MONTHS = [1, 4, 7, 10];
