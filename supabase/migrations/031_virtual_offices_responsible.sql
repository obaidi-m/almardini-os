-- Each VO can name a partner as the person responsible (a.k.a. PJ in the
-- source xlsx). Optional — many rows won't have one.

begin;

alter table public.virtual_offices
  add column if not exists responsible_partner_id uuid;

alter table public.virtual_offices
  drop constraint if exists virtual_offices_responsible_partner_fk;
alter table public.virtual_offices
  add constraint virtual_offices_responsible_partner_fk
  foreign key (responsible_partner_id) references public.partners(id);

create index if not exists virtual_offices_responsible_idx
  on public.virtual_offices(responsible_partner_id)
  where responsible_partner_id is not null;

commit;
