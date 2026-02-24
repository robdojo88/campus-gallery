-- Allow visitors to read campus feed posts while keeping existing visibility model.
-- Run this in Supabase SQL Editor.

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
    when public.current_role() = 'visitor' then v in ('campus', 'visitor')
    else false
  end
$$;
