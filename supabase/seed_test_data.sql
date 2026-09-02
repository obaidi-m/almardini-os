-- =========================================================================
-- Almardini Ops — TEST DATA SEED
--
-- Inserts:
--   • 50 companies (PT PMA-style names)
--   • 100 partners (referrers / agents / both)
--   • 100 clients (with random nationality, passport, DOB, phone, email)
--   • ~150 client<->company links (director / commissioner / etc.)
--   • 100 cases across all statuses + priorities, some with expiry dates
--   • ~2-3 case updates per case (mix of plain notes + status changes)
--   • Bootstraps a "Test" category + 5 service types if none exist yet.
--
-- Safe to paste into the Supabase SQL editor. NOT idempotent — running it
-- twice doubles the data. To wipe, see the DELETE block at the bottom
-- (commented out; uncomment carefully).
--
-- Runs as the service role, so activity_log rows will show a NULL actor.
-- =========================================================================

begin;

-- -------------------------------------------------------------------------
-- 0. Bootstrap service catalog if empty
-- -------------------------------------------------------------------------
do $seed$
declare
  cat_id uuid;
begin
  if not exists (select 1 from public.service_categories) then
    insert into public.service_categories (code, name, sort_order)
    values ('test', 'Test services', 10)
    returning id into cat_id;
  else
    select id into cat_id from public.service_categories order by sort_order limit 1;
  end if;

  if not exists (select 1 from public.service_types) then
    insert into public.service_types (code, name, name_id, category_id, has_deliverable, delivery_template_en, delivery_template_id, is_active, sort_order)
    values
      ('KITAS-INV', 'Investor KITAS',       'KITAS Investor',       cat_id, true,  'Hi {{client_name}}, your {{service}} is ready for collection.',   'Halo {{client_name}}, {{service}} Anda sudah siap diambil.',   10),
      ('KITAS-WRK', 'Working KITAS',        'KITAS Kerja',          cat_id, true,  'Hi {{client_name}}, your {{service}} is ready for collection.',   'Halo {{client_name}}, {{service}} Anda sudah siap diambil.',   20),
      ('PTPMA',     'PT PMA setup',         'Pendirian PT PMA',     cat_id, true,  'Hi {{client_name}}, your {{service}} is complete.',              'Halo {{client_name}}, {{service}} Anda sudah selesai.',        30),
      ('LKPM',      'LKPM quarterly filing','LKPM triwulan',        cat_id, false, 'Hi {{client_name}}, this quarter''s LKPM has been submitted.',   'Halo {{client_name}}, LKPM triwulan ini sudah diserahkan.',    40),
      ('TAX-MTH',   'Monthly tax filing',   'Pajak bulanan',        cat_id, false, 'Hi {{client_name}}, this month''s tax report has been filed.',   'Halo {{client_name}}, laporan pajak bulan ini sudah dikirim.', 50);
  end if;
end $seed$;

-- -------------------------------------------------------------------------
-- 1. 100 partners
-- -------------------------------------------------------------------------
insert into public.partners (name, type, contact_person, phone, email, notes)
select
  (array['Bali Ventures','Ubud Legal','Canggu Consulting','Sanur Advisors','Seminyak Partners','Jakarta Bridge','Kuta Referrals','Denpasar Legal','Nusa Agency','Uluwatu Advisers'])[1 + (i % 10)]
    || ' ' || (array['Group','Consultants','Partners','Agency','Bureau','Advisory','Services','Office','Chambers','Collective'])[1 + ((i * 3) % 10)],
  (array['referrer','agent','both'])[1 + (i % 3)],
  (array['Andi','Budi','Citra','Dewi','Eka','Fajar','Gita','Hendra','Indah','Joko'])[1 + (i % 10)]
    || ' ' || (array['Wijaya','Susanto','Kurniawan','Pratama','Suryadi','Halim','Rahardjo','Setiawan','Nugraha','Santoso'])[1 + ((i * 7) % 10)],
  '+628' || lpad((100000000 + (i * 137) % 900000000)::text, 9, '0'),
  'partner' || i || '@example.com',
  case when i % 4 = 0 then 'Long-time referrer, sends 2-3 clients / month.' else null end
from generate_series(1, 100) as i;

-- -------------------------------------------------------------------------
-- 2. 50 companies (PT PMA-style)
-- -------------------------------------------------------------------------
insert into public.companies (name, nib, incorporation_date, address, license_expires_at, notes)
select
  'PT ' || (array['Bumi','Cahaya','Dharma','Karya','Sinar','Bintang','Mentari','Nusa','Pelangi','Sakti'])[1 + (i % 10)]
    || ' ' || (array['Bali','Sejahtera','Abadi','Mandiri','Utama','Prima','Global','Persada','Makmur','Selaras'])[1 + ((i * 3) % 10)],
  lpad((1000000000000 + i * 137)::text, 13, '0'),
  (current_date - ((300 + (i * 11) % 3600) || ' days')::interval)::date,
  (array['Jl. Sunset Road No. ','Jl. Petitenget No. ','Jl. Batu Bolong No. ','Jl. Raya Ubud No. ','Jl. Danau Tamblingan No. '])[1 + (i % 5)]
    || (10 + i)::text || ', Bali',
  (current_date + ((30 + (i * 7) % 500) || ' days')::interval)::date,
  case when i % 5 = 0 then 'Priority account.' else null end
from generate_series(1, 50) as i;

-- -------------------------------------------------------------------------
-- 3. 100 clients (random nationality, passport, phone, DOB, expiry)
-- -------------------------------------------------------------------------
insert into public.clients (
  full_name, nationality, passport_no, passport_expires_at,
  date_of_birth, place_of_birth, phone, email, preferred_channel,
  introduced_by_partner_id, notes
)
select
  (array['James','Emma','Liam','Olivia','Noah','Sophia','William','Ava','Ethan','Isabella',
         'Mason','Mia','Logan','Charlotte','Lucas','Amelia','Jacob','Harper','Benjamin','Evelyn'])[1 + (i % 20)]
    || ' ' ||
  (array['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez',
         'Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin'])[1 + ((i * 3) % 20)],
  (array['British','American','Australian','Dutch','German','French','Italian','Russian','Japanese','South Korean',
         'Chinese','Indonesian','Malaysian','Singaporean','Filipino','Indian','Turkish','Brazilian','Canadian','Swedish'])[1 + (i % 20)],
  chr(65 + (i % 26)) || lpad(((i * 7919) % 90000000 + 10000000)::text, 8, '0'),
  -- passport expiry: mix of overdue, next 30/60/90 days, and further out
  (current_date + ((-30 + (i * 17) % 400) || ' days')::interval)::date,
  (current_date - ((7000 + (i * 53) % 15000) || ' days')::interval)::date,
  (array['London, UK','New York, USA','Sydney, AU','Amsterdam, NL','Berlin, DE',
         'Paris, FR','Rome, IT','Moscow, RU','Tokyo, JP','Seoul, KR',
         'Shanghai, CN','Jakarta, ID','Kuala Lumpur, MY','Singapore, SG','Manila, PH'])[1 + (i % 15)],
  '+' || (array['44','1','61','31','49','33','39','7','81','82'])[1 + (i % 10)]
    || lpad((10000000 + (i * 977) % 90000000)::text, 8, '0'),
  'client' || i || '@example.com',
  case when i % 3 = 0 then 'email' else 'whatsapp' end,
  -- link ~80% of clients to a random partner (offset ordering keeps it non-clustered)
  case when i % 5 <> 0 then
    (select id from public.partners order by created_at desc offset ((i * 13) % 100) limit 1)
    else null end,
  case when i % 6 = 0 then 'Prefers WhatsApp voice notes.' else null end
from generate_series(1, 100) as i;

-- -------------------------------------------------------------------------
-- 4. Client <-> Company links (~150, using real company_roles)
-- -------------------------------------------------------------------------
do $links$
declare
  client_ids uuid[] := array(select id from public.clients order by created_at desc limit 100);
  company_ids uuid[] := array(select id from public.companies order by created_at desc limit 50);
  role_codes text[] := array(select code from public.company_roles order by sort_order);
  i int;
  cli uuid;
  cmp uuid;
  role text;
begin
  if array_length(role_codes, 1) is null then
    raise notice 'No company_roles found — skipping client_companies links.';
    return;
  end if;
  for i in 1..150 loop
    cli := client_ids[1 + (i * 3) % array_length(client_ids, 1)];
    cmp := company_ids[1 + (i * 7) % array_length(company_ids, 1)];
    role := role_codes[1 + (i % array_length(role_codes, 1))];
    insert into public.client_companies (client_id, company_id, role)
    values (cli, cmp, role)
    on conflict do nothing;
  end loop;
end $links$;

-- -------------------------------------------------------------------------
-- Helper (defined BEFORE the cases DO block so the PERFORM below finds it)
-- -------------------------------------------------------------------------
create or replace function seed_case_updates(case_ids uuid[]) returns void
language plpgsql as $fn$
declare
  case_id uuid;
  cur_status text;
  notes text[] := array[
    'Received documents from client.',
    'Submitted application to immigration office.',
    'Waiting on payment confirmation.',
    'Client sent updated passport photo.',
    'Received clarification request from authority.',
    'Scheduled photo appointment for next Tuesday.',
    'Filed quarterly report; awaiting acknowledgement.',
    'Draft agreement sent to client for review.',
    'Confirmed appointment with notary.',
    'Compiled supporting documents for submission.'
  ];
  n int;
begin
  foreach case_id in array case_ids loop
    select status into cur_status from public.cases where id = case_id;

    for n in 1..2 loop
      insert into public.case_updates (case_id, author_id, text)
      values (
        case_id,
        (select id from public.users where is_active order by random() limit 1),
        notes[1 + ((abs(hashtext(case_id::text)) + n * 7) % array_length(notes, 1))]
      );
    end loop;

    if cur_status in ('in_progress','done','delivered') then
      insert into public.case_updates (case_id, author_id, text, status_before, status_after)
      values (case_id, (select id from public.users where is_active order by random() limit 1),
              'Started work on this case.', 'new', 'in_progress');
    end if;
    if cur_status in ('done','delivered') then
      insert into public.case_updates (case_id, author_id, text, status_before, status_after)
      values (case_id, (select id from public.users where is_active order by random() limit 1),
              'Work finished, ready to deliver.', 'in_progress', 'done');
    end if;
    if cur_status = 'delivered' then
      insert into public.case_updates (case_id, author_id, text, status_before, status_after)
      values (case_id, (select id from public.users where is_active order by random() limit 1),
              'Delivered to client.', 'done', 'delivered');
    end if;
  end loop;
end $fn$;

-- -------------------------------------------------------------------------
-- 5. 100 cases across all statuses + priorities
-- -------------------------------------------------------------------------
do $cases$
declare
  client_ids  uuid[] := array(select id from public.clients   order by created_at desc limit 100);
  company_ids uuid[] := array(select id from public.companies order by created_at desc limit 50);
  service_ids uuid[] := array(select id from public.service_types where is_active order by sort_order);
  partner_ids uuid[] := array(select id from public.partners  order by created_at desc limit 100);
  user_ids    uuid[] := array(select id from public.users     where is_active);
  new_case_ids uuid[];
  statuses    text[] := array['new','in_progress','done','delivered'];
  priorities  text[] := array['low','normal','high','urgent'];
  intervals   text[] := array[null,null,null,'quarterly','annually'];
  i int;
  status_val text;
  case_id uuid;
begin
  if array_length(service_ids, 1) is null then
    raise exception 'No active service_types found — cannot seed cases.';
  end if;

  new_case_ids := array[]::uuid[];

  for i in 1..100 loop
    status_val := statuses[1 + (i % 5)];
    insert into public.cases (
      client_id, company_id, service_type_id, partner_id, partner_role,
      status, priority, assigned_to, deadline, expires_at, recurring_interval, title
    ) values (
      client_ids[1 + (i * 3) % array_length(client_ids, 1)],
      -- 60% of cases attach to a company
      case when i % 5 < 3 then company_ids[1 + (i * 7) % array_length(company_ids, 1)] else null end,
      service_ids[1 + (i % array_length(service_ids, 1))],
      case when i % 4 = 0 then partner_ids[1 + (i * 11) % array_length(partner_ids, 1)] else null end,
      case when i % 4 = 0 then (array['referrer','agent'])[1 + (i % 2)]::text else null end,
      status_val,
      priorities[1 + (i % 4)],
      case when array_length(user_ids, 1) is not null and i % 3 <> 0
           then user_ids[1 + (i % array_length(user_ids, 1))]
           else null end,
      case when i % 3 = 0 then (current_date + ((5 + (i * 3) % 90) || ' days')::interval)::date else null end,
      case when i % 4 = 0 then (current_date + ((-15 + (i * 5) % 400) || ' days')::interval)::date else null end,
      intervals[1 + (i % 5)],
      case when i % 2 = 0 then 'Test case ' || i else null end
    )
    returning id into case_id;
    new_case_ids := array_append(new_case_ids, case_id);
  end loop;

  -- ---------------------------------------------------------------
  -- 6. Timeline updates: 2 plain notes per case, plus status-change
  --    entries reconstructing how each case got to its current state.
  -- ---------------------------------------------------------------
  perform seed_case_updates(new_case_ids);
end $cases$;

-- Drop the temporary helper now that it's done its job.
drop function if exists seed_case_updates(uuid[]);

commit;

-- =========================================================================
-- CLEANUP (uncomment carefully — wipes everything the seed created).
-- Only safe if you haven't added real production rows on top.
-- =========================================================================
-- begin;
-- delete from public.case_updates
--   where case_id in (select id from public.cases where created_by is null);
-- delete from public.cases where created_by is null;
-- delete from public.client_companies
--   where client_id in (select id from public.clients where created_by is null);
-- delete from public.clients where created_by is null;
-- delete from public.companies where created_by is null;
-- delete from public.partners where created_by is null;
-- drop function if exists seed_case_updates(uuid[]);
-- commit;
