-- Freedom Wall image + like + nested comments support

create table if not exists public.freedom_wall_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.freedom_wall_posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);

create table if not exists public.freedom_wall_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.freedom_wall_posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  parent_id uuid references public.freedom_wall_comments(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists freedom_wall_comments_id_post_id_key
on public.freedom_wall_comments (id, post_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'freedom_wall_comments_parent_same_post_fk'
      and conrelid = 'public.freedom_wall_comments'::regclass
  ) then
    alter table public.freedom_wall_comments
      add constraint freedom_wall_comments_parent_same_post_fk
      foreign key (parent_id, post_id)
      references public.freedom_wall_comments (id, post_id)
      on delete cascade;
  end if;
end
$$;

create or replace function public.enforce_freedom_comment_reply_depth()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_post_id uuid;
  parent_parent_id uuid;
  grand_parent_parent_id uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  select c.post_id, c.parent_id
  into parent_post_id, parent_parent_id
  from public.freedom_wall_comments c
  where c.id = new.parent_id;

  if parent_post_id is null then
    raise exception 'Parent comment does not exist.';
  end if;

  if parent_post_id <> new.post_id then
    raise exception 'Reply must belong to the same post.';
  end if;

  if parent_parent_id is null then
    return new;
  end if;

  select c.parent_id
  into grand_parent_parent_id
  from public.freedom_wall_comments c
  where c.id = parent_parent_id;

  if grand_parent_parent_id is not null then
    raise exception 'Replies are limited to second-level threads.';
  end if;

  return new;
end;
$$;

drop trigger if exists on_freedom_comments_enforce_reply_depth on public.freedom_wall_comments;
create trigger on_freedom_comments_enforce_reply_depth
before insert or update of parent_id on public.freedom_wall_comments
for each row execute procedure public.enforce_freedom_comment_reply_depth();

alter table public.freedom_wall_likes enable row level security;
alter table public.freedom_wall_comments enable row level security;

drop policy if exists freedom_likes_select_members_admin on public.freedom_wall_likes;
create policy freedom_likes_select_members_admin on public.freedom_wall_likes
for select to authenticated
using (
  public.current_role() in ('member', 'admin') and
  exists (select 1 from public.freedom_wall_posts p where p.id = freedom_wall_likes.post_id)
);

drop policy if exists freedom_likes_insert_members_admin on public.freedom_wall_likes;
create policy freedom_likes_insert_members_admin on public.freedom_wall_likes
for insert to authenticated
with check (
  user_id = auth.uid() and
  public.current_role() in ('member', 'admin') and
  exists (select 1 from public.freedom_wall_posts p where p.id = freedom_wall_likes.post_id)
);

drop policy if exists freedom_likes_delete_owner_or_admin on public.freedom_wall_likes;
create policy freedom_likes_delete_owner_or_admin on public.freedom_wall_likes
for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists freedom_comments_select_members_admin on public.freedom_wall_comments;
create policy freedom_comments_select_members_admin on public.freedom_wall_comments
for select to authenticated
using (
  public.current_role() in ('member', 'admin') and
  exists (select 1 from public.freedom_wall_posts p where p.id = freedom_wall_comments.post_id)
);

drop policy if exists freedom_comments_insert_members_admin on public.freedom_wall_comments;
create policy freedom_comments_insert_members_admin on public.freedom_wall_comments
for insert to authenticated
with check (
  user_id = auth.uid() and
  public.current_role() in ('member', 'admin') and
  exists (select 1 from public.freedom_wall_posts p where p.id = freedom_wall_comments.post_id)
);

drop policy if exists freedom_comments_update_delete_owner_or_admin on public.freedom_wall_comments;
create policy freedom_comments_update_delete_owner_or_admin on public.freedom_wall_comments
for all to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'freedom_wall_likes'
  ) then
    alter publication supabase_realtime add table public.freedom_wall_likes;
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
      and tablename = 'freedom_wall_comments'
  ) then
    alter publication supabase_realtime add table public.freedom_wall_comments;
  end if;
end
$$;
