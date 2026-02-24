-- Comment heart reactions for Feed, Freedom Wall, and Incognito

create extension if not exists pgcrypto;

create table if not exists public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(comment_id, user_id)
);

create table if not exists public.freedom_wall_comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.freedom_wall_comments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(comment_id, user_id)
);

create table if not exists public.incognito_comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.incognito_comments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(comment_id, user_id)
);

alter table public.comment_likes enable row level security;
alter table public.freedom_wall_comment_likes enable row level security;
alter table public.incognito_comment_likes enable row level security;

drop policy if exists comment_likes_select_auth on public.comment_likes;
create policy comment_likes_select_auth on public.comment_likes
for select to authenticated
using (true);

drop policy if exists comment_likes_insert_owner_or_admin on public.comment_likes;
create policy comment_likes_insert_owner_or_admin on public.comment_likes
for insert to authenticated
with check (
  user_id = auth.uid() and
  exists (select 1 from public.comments c where c.id = comment_likes.comment_id)
);

drop policy if exists comment_likes_delete_owner_or_admin on public.comment_likes;
create policy comment_likes_delete_owner_or_admin on public.comment_likes
for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists freedom_comment_likes_select_members_admin on public.freedom_wall_comment_likes;
create policy freedom_comment_likes_select_members_admin on public.freedom_wall_comment_likes
for select to authenticated
using (
  public.current_role() in ('member', 'admin') and
  exists (
    select 1
    from public.freedom_wall_comments c
    join public.freedom_wall_posts p on p.id = c.post_id
    where c.id = freedom_wall_comment_likes.comment_id
      and p.id = c.post_id
  )
);

drop policy if exists freedom_comment_likes_insert_members_admin on public.freedom_wall_comment_likes;
create policy freedom_comment_likes_insert_members_admin on public.freedom_wall_comment_likes
for insert to authenticated
with check (
  user_id = auth.uid() and
  public.current_role() in ('member', 'admin') and
  exists (
    select 1
    from public.freedom_wall_comments c
    join public.freedom_wall_posts p on p.id = c.post_id
    where c.id = freedom_wall_comment_likes.comment_id
      and p.id = c.post_id
  )
);

drop policy if exists freedom_comment_likes_delete_owner_or_admin on public.freedom_wall_comment_likes;
create policy freedom_comment_likes_delete_owner_or_admin on public.freedom_wall_comment_likes
for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists incognito_comment_likes_select_members_admin on public.incognito_comment_likes;
create policy incognito_comment_likes_select_members_admin on public.incognito_comment_likes
for select to authenticated
using (
  public.current_role() in ('member', 'admin') and
  exists (
    select 1
    from public.incognito_comments c
    join public.incognito_posts p on p.id = c.post_id
    where c.id = incognito_comment_likes.comment_id
      and p.id = c.post_id
  )
);

drop policy if exists incognito_comment_likes_insert_members_admin on public.incognito_comment_likes;
create policy incognito_comment_likes_insert_members_admin on public.incognito_comment_likes
for insert to authenticated
with check (
  user_id = auth.uid() and
  public.current_role() in ('member', 'admin') and
  exists (
    select 1
    from public.incognito_comments c
    join public.incognito_posts p on p.id = c.post_id
    where c.id = incognito_comment_likes.comment_id
      and p.id = c.post_id
  )
);

drop policy if exists incognito_comment_likes_delete_owner_or_admin on public.incognito_comment_likes;
create policy incognito_comment_likes_delete_owner_or_admin on public.incognito_comment_likes
for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'comment_likes'
  ) then
    alter publication supabase_realtime add table public.comment_likes;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'freedom_wall_comment_likes'
  ) then
    alter publication supabase_realtime add table public.freedom_wall_comment_likes;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'incognito_comment_likes'
  ) then
    alter publication supabase_realtime add table public.incognito_comment_likes;
  end if;
end
$$;
