-- Student/member registry for USN-based onboarding and admin roster management

create extension if not exists pgcrypto;

create table if not exists public.student_registry (
  id uuid primary key default gen_random_uuid(),
  usn text not null,
  first_name text not null,
  last_name text not null,
  course text,
  year_level int check (year_level is null or year_level between 1 and 12),
  email text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists student_registry_usn_unique_idx
on public.student_registry (usn);

create unique index if not exists student_registry_email_unique_idx
on public.student_registry (email);

create index if not exists student_registry_last_name_idx
on public.student_registry (last_name, first_name);

create or replace function public.normalize_student_registry_row()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.usn := upper(btrim(coalesce(new.usn, '')));
  new.first_name := btrim(coalesce(new.first_name, ''));
  new.last_name := btrim(coalesce(new.last_name, ''));
  new.course := nullif(btrim(coalesce(new.course, '')), '');
  new.email := lower(btrim(coalesce(new.email, '')));
  new.status := lower(coalesce(nullif(btrim(new.status), ''), 'active'));
  new.updated_at := now();

  if new.usn = '' then
    raise exception 'USN is required.';
  end if;
  if new.first_name = '' then
    raise exception 'First name is required.';
  end if;
  if new.last_name = '' then
    raise exception 'Last name is required.';
  end if;
  if new.email = '' then
    raise exception 'Email is required.';
  end if;
  if new.status not in ('active', 'inactive') then
    raise exception 'Status must be active or inactive.';
  end if;

  return new;
end;
$$;

drop trigger if exists on_student_registry_normalize on public.student_registry;
create trigger on_student_registry_normalize
before insert or update on public.student_registry
for each row execute procedure public.normalize_student_registry_row();

alter table public.student_registry enable row level security;

drop policy if exists student_registry_select_admin on public.student_registry;
create policy student_registry_select_admin on public.student_registry
for select to authenticated
using (public.is_admin());

drop policy if exists student_registry_insert_admin on public.student_registry;
create policy student_registry_insert_admin on public.student_registry
for insert to authenticated
with check (public.is_admin());

drop policy if exists student_registry_update_admin on public.student_registry;
create policy student_registry_update_admin on public.student_registry
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists student_registry_delete_admin on public.student_registry;
create policy student_registry_delete_admin on public.student_registry
for delete to authenticated
using (public.is_admin());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'student_registry'
  ) then
    alter publication supabase_realtime add table public.student_registry;
  end if;
end
$$;
