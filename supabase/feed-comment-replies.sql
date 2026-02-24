-- Feed comment replies with nested depth capped at second level

alter table public.comments
add column if not exists parent_id uuid references public.comments(id) on delete cascade;

create unique index if not exists comments_id_post_id_key
on public.comments (id, post_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'comments_parent_same_post_fk'
      and conrelid = 'public.comments'::regclass
  ) then
    alter table public.comments
      add constraint comments_parent_same_post_fk
      foreign key (parent_id, post_id)
      references public.comments (id, post_id)
      on delete cascade;
  end if;
end
$$;

create or replace function public.enforce_comment_reply_depth()
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
  from public.comments c
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
  from public.comments c
  where c.id = parent_parent_id;

  if grand_parent_parent_id is not null then
    raise exception 'Replies are limited to second-level threads.';
  end if;

  return new;
end;
$$;

drop trigger if exists on_comments_enforce_reply_depth on public.comments;
create trigger on_comments_enforce_reply_depth
before insert or update of parent_id on public.comments
for each row execute procedure public.enforce_comment_reply_depth();
