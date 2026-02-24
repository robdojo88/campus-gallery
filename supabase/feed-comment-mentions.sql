-- Feed reply mention notification support

alter table public.comments
add column if not exists parent_id uuid references public.comments(id) on delete cascade;

create or replace function public.notify_feed_comment()
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
  from public.posts p
  where p.id = new.post_id;

  if new.parent_id is not null then
    select c.user_id into target_reply_user_id
    from public.comments c
    where c.id = new.parent_id;
  end if;

  select u.name into actor_name
  from public.users u
  where u.id = new.user_id;

  snippet := left(regexp_replace(coalesce(new.content, ''), '\s+', ' ', 'g'), 120);

  perform public.insert_notification(
    target_post_owner_id,
    new.user_id,
    'feed_comment',
    'New comment on your feed post',
    coalesce(actor_name, 'Someone') || ' commented: "' || snippet || '".',
    jsonb_build_object('postId', new.post_id, 'commentId', new.id)
  );

  if new.parent_id is not null
     and target_reply_user_id is not null
     and target_reply_user_id <> target_post_owner_id then
    perform public.insert_notification(
      target_reply_user_id,
      new.user_id,
      'feed_comment',
      'You were mentioned in a feed comment',
      coalesce(actor_name, 'Someone') || ' mentioned you: "' || snippet || '".',
      jsonb_build_object(
        'postId', new.post_id,
        'commentId', new.id,
        'parentCommentId', new.parent_id,
        'mentioned', true
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_comment_created_notify on public.comments;
create trigger on_comment_created_notify
after insert on public.comments
for each row execute procedure public.notify_feed_comment();
