-- Vennova · Appointment module schema
-- Run this once against the clinic database (SQL editor) to enable
-- clinic scheduling settings, slot reservations and the public booking link.
-- Everything here is appointment-only; no existing table is modified.

-- 1. Clinic scheduling settings ------------------------------------------
create table if not exists public.appointment_settings (
  clinic_id     uuid primary key references public.clinics(id) on delete cascade,
  working_days  int[]  not null default '{1,2,3,4,5,6}',
  open_time     text   not null default '09:00',
  close_time    text   not null default '13:00',
  slot_minutes  int    not null default 20,
  break_start   text,
  break_end     text,
  holidays      text[] not null default '{}',
  updated_at    timestamptz not null default now()
);

grant select, insert, update, delete on public.appointment_settings to authenticated;
grant all on public.appointment_settings to service_role;
alter table public.appointment_settings enable row level security;

drop policy if exists "clinic reads own appointment settings" on public.appointment_settings;
create policy "clinic reads own appointment settings"
  on public.appointment_settings for select to authenticated
  using (clinic_id = public.current_clinic_id());

drop policy if exists "clinic writes own appointment settings" on public.appointment_settings;
create policy "clinic writes own appointment settings"
  on public.appointment_settings for all to authenticated
  using (clinic_id = public.current_clinic_id())
  with check (clinic_id = public.current_clinic_id());

-- 2. Slot reservations (double-booking guard + public requests) -----------
create table if not exists public.appointment_slots (
  id                     uuid primary key default gen_random_uuid(),
  clinic_id              uuid not null references public.clinics(id) on delete cascade,
  slot_date              date not null,
  start_time             text not null,
  end_time               text not null,
  patient_id             text,
  patient_name           text not null default '',
  patient_phone          text not null default '',
  visit_type             text,
  chief_complaint        text,
  status                 text not null default 'CONFIRMED',
  booking_source         text not null default 'receptionist',
  backend_appointment_id text,
  created_at             timestamptz not null default now()
);

-- The double-booking guard: one live appointment per clinic + date + time.
create unique index if not exists appointment_slots_unique_live
  on public.appointment_slots (clinic_id, slot_date, start_time)
  where status <> 'CANCELLED';

create index if not exists appointment_slots_clinic_date_idx
  on public.appointment_slots (clinic_id, slot_date);

grant select, insert, update, delete on public.appointment_slots to authenticated;
grant all on public.appointment_slots to service_role;
alter table public.appointment_slots enable row level security;

drop policy if exists "clinic manages own slots" on public.appointment_slots;
create policy "clinic manages own slots"
  on public.appointment_slots for all to authenticated
  using (clinic_id = public.current_clinic_id())
  with check (clinic_id = public.current_clinic_id());

-- 3. Public booking link (no patient login) --------------------------------
-- Anonymous visitors never touch the tables directly; these SECURITY DEFINER
-- functions expose only clinic name, schedule settings and busy slot times.

create or replace function public.public_booking_info(p_clinic uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'clinic_name', c.name,
    'settings', coalesce(
      (select to_json(s) from public.appointment_settings s where s.clinic_id = c.id),
      json_build_object(
        'working_days', array[1,2,3,4,5,6],
        'open_time', '09:00',
        'close_time', '13:00',
        'slot_minutes', 20,
        'break_start', null,
        'break_end', null,
        'holidays', array[]::text[]
      )
    )
  )
  from public.clinics c
  where c.id = p_clinic;
$$;

create or replace function public.public_booked_times(p_clinic uuid, p_date date)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select start_time
  from public.appointment_slots
  where clinic_id = p_clinic
    and slot_date = p_date
    and status <> 'CANCELLED';
$$;

create or replace function public.public_book_slot(
  p_clinic uuid,
  p_date   date,
  p_start  text,
  p_end    text,
  p_name   text,
  p_phone  text,
  p_reason text default null
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_date < current_date then
    return json_build_object('ok', false, 'reason', 'past');
  end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_phone), '') = '' then
    return json_build_object('ok', false, 'reason', 'invalid');
  end if;
  if not exists (select 1 from public.clinics where id = p_clinic) then
    return json_build_object('ok', false, 'reason', 'invalid');
  end if;

  insert into public.appointment_slots
    (clinic_id, slot_date, start_time, end_time, patient_name, patient_phone,
     chief_complaint, status, booking_source)
  values
    (p_clinic, p_date, p_start, p_end, left(trim(p_name), 120), left(trim(p_phone), 20),
     left(coalesce(p_reason, ''), 300), 'PENDING', 'patient_link')
  returning id into v_id;

  return json_build_object('ok', true, 'id', v_id);
exception
  when unique_violation then
    return json_build_object('ok', false, 'reason', 'taken');
end;
$$;

revoke all on function public.public_booking_info(uuid) from public;
revoke all on function public.public_booked_times(uuid, date) from public;
revoke all on function public.public_book_slot(uuid, date, text, text, text, text, text) from public;

grant execute on function public.public_booking_info(uuid) to anon, authenticated;
grant execute on function public.public_booked_times(uuid, date) to anon, authenticated;
grant execute on function public.public_book_slot(uuid, date, text, text, text, text, text) to anon, authenticated;
