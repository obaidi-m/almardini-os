-- Companies can now record which partner brought them in, same as clients.
-- Nullable — most companies won't have one. Named _fk so the PostgREST embed
-- via the FK works (mirrors clients_introduced_by_fk in migration 005).

begin;

alter table public.companies
  add column if not exists introduced_by_partner_id uuid;

alter table public.companies
  drop constraint if exists companies_introduced_by_fk;
alter table public.companies
  add constraint companies_introduced_by_fk
  foreign key (introduced_by_partner_id) references public.partners(id);

create index if not exists companies_introduced_by_idx
  on public.companies(introduced_by_partner_id)
  where introduced_by_partner_id is not null;

commit;
