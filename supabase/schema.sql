create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'member', 'visitor');
  end if;
  if not exists (select 1 from pg_type where typname = 'post_visibility') then
    create type public.post_visibility as enum ('campus', 'visitor');
  end if;
  if not exists (select 1 from pg_type where typname = 'review_status') then
    create type public.review_status as enum ('pending', 'approved', 'rejected');
  end if;
end$$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role public.app_role not null default 'member',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  image_url text not null,
  caption text,
  visibility public.post_visibility not null default 'campus',
  event_id uuid references public.events(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  image_url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.freedom_wall_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.incognito_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  review_text text not null,
  status public.review_status not null default 'pending',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), 'Campus User'),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'member')
  )
  on conflict (id) do update
  set name = excluded.name,
      email = excluded.email,
      role = excluded.role;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.users where id = auth.uid()), false)
$$;

create or replace function public.can_view_visibility(v public.post_visibility)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.current_role() = 'admin' then true
    when public.current_role() = 'member' then true
    when public.current_role() = 'visitor' then v = 'visitor'
    else false
  end
$$;

alter table public.users enable row level security;
alter table public.events enable row level security;
alter table public.posts enable row level security;
alter table public.post_images enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.freedom_wall_posts enable row level security;
alter table public.incognito_posts enable row level security;
alter table public.reviews enable row level security;

drop policy if exists users_select_auth on public.users;
create policy users_select_auth on public.users for select to authenticated using (true);

drop policy if exists users_insert_self_or_admin on public.users;
create policy users_insert_self_or_admin on public.users
for insert to authenticated
with check (id = auth.uid() or public.is_admin());

drop policy if exists users_update_self_or_admin on public.users;
create policy users_update_self_or_admin on public.users
for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists events_select_auth on public.events;
create policy events_select_auth on public.events for select to authenticated using (true);

drop policy if exists events_admin_write on public.events;
create policy events_admin_write on public.events
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists posts_select_by_role on public.posts;
create policy posts_select_by_role on public.posts
for select to authenticated
using (public.can_view_visibility(visibility));

drop policy if exists posts_insert_by_role on public.posts;
create policy posts_insert_by_role on public.posts
for insert to authenticated
with check (
  user_id = auth.uid() and (
    public.is_admin() or
    (public.current_role() = 'member' and visibility = 'campus') or
    (public.current_role() = 'visitor' and visibility = 'visitor')
  )
);

drop policy if exists posts_update_delete_owner_or_admin on public.posts;
create policy posts_update_delete_owner_or_admin on public.posts
for all to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists post_images_select_by_post_access on public.post_images;
create policy post_images_select_by_post_access on public.post_images
for select to authenticated
using (
  exists (
    select 1 from public.posts p
    where p.id = post_images.post_id
      and public.can_view_visibility(p.visibility)
  )
);

drop policy if exists post_images_insert_by_post_owner_or_admin on public.post_images;
create policy post_images_insert_by_post_owner_or_admin on public.post_images
for insert to authenticated
with check (
  exists (
    select 1 from public.posts p
    where p.id = post_images.post_id
      and (p.user_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists post_images_delete_by_post_owner_or_admin on public.post_images;
create policy post_images_delete_by_post_owner_or_admin on public.post_images
for delete to authenticated
using (
  exists (
    select 1 from public.posts p
    where p.id = post_images.post_id
      and (p.user_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists likes_select_auth on public.likes;
create policy likes_select_auth on public.likes for select to authenticated using (true);

drop policy if exists likes_insert_owner_or_admin on public.likes;
create policy likes_insert_owner_or_admin on public.likes
for insert to authenticated
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists likes_delete_owner_or_admin on public.likes;
create policy likes_delete_owner_or_admin on public.likes
for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists comments_select_auth on public.comments;
create policy comments_select_auth on public.comments for select to authenticated using (true);

drop policy if exists comments_insert_owner_or_admin on public.comments;
create policy comments_insert_owner_or_admin on public.comments
for insert to authenticated
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists comments_update_delete_owner_or_admin on public.comments;
create policy comments_update_delete_owner_or_admin on public.comments
for all to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists freedom_select_members_admin on public.freedom_wall_posts;
create policy freedom_select_members_admin on public.freedom_wall_posts
for select to authenticated
using (public.current_role() in ('member', 'admin'));

drop policy if exists freedom_insert_members_admin on public.freedom_wall_posts;
create policy freedom_insert_members_admin on public.freedom_wall_posts
for insert to authenticated
with check (user_id = auth.uid() and public.current_role() in ('member', 'admin'));

drop policy if exists freedom_update_delete_owner_or_admin on public.freedom_wall_posts;
create policy freedom_update_delete_owner_or_admin on public.freedom_wall_posts
for all to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists incognito_select_members_admin on public.incognito_posts;
create policy incognito_select_members_admin on public.incognito_posts
for select to authenticated
using (public.current_role() in ('member', 'admin'));

drop policy if exists incognito_insert_members_admin on public.incognito_posts;
create policy incognito_insert_members_admin on public.incognito_posts
for insert to authenticated
with check (user_id = auth.uid() and public.current_role() in ('member', 'admin'));

drop policy if exists incognito_update_delete_owner_or_admin on public.incognito_posts;
create policy incognito_update_delete_owner_or_admin on public.incognito_posts
for all to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists reviews_select_scope on public.reviews;
create policy reviews_select_scope on public.reviews
for select to authenticated
using (public.is_admin() or status = 'approved' or visitor_id = auth.uid());

drop policy if exists reviews_insert_visitor on public.reviews;
create policy reviews_insert_visitor on public.reviews
for insert to authenticated
with check (visitor_id = auth.uid() and public.current_role() = 'visitor');

drop policy if exists reviews_admin_update on public.reviews;
create policy reviews_admin_update on public.reviews
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('captures', 'captures', true)
on conflict (id) do nothing;

drop policy if exists storage_captures_read on storage.objects;
create policy storage_captures_read on storage.objects
for select to public
using (bucket_id = 'captures');

drop policy if exists storage_captures_insert_auth on storage.objects;
create policy storage_captures_insert_auth on storage.objects
for insert to authenticated
with check (bucket_id = 'captures');

drop policy if exists storage_captures_update_owner on storage.objects;
create policy storage_captures_update_owner on storage.objects
for update to authenticated
using (bucket_id = 'captures' and owner = auth.uid())
with check (bucket_id = 'captures' and owner = auth.uid());

drop policy if exists storage_captures_delete_owner_or_admin on storage.objects;
create policy storage_captures_delete_owner_or_admin on storage.objects
for delete to authenticated
using (bucket_id = 'captures' and (owner = auth.uid() or public.is_admin()));

alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.post_images;
alter publication supabase_realtime add table public.likes;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.freedom_wall_posts;
alter publication supabase_realtime add table public.incognito_posts;
