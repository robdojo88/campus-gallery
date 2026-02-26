-- Admin activity audit trail for accountability across multiple admins

create extension if not exists pgcrypto;

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.users(id) on delete cascade,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_at_idx
on public.admin_audit_logs (created_at desc);

create index if not exists admin_audit_logs_admin_created_at_idx
on public.admin_audit_logs (admin_user_id, created_at desc);

create index if not exists admin_audit_logs_action_created_at_idx
on public.admin_audit_logs (action, created_at desc);

alter table public.admin_audit_logs enable row level security;

drop policy if exists admin_audit_logs_select_admin on public.admin_audit_logs;
create policy admin_audit_logs_select_admin on public.admin_audit_logs
for select to authenticated
using (public.is_admin());

drop policy if exists admin_audit_logs_insert_admin_self on public.admin_audit_logs;
create policy admin_audit_logs_insert_admin_self on public.admin_audit_logs
for insert to authenticated
with check (
  public.is_admin()
  and admin_user_id = auth.uid()
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'admin_audit_logs'
  ) then
    alter publication supabase_realtime add table public.admin_audit_logs;
  end if;
end
$$;
