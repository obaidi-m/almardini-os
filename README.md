# Almardini Ops — Admin Panel

Next.js 14 + Supabase + Tailwind. First real slice of the plan in [`../PLAN.md`](../PLAN.md):
the **admin panel** — users & roles, and the service catalog.

## What this contains (v0.1)

| Feature | Where |
|---|---|
| Login (email + password) | `/login` |
| Admin overview | `/admin` |
| Users & roles — invite, edit, deactivate | `/admin/users` |
| Service catalog — add, edit, archive services with prices | `/admin/services` |
| Row-Level Security (owner-only writes) | `supabase/migrations/001_initial_schema.sql` |
| Activity log auto-populated on every write | same migration |

## First-time setup

You need three accounts (all free tier): **Supabase**, **Vercel**, and **GitHub** (later, for deploying). We only need Supabase for the local run.

### 1. Install Node.js 20+

Download from [nodejs.org](https://nodejs.org). Verify:

```bash
node -v
```

### 2. Install dependencies

From this folder:

```bash
npm install
```

### 3. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Name it `almardini-ops-dev`. Set a strong DB password (save it in a password manager).
3. Region: **Singapore** (closest to Indonesia).
4. Wait ~2 minutes for provisioning.

### 4. Run the database migration

1. In your Supabase project → **SQL Editor** → **New query**
2. Open [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql), copy everything, paste, click **Run**.
3. You should see "Success. No rows returned." Six roles are now seeded, and the empty tables exist.

### 5. Create the first owner user

The very first user has to be created manually because we don't yet have anyone to invite them.

1. In Supabase → **Authentication** → **Add user** → **Create new user**
2. Enter your email + a temporary password → **Create user**. **Copy the user's UUID** from the row that appears.
3. Go back to **SQL Editor** → **New query**, and run (replace placeholders):

```sql
insert into users (id, email, full_name, role_id, is_active)
select 'PASTE-YOUR-UUID-HERE',
       'you@almardini.id',
       'Your Full Name',
       (select id from roles where code = 'owner'),
       true;
```

### 6. Configure environment variables

1. Copy `.env.local.example` to `.env.local`:

   ```bash
   cp .env.local.example .env.local
   ```

2. In Supabase → **Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

   ⚠️ Never commit `.env.local` to Git. The `.gitignore` already excludes it.

### 7. Run it

```bash
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login). Sign in with the email + password you set in step 5.

You should land on the admin overview.

## What to try

1. **Invite a user** on `/admin/users` — they get a Supabase email invite with a link to set their password. Assign them a role.
2. **Add a service** on `/admin/services` — Investor KITAS at Rp 18,000,000 for example. Edit the price. Archive it. It shows up in the "Immigration" category.
3. **Sign in as the invited user** in an incognito window — they get redirected away from `/admin` because only owners see the admin panel.

## Deploying to Vercel later

When you're ready:

1. Push this folder to GitHub as a new repo.
2. On Vercel, click **New Project** → import the repo.
3. Add the three env vars from `.env.local` in Vercel's project settings.
4. Deploy. You get a URL like `almardini-ops.vercel.app`. Later, add `ops.almardini.id` as a custom domain.

## Project layout

```
almardini-ops/
├── PLAN.md ................. lives one level up (parent folder)
├── src/
│   ├── app/
│   │   ├── layout.tsx ...... root layout
│   │   ├── page.tsx ........ redirects to /admin
│   │   ├── login/
│   │   │   └── page.tsx .... sign-in page
│   │   └── admin/
│   │       ├── layout.tsx .. branded shell (top bar + sidebar)
│   │       ├── page.tsx .... overview
│   │       ├── users/
│   │       │   ├── page.tsx
│   │       │   ├── actions.ts .... invite / update / deactivate
│   │       │   ├── InviteUserForm.tsx
│   │       │   └── UserRow.tsx
│   │       └── services/
│   │           ├── page.tsx
│   │           ├── actions.ts .... create / update / archive
│   │           ├── NewServiceForm.tsx
│   │           └── ServiceRow.tsx
│   ├── components/admin/
│   │   ├── TopBanner.tsx ... teal branded banner
│   │   └── Sidebar.tsx ..... nav + user block
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts ... browser Supabase client
│   │   │   └── server.ts ... server Supabase client
│   │   └── types.ts ........ TS shapes for schema
│   └── middleware.ts ....... protects /admin routes
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql
```

## Next up in the plan

Once you've clicked around the admin panel and the founder has approved:
- Phase 1 — Clients & referrers (with data migration from your existing sources)
- Phase 2 — Pricing engine (client + referrer overrides on top of these catalog prices)
- Phase 3 — Cases + checklist templates
