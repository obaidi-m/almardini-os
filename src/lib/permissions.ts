/**
 * The catalog of permissions the admin can toggle per role.
 *
 * Permission strings follow the pattern `{resource}.{action}[.scope]`, e.g.
 *   clients.read           → can see any client
 *   cases.update.own       → can edit cases assigned to them
 *   payments.*             → any payment action
 *
 * The wildcard `*` alone in a role grants everything (used only by "owner").
 */

export type PermissionGroup = {
  key: string;
  label: string;
  description: string;
  permissions: {
    code: string;
    label: string;
    hint?: string;
  }[];
};

export const PERMISSION_CATALOG: PermissionGroup[] = [
  {
    key: "clients",
    label: "Clients",
    description: "Everything about the people we serve.",
    permissions: [
      { code: "clients.read",   label: "See all clients" },
      { code: "clients.create", label: "Add new clients" },
      { code: "clients.update", label: "Edit client details" },
      { code: "clients.delete", label: "Archive clients", hint: "Never a hard delete." },
    ],
  },
  {
    key: "cases",
    label: "Cases",
    description: "The visa applications, PT PMA formations, and reporting jobs in motion.",
    permissions: [
      { code: "cases.read.all",   label: "See all cases" },
      { code: "cases.read.own",   label: "See only cases assigned to them" },
      { code: "cases.create",     label: "Open new cases" },
      { code: "cases.update.all", label: "Update any case" },
      { code: "cases.update.own", label: "Update cases assigned to them" },
      { code: "cases.delete",     label: "Archive cases" },
    ],
  },
  {
    key: "documents",
    label: "Documents",
    description: "Files attached to cases — from and to clients and government.",
    permissions: [
      { code: "documents.read",   label: "View documents" },
      { code: "documents.upload", label: "Upload documents" },
      { code: "documents.delete", label: "Archive documents" },
    ],
  },
  {
    key: "payments",
    label: "Payments & invoices",
    description: "What the client owes us and what we owe referrers.",
    permissions: [
      { code: "payments.read",   label: "See payments and invoices" },
      { code: "payments.record", label: "Record incoming payments" },
      { code: "payments.invoice", label: "Create and send invoices" },
      { code: "payments.delete", label: "Void invoices or payments" },
    ],
  },
  {
    key: "referrers",
    label: "Referrers",
    description: "Partners, agencies, and individuals who bring us clients.",
    permissions: [
      { code: "referrers.read",   label: "See referrer directory" },
      { code: "referrers.create", label: "Add new referrers" },
      { code: "referrers.update", label: "Edit referrer details" },
      { code: "referrers.delete", label: "Archive referrers" },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    description: "Dashboards and analytics.",
    permissions: [
      { code: "reports.view",    label: "Open the reports section" },
      { code: "reports.finance", label: "See financial reports" },
    ],
  },
  {
    key: "admin",
    label: "Admin panel",
    description: "System configuration — grant carefully.",
    permissions: [
      { code: "users.invite",   label: "Invite new team members" },
      { code: "users.update",   label: "Edit or deactivate team members" },
      { code: "roles.manage",   label: "Create and edit roles" },
      { code: "services.manage", label: "Edit the service catalog and prices" },
    ],
  },
];

/**
 * Roles that cannot be deleted; users can still edit their permissions
 * (except owner, which is always full access).
 */
export const SYSTEM_ROLE_CODES = ["owner", "ops_lead"];

/** Check whether a permission list grants a given permission. */
export function hasPermission(perms: string[] | null | undefined, code: string): boolean {
  if (!perms || perms.length === 0) return false;
  if (perms.includes("*")) return true;
  if (perms.includes(code)) return true;
  // wildcard for the resource, e.g. "clients.*"
  const [resource] = code.split(".");
  return perms.includes(`${resource}.*`);
}
