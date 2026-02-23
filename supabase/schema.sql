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

create table if not exists public.incognito_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.incognito_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.incognito_posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);

create table if not exists public.incognito_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.incognito_posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  type text not null,
  title text not null,
  body text not null default '',
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_at_idx
on public.notifications (recipient_user_id, created_at desc);

create index if not exists notifications_recipient_read_at_idx
on public.notifications (recipient_user_id, read_at);

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

create or replace function public.insert_notification(
  target_user_id uuid,
  actor_id uuid,
  notif_type text,
  notif_title text,
  notif_body text,
  notif_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_user_id is null then
    return;
  end if;

  if actor_id is not null and target_user_id = actor_id then
    return;
  end if;

  insert into public.notifications (
    recipient_user_id,
    actor_user_id,
    type,
    title,
    body,
    data
  )
  values (
    target_user_id,
    actor_id,
    notif_type,
    notif_title,
    coalesce(notif_body, ''),
    coalesce(notif_data, '{}'::jsonb)
  );
end;
$$;

create or replace function public.notify_feed_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  actor_name text;
begin
  select p.user_id into target_user_id
  from public.posts p
  where p.id = new.post_id;

  select u.name into actor_name
  from public.users u
  where u.id = new.user_id;

  perform public.insert_notification(
    target_user_id,
    new.user_id,
    'feed_like',
    'New like on your feed post',
    coalesce(actor_name, 'Someone') || ' liked your post.',
    jsonb_build_object('postId', new.post_id)
  );

  return new;
end;
$$;

create or replace function public.notify_feed_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  actor_name text;
  snippet text;
begin
  select p.user_id into target_user_id
  from public.posts p
  where p.id = new.post_id;

  select u.name into actor_name
  from public.users u
  where u.id = new.user_id;

  snippet := left(regexp_replace(coalesce(new.content, ''), '\s+', ' ', 'g'), 120);

  perform public.insert_notification(
    target_user_id,
    new.user_id,
    'feed_comment',
    'New comment on your feed post',
    coalesce(actor_name, 'Someone') || ' commented: "' || snippet || '".',
    jsonb_build_object('postId', new.post_id, 'commentId', new.id)
  );

  return new;
end;
$$;

create or replace function public.notify_freedom_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  actor_name text;
begin
  select p.user_id into target_user_id
  from public.freedom_wall_posts p
  where p.id = new.post_id;

  select u.name into actor_name
  from public.users u
  where u.id = new.user_id;

  perform public.insert_notification(
    target_user_id,
    new.user_id,
    'freedom_like',
    'New like on your Freedom Wall post',
    coalesce(actor_name, 'Someone') || ' liked your Freedom Wall post.',
    jsonb_build_object('freedomPostId', new.post_id)
  );

  return new;
end;
$$;

create or replace function public.notify_freedom_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  actor_name text;
  snippet text;
begin
  select p.user_id into target_user_id
  from public.freedom_wall_posts p
  where p.id = new.post_id;

  select u.name into actor_name
  from public.users u
  where u.id = new.user_id;

  snippet := left(regexp_replace(coalesce(new.content, ''), '\s+', ' ', 'g'), 120);

  perform public.insert_notification(
    target_user_id,
    new.user_id,
    'freedom_comment',
    'New comment on your Freedom Wall post',
    coalesce(actor_name, 'Someone') || ' commented: "' || snippet || '".',
    jsonb_build_object('freedomPostId', new.post_id, 'commentId', new.id)
  );

  return new;
end;
$$;

create or replace function public.notify_incognito_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  actor_name text;
begin
  select p.user_id into target_user_id
  from public.incognito_posts p
  where p.id = new.post_id;

  select u.name into actor_name
  from public.users u
  where u.id = new.user_id;

  perform public.insert_notification(
    target_user_id,
    new.user_id,
    'incognito_like',
    'New like on your anonymous post',
    coalesce(actor_name, 'Someone') || ' liked one of your anonymous posts.',
    jsonb_build_object('incognitoPostId', new.post_id)
  );

  return new;
end;
$$;

create or replace function public.notify_incognito_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  actor_name text;
  snippet text;
begin
  select p.user_id into target_user_id
  from public.incognito_posts p
  where p.id = new.post_id;

  select u.name into actor_name
  from public.users u
  where u.id = new.user_id;

  snippet := left(regexp_replace(coalesce(new.content, ''), '\s+', ' ', 'g'), 120);

  perform public.insert_notification(
    target_user_id,
    new.user_id,
    'incognito_comment',
    'New comment on your anonymous post',
    coalesce(actor_name, 'Someone') || ' commented on your anonymous post: "' || snippet || '".',
    jsonb_build_object('incognitoPostId', new.post_id, 'commentId', new.id)
  );

  return new;
end;
$$;

create or replace function public.notify_event_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_id uuid;
  actor_name text;
begin
  if new.created_by is not null then
    select u.name into actor_name
    from public.users u
    where u.id = new.created_by;
  end if;

  for recipient_id in
    select u.id
    from public.users u
    where u.role in ('admin', 'member')
      and (new.created_by is null or u.id <> new.created_by)
  loop
    perform public.insert_notification(
      recipient_id,
      new.created_by,
      'event_created',
      'New campus event available',
      coalesce(actor_name, 'Admin') || ' added "' || new.name || '".',
      jsonb_build_object('eventId', new.id, 'eventName', new.name)
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists on_like_created_notify on public.likes;
create trigger on_like_created_notify
after insert on public.likes
for each row execute procedure public.notify_feed_like();

drop trigger if exists on_comment_created_notify on public.comments;
create trigger on_comment_created_notify
after insert on public.comments
for each row execute procedure public.notify_feed_comment();

drop trigger if exists on_freedom_like_created_notify on public.freedom_wall_likes;
create trigger on_freedom_like_created_notify
after insert on public.freedom_wall_likes
for each row execute procedure public.notify_freedom_like();

drop trigger if exists on_freedom_comment_created_notify on public.freedom_wall_comments;
create trigger on_freedom_comment_created_notify
after insert on public.freedom_wall_comments
for each row execute procedure public.notify_freedom_comment();

drop trigger if exists on_incognito_like_created_notify on public.incognito_likes;
create trigger on_incognito_like_created_notify
after insert on public.incognito_likes
for each row execute procedure public.notify_incognito_like();

drop trigger if exists on_incognito_comment_created_notify on public.incognito_comments;
create trigger on_incognito_comment_created_notify
after insert on public.incognito_comments
for each row execute procedure public.notify_incognito_comment();

drop trigger if exists on_event_created_notify on public.events;
create trigger on_event_created_notify
after insert on public.events
for each row execute procedure public.notify_event_created();

alter table public.users enable row level security;
alter table public.events enable row level security;
alter table public.posts enable row level security;
alter table public.post_images enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.freedom_wall_posts enable row level security;
alter table public.freedom_wall_likes enable row level security;
alter table public.freedom_wall_comments enable row level security;
alter table public.incognito_posts enable row level security;
alter table public.incognito_likes enable row level security;
alter table public.incognito_comments enable row level security;
alter table public.notifications enable row level security;
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

drop policy if exists incognito_likes_select_members_admin on public.incognito_likes;
create policy incognito_likes_select_members_admin on public.incognito_likes
for select to authenticated
using (
  public.current_role() in ('member', 'admin') and
  exists (select 1 from public.incognito_posts p where p.id = incognito_likes.post_id)
);

drop policy if exists incognito_likes_insert_members_admin on public.incognito_likes;
create policy incognito_likes_insert_members_admin on public.incognito_likes
for insert to authenticated
with check (
  user_id = auth.uid() and
  public.current_role() in ('member', 'admin') and
  exists (select 1 from public.incognito_posts p where p.id = incognito_likes.post_id)
);

drop policy if exists incognito_likes_delete_owner_or_admin on public.incognito_likes;
create policy incognito_likes_delete_owner_or_admin on public.incognito_likes
for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists incognito_comments_select_members_admin on public.incognito_comments;
create policy incognito_comments_select_members_admin on public.incognito_comments
for select to authenticated
using (
  public.current_role() in ('member', 'admin') and
  exists (select 1 from public.incognito_posts p where p.id = incognito_comments.post_id)
);

drop policy if exists incognito_comments_insert_members_admin on public.incognito_comments;
create policy incognito_comments_insert_members_admin on public.incognito_comments
for insert to authenticated
with check (
  user_id = auth.uid() and
  public.current_role() in ('member', 'admin') and
  exists (select 1 from public.incognito_posts p where p.id = incognito_comments.post_id)
);

drop policy if exists incognito_comments_update_delete_owner_or_admin on public.incognito_comments;
create policy incognito_comments_update_delete_owner_or_admin on public.incognito_comments
for all to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
for select to authenticated
using (recipient_user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
for update to authenticated
using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid());

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

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table public.posts;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'post_images'
  ) then
    alter publication supabase_realtime add table public.post_images;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'likes'
  ) then
    alter publication supabase_realtime add table public.likes;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments'
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'freedom_wall_posts'
  ) then
    alter publication supabase_realtime add table public.freedom_wall_posts;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'incognito_posts'
  ) then
    alter publication supabase_realtime add table public.incognito_posts;
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

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'incognito_likes'
  ) then
    alter publication supabase_realtime add table public.incognito_likes;
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
      and tablename = 'incognito_comments'
  ) then
    alter publication supabase_realtime add table public.incognito_comments;
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
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;
