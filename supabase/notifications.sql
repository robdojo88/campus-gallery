-- Notifications + incognito engagement support

create extension if not exists pgcrypto;
create extension if not exists pg_cron;

alter table public.events
add column if not exists created_by uuid references public.users(id);

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

create or replace function public.cleanup_old_notifications(
  retention interval default interval '30 days'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
begin
  delete from public.notifications
  where created_at < now() - retention;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

select public.cleanup_old_notifications('30 days'::interval);

do $cleanup$
declare
  existing_job_id bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid
    into existing_job_id
    from cron.job
    where jobname = 'cleanup_notifications_older_than_30_days'
    limit 1;

    if existing_job_id is not null then
      perform cron.unschedule(existing_job_id);
    end if;

    perform cron.schedule(
      'cleanup_notifications_older_than_30_days',
      '30 2 * * *',
      $job$select public.cleanup_old_notifications('30 days'::interval);$job$
    );
  end if;
end
$cleanup$;

alter table public.incognito_likes enable row level security;
alter table public.incognito_comments enable row level security;
alter table public.notifications enable row level security;

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
  target_post_owner_id uuid;
  target_reply_user_id uuid;
  actor_name text;
  snippet text;
begin
  select p.user_id into target_post_owner_id
  from public.freedom_wall_posts p
  where p.id = new.post_id;

  if new.parent_id is not null then
    select c.user_id into target_reply_user_id
    from public.freedom_wall_comments c
    where c.id = new.parent_id;
  end if;

  select u.name into actor_name
  from public.users u
  where u.id = new.user_id;

  snippet := left(regexp_replace(coalesce(new.content, ''), '\s+', ' ', 'g'), 120);

  perform public.insert_notification(
    target_post_owner_id,
    new.user_id,
    'freedom_comment',
    'New comment on your Freedom Wall post',
    coalesce(actor_name, 'Someone') || ' commented: "' || snippet || '".',
    jsonb_build_object('freedomPostId', new.post_id, 'commentId', new.id)
  );

  if new.parent_id is not null
     and target_reply_user_id is not null
     and target_reply_user_id <> target_post_owner_id then
    perform public.insert_notification(
      target_reply_user_id,
      new.user_id,
      'freedom_comment',
      'New reply on your Freedom Wall comment',
      coalesce(actor_name, 'Someone') || ' replied: "' || snippet || '".',
      jsonb_build_object('freedomPostId', new.post_id, 'commentId', new.id, 'parentCommentId', new.parent_id)
    );
  end if;

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
  actor_alias text;
begin
  select p.user_id into target_user_id
  from public.incognito_posts p
  where p.id = new.post_id;

  select u.name, u.incognito_alias into actor_name, actor_alias
  from public.users u
  where u.id = new.user_id;

  perform public.insert_notification(
    target_user_id,
    new.user_id,
    'incognito_like',
    'New activity on your anonymous post',
    coalesce(actor_alias, actor_name, 'Someone') || ' liked one of your anonymous posts.',
    jsonb_build_object(
      'incognitoPostId', new.post_id,
      'actorAlias', coalesce(actor_alias, actor_name)
    )
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
  actor_alias text;
begin
  select p.user_id into target_user_id
  from public.incognito_posts p
  where p.id = new.post_id;

  select u.name, u.incognito_alias into actor_name, actor_alias
  from public.users u
  where u.id = new.user_id;

  perform public.insert_notification(
    target_user_id,
    new.user_id,
    'incognito_comment',
    'New activity on your anonymous post',
    coalesce(actor_alias, actor_name, 'Someone') || ' commented on your anonymous post.',
    jsonb_build_object(
      'incognitoPostId', new.post_id,
      'commentId', new.id,
      'actorAlias', coalesce(actor_alias, actor_name)
    )
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
