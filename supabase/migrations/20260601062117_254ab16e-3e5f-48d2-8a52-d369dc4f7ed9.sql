
-- Enum for app roles
create type public.app_role as enum ('reception', 'allopathy', 'homeopathy', 'admin');

-- Clinics
create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.clinics to authenticated;
grant all on public.clinics to service_role;
alter table public.clinics enable row level security;

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create index profiles_clinic_id_idx on public.profiles(clinic_id);

-- User roles (separate table — never on profiles)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create index user_roles_user_id_idx on public.user_roles(user_id);

-- Security-definer helpers (avoid RLS recursion)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.current_clinic_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select clinic_id from public.profiles where id = auth.uid()
$$;

-- Policies: clinics
create policy "Members can view their clinic"
on public.clinics for select to authenticated
using (id = public.current_clinic_id());

create policy "Admins can update their clinic"
on public.clinics for update to authenticated
using (id = public.current_clinic_id() and public.has_role(auth.uid(), 'admin'));

-- Policies: profiles
create policy "Users can view profiles in their clinic"
on public.profiles for select to authenticated
using (clinic_id = public.current_clinic_id());

create policy "Users can update own profile"
on public.profiles for update to authenticated
using (id = auth.uid());

-- Policies: user_roles
create policy "Users can view roles in their clinic"
on public.user_roles for select to authenticated
using (clinic_id = public.current_clinic_id());

-- Owner registration: creates a clinic + admin profile in one trusted call.
-- Runs as security definer; only allowed when the caller has no profile yet.
create or replace function public.register_clinic_owner(
  _clinic_name text,
  _full_name text
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _email text;
  _clinic_id uuid;
begin
  if _uid is null then
    raise exception 'Not authenticated';
  end if;
  if exists (select 1 from public.profiles where id = _uid) then
    raise exception 'Profile already exists';
  end if;

  select email into _email from auth.users where id = _uid;

  insert into public.clinics (name, owner_id) values (_clinic_name, _uid)
  returning id into _clinic_id;

  insert into public.profiles (id, clinic_id, full_name, email)
  values (_uid, _clinic_id, coalesce(_full_name, ''), _email);

  insert into public.user_roles (user_id, clinic_id, role)
  values (_uid, _clinic_id, 'admin');

  return _clinic_id;
end;
$$;

grant execute on function public.register_clinic_owner(text, text) to authenticated;
