create table if not exists public.app_settings (
  id boolean primary key default true,
  current_event_id uuid references public.events(id) on delete set null,
  updated_by uuid references public.users(id),
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id)
);

insert into public.app_settings (id)
values (true)
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists app_settings_select_auth on public.app_settings;
create policy app_settings_select_auth on public.app_settings
for select to authenticated
using (true);

drop policy if exists app_settings_admin_write on public.app_settings;
create policy app_settings_admin_write on public.app_settings
for all to authenticated
using (public.is_admin())
with check (public.is_admin());
