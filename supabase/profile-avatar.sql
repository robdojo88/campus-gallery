-- Required profile avatars + Google avatar bootstrap

alter table public.users
alter column avatar_url set default '/avatar-default.svg';

update public.users u
set avatar_url = coalesce(
  nullif(au.raw_user_meta_data ->> 'avatar_url', ''),
  nullif(au.raw_user_meta_data ->> 'picture', ''),
  '/avatar-default.svg'
)
from auth.users au
where u.id = au.id
  and (
    u.avatar_url is null
    or btrim(u.avatar_url) = ''
    or u.avatar_url = '/avatar-default.svg'
  );

update public.users
set avatar_url = '/avatar-default.svg'
where avatar_url is null or btrim(avatar_url) = '';

alter table public.users
alter column avatar_url set not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email, role, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), 'Campus User'),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'member'),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
      nullif(new.raw_user_meta_data ->> 'picture', ''),
      '/avatar-default.svg'
    )
  )
  on conflict (id) do update
  set name = excluded.name,
      email = excluded.email,
      role = excluded.role,
      avatar_url = case
        when public.users.avatar_url is null
          or btrim(public.users.avatar_url) = ''
          or public.users.avatar_url = '/avatar-default.svg'
          then excluded.avatar_url
        else public.users.avatar_url
      end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
