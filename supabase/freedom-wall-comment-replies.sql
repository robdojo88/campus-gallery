-- Freedom Wall comment replies with unlimited nesting (indentation is handled in UI)

create or replace function public.enforce_freedom_comment_reply_depth()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_post_id uuid;
  parent_user_id uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  select c.post_id, c.user_id
  into parent_post_id, parent_user_id
  from public.freedom_wall_comments c
  where c.id = new.parent_id;

  if parent_post_id is null then
    raise exception 'Parent comment does not exist.';
  end if;

  if parent_post_id <> new.post_id then
    raise exception 'Reply must belong to the same post.';
  end if;

  if auth.uid() is not null and parent_user_id = auth.uid() then
    raise exception 'You cannot reply to your own comment.';
  end if;

  return new;
end;
$$;

drop trigger if exists on_freedom_comments_enforce_reply_depth on public.freedom_wall_comments;
create trigger on_freedom_comments_enforce_reply_depth
before insert or update of parent_id on public.freedom_wall_comments
for each row execute procedure public.enforce_freedom_comment_reply_depth();
