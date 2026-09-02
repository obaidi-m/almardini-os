/**
 * UI translations. English is the source of truth; Indonesian mirrors it.
 * Only interface strings live here — user-entered data (client names,
 * notes, case text, etc.) is never translated.
 *
 * To add a new key: add it to `en` first, then to `id`. TypeScript will
 * force both dictionaries to stay in sync via the `Messages` type.
 */

export type Locale = "en" | "id";

const en = {
  // App shell
  "app.tagline": "Almardini Group Indonesia",
  "nav.dashboard": "Dashboard",
  "nav.clients": "Clients",
  "nav.companies": "Companies",
  "nav.cases": "Cases",
  "nav.partners": "Partners",
  "nav.renewals": "Renewals",
  "nav.admin_panel": "Admin panel",
  "nav.operations": "Operations",
  "nav.admin": "Admin",
  "nav.search": "Search…",
  "nav.sign_out": "Sign out",

  // Common actions
  "action.new": "New",
  "action.edit": "Edit",
  "action.save": "Save",
  "action.save_changes": "Save changes",
  "action.cancel": "Cancel",
  "action.archive": "Archive",
  "action.restore": "Restore",
  "action.delete": "Delete",
  "action.open": "Open",
  "action.back": "Back",
  "action.search": "Search",
  "action.show_archived": "Show archived",
  "action.hide_archived": "Hide archived",

  // Page titles
  "page.dashboard.greeting": "Good day, {name}",
  "page.dashboard.subtitle": "Here's what's happening across the office.",
  "page.clients.title": "Clients",
  "page.clients.subtitle": "People we do work for.",
  "page.companies.title": "Companies",
  "page.companies.subtitle": "PT PMA and other legal entities we manage.",
  "page.cases.title": "Cases",
  "page.cases.subtitle": "Every action recorded against a client.",
  "page.partners.title": "Partners",
  "page.partners.subtitle": "Referrers and agents we work with.",
  "page.renewals.title": "Renewals",
  "page.renewals.subtitle": "Passports, case-level expiries, and company licenses coming due.",

  // Section headers
  "section.identity": "Identity",
  "section.passport": "Passport",
  "section.contact": "Contact",
  "section.address": "Address",
  "section.relationship": "Relationship",
  "section.renewals": "Renewals",
  "section.files": "Files",
  "section.notes": "Notes",
  "section.assignment": "Assignment",
  "section.partner": "Partner (if any)",
  "section.linked_clients": "Linked clients",
  "section.linked_companies": "Linked companies",
  "section.passport_history": "Passport history",
  "section.cases": "Cases",
  "section.timeline": "Timeline",
  "section.quick_actions": "Quick actions",
  "section.my_cases": "My cases",
  "section.ready_to_deliver": "Ready to deliver",
  "section.recent_activity": "Recent activity",

  // Fields
  "field.full_name": "Full name",
  "field.nationality": "Nationality",
  "field.date_of_birth": "Date of birth",
  "field.place_of_birth": "Place of birth",
  "field.passport_no": "Passport no.",
  "field.passport_expiry": "Passport expiry",
  "field.phone": "Phone",
  "field.email": "Email",
  "field.preferred_channel": "Preferred channel",
  "field.introduced_by": "Introduced by",
  "field.created": "Created",
  "field.onedrive_folder": "OneDrive folder",
  "field.notes": "Notes",
  "field.name": "Name",
  "field.type": "Type",
  "field.contact_person": "Contact person",
  "field.company_name": "Company name",
  "field.nib": "NIB",
  "field.incorporation_date": "Incorporation date",
  "field.address": "Address",
  "field.license_expiry": "License expiry",
  "field.client": "Client",
  "field.company": "Company",
  "field.service": "Service",
  "field.assignee": "Assignee",
  "field.priority": "Priority",
  "field.deadline": "Deadline",
  "field.expires": "Expires",
  "field.recurring": "Recurring",
  "field.status": "Status",

  // OneDrive
  "onedrive.open": "Open in OneDrive",

  // Language
  "language.english": "English",
  "language.indonesian": "Indonesian",
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

const id: Messages = {
  "app.tagline": "Almardini Grup Indonesia",
  "nav.dashboard": "Beranda",
  "nav.clients": "Klien",
  "nav.companies": "Perusahaan",
  "nav.cases": "Kasus",
  "nav.partners": "Mitra",
  "nav.renewals": "Perpanjangan",
  "nav.admin_panel": "Panel admin",
  "nav.operations": "Operasional",
  "nav.admin": "Admin",
  "nav.search": "Cari…",
  "nav.sign_out": "Keluar",

  "action.new": "Baru",
  "action.edit": "Ubah",
  "action.save": "Simpan",
  "action.save_changes": "Simpan perubahan",
  "action.cancel": "Batal",
  "action.archive": "Arsipkan",
  "action.restore": "Pulihkan",
  "action.delete": "Hapus",
  "action.open": "Buka",
  "action.back": "Kembali",
  "action.search": "Cari",
  "action.show_archived": "Tampilkan arsip",
  "action.hide_archived": "Sembunyikan arsip",

  "page.dashboard.greeting": "Selamat siang, {name}",
  "page.dashboard.subtitle": "Berikut yang terjadi di kantor hari ini.",
  "page.clients.title": "Klien",
  "page.clients.subtitle": "Orang-orang yang kami layani.",
  "page.companies.title": "Perusahaan",
  "page.companies.subtitle": "PT PMA dan badan hukum lain yang kami kelola.",
  "page.cases.title": "Kasus",
  "page.cases.subtitle": "Setiap tindakan yang dicatat untuk klien.",
  "page.partners.title": "Mitra",
  "page.partners.subtitle": "Pemberi referensi dan agen yang bekerja sama.",
  "page.renewals.title": "Perpanjangan",
  "page.renewals.subtitle": "Paspor, kedaluwarsa kasus, dan izin perusahaan yang akan berakhir.",

  "section.identity": "Identitas",
  "section.passport": "Paspor",
  "section.contact": "Kontak",
  "section.address": "Alamat",
  "section.relationship": "Relasi",
  "section.renewals": "Perpanjangan",
  "section.files": "Berkas",
  "section.notes": "Catatan",
  "section.assignment": "Penugasan",
  "section.partner": "Mitra (jika ada)",
  "section.linked_clients": "Klien terkait",
  "section.linked_companies": "Perusahaan terkait",
  "section.passport_history": "Riwayat paspor",
  "section.cases": "Kasus",
  "section.timeline": "Riwayat aktivitas",
  "section.quick_actions": "Aksi cepat",
  "section.my_cases": "Kasus saya",
  "section.ready_to_deliver": "Siap diserahkan",
  "section.recent_activity": "Aktivitas terbaru",

  "field.full_name": "Nama lengkap",
  "field.nationality": "Kewarganegaraan",
  "field.date_of_birth": "Tanggal lahir",
  "field.place_of_birth": "Tempat lahir",
  "field.passport_no": "No. paspor",
  "field.passport_expiry": "Kedaluwarsa paspor",
  "field.phone": "Telepon",
  "field.email": "Email",
  "field.preferred_channel": "Kanal utama",
  "field.introduced_by": "Diperkenalkan oleh",
  "field.created": "Dibuat",
  "field.onedrive_folder": "Folder OneDrive",
  "field.notes": "Catatan",
  "field.name": "Nama",
  "field.type": "Tipe",
  "field.contact_person": "Kontak person",
  "field.company_name": "Nama perusahaan",
  "field.nib": "NIB",
  "field.incorporation_date": "Tanggal pendirian",
  "field.address": "Alamat",
  "field.license_expiry": "Kedaluwarsa izin",
  "field.client": "Klien",
  "field.company": "Perusahaan",
  "field.service": "Layanan",
  "field.assignee": "Penanggung jawab",
  "field.priority": "Prioritas",
  "field.deadline": "Tenggat",
  "field.expires": "Kedaluwarsa",
  "field.recurring": "Berulang",
  "field.status": "Status",

  "onedrive.open": "Buka di OneDrive",

  "language.english": "Inggris",
  "language.indonesian": "Indonesia",
};

const dictionaries: Record<Locale, Messages> = { en, id };

/** Look up a translation with optional {placeholder} substitution. */
export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  const dict = dictionaries[locale] ?? dictionaries.en;
  let out = dict[key] ?? en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{\\s*${k}\\s*\\}`, "g"), String(v));
    }
  }
  return out;
}
