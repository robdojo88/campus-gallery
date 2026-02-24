-- Reporting + moderation helpers

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'report_target_type') then
    create type public.report_target_type as enum (
      'feed_post',
      'feed_comment',
      'freedom_post',
      'freedom_comment',
      'incognito_post',
      'incognito_comment'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'report_status') then
    create type public.report_status as enum ('open', 'declined', 'resolved');
  end if;
end
$$;

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.users(id) on delete cascade,
  target_type public.report_target_type not null,
  target_id uuid not null,
  reason text not null default 'Reported content',
  details text,
  status public.report_status not null default 'open',
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  action_note text,
  created_at timestamptz not null default now()
);

create index if not exists content_reports_status_created_idx
on public.content_reports (status, created_at desc);

create index if not exists content_reports_target_idx
on public.content_reports (target_type, target_id, created_at desc);

create unique index if not exists content_reports_unique_open_report_per_user_target
on public.content_reports (reporter_user_id, target_type, target_id, status)
where status = 'open';

alter table public.content_reports enable row level security;

drop policy if exists content_reports_select_own_or_admin on public.content_reports;
create policy content_reports_select_own_or_admin on public.content_reports
for select to authenticated
using (reporter_user_id = auth.uid() or public.is_admin());

drop policy if exists content_reports_insert_auth on public.content_reports;
create policy content_reports_insert_auth on public.content_reports
for insert to authenticated
with check (reporter_user_id = auth.uid());

drop policy if exists content_reports_update_admin on public.content_reports;
create policy content_reports_update_admin on public.content_reports
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists content_reports_delete_admin on public.content_reports;
create policy content_reports_delete_admin on public.content_reports
for delete to authenticated
using (public.is_admin());

create or replace function public.notify_admins_on_report_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reporter_name text;
  target_label text;
begin
  select u.name
  into reporter_name
  from public.users u
  where u.id = new.reporter_user_id;

  target_label := replace(new.target_type::text, '_', ' ');

  insert into public.notifications (
    recipient_user_id,
    actor_user_id,
    type,
    title,
    body,
    data
  )
  select
    admin_user.id,
    new.reporter_user_id,
    'report_created',
    'New content report submitted',
    coalesce(reporter_name, 'A user') || ' reported ' || target_label || '.',
    jsonb_build_object(
      'reportId', new.id,
      'targetType', new.target_type,
      'targetId', new.target_id,
      'reason', new.reason
    )
  from public.users admin_user
  where admin_user.role = 'admin';

  return new;
end;
$$;

drop trigger if exists on_content_report_created_notify_admins on public.content_reports;
create trigger on_content_report_created_notify_admins
after insert on public.content_reports
for each row execute procedure public.notify_admins_on_report_created();

-- Auto-approve feedback immediately (no pending workflow)
alter table public.reviews
alter column status set default 'approved';

update public.reviews
set status = 'approved'
where status = 'pending';

-- Harden review delete access:
-- remove any legacy/non-admin DELETE policies that may still exist.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select p.policyname
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'reviews'
      and p.cmd = 'DELETE'
  loop
    execute format(
      'drop policy if exists %I on public.reviews',
      policy_record.policyname
    );
  end loop;
end
$$;

alter table public.reviews enable row level security;

drop policy if exists reviews_admin_delete on public.reviews;
create policy reviews_admin_delete on public.reviews
for delete to authenticated
using (public.is_admin());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'content_reports'
  ) then
    alter publication supabase_realtime add table public.content_reports;
  end if;
end
$$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'notifications')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;
