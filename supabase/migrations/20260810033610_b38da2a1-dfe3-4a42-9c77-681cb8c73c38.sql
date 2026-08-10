-- Appointment module tables (standalone; clinic_id mirrors the clinic app's id)
create table if not exists public.appointment_settings (
  clinic_id     uuid primary key,
  clinic_name   text,
  working_days  int[]  not null default '{1,2,3,4,5,6}',
  open_time     text   not null default '09:00',
  close_time    text   not null default '13:00',
  slot_minutes  int    not null default 20,
  break_start   text,
  break_end     text,
  holidays      text[] not null default '{}',
  updated_at    timestamptz not null default now()
);

grant select, insert, update, delete on public.appointment_settings to anon, authenticated;
grant all on public.appointment_settings to service_role;
alter table public.appointment_settings enable row level security;

drop policy if exists "appointment settings readable" on public.appointment_settings;
create policy "appointment settings readable"
  on public.appointment_settings for select to anon, authenticated using (true);

drop policy if exists "appointment settings writable" on public.appointment_settings;
create policy "appointment settings writable"
  on public.appointment_settings for all to anon, authenticated
  using (true) with check (true);

create table if not exists public.appointment_slots (
  id                     uuid primary key default gen_random_uuid(),
  clinic_id              uuid not null,
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

create unique index if not exists appointment_slots_unique_live
  on public.appointment_slots (clinic_id, slot_date, start_time)
  where status <> 'CANCELLED';

create index if not exists appointment_slots_clinic_date_idx
  on public.appointment_slots (clinic_id, slot_date);

-- No anon/authenticated table grants: rows hold patient PII and are reached
-- only through the SECURITY DEFINER functions below.
grant all on public.appointment_slots to service_role;
alter table public.appointment_slots enable row level security;

create or replace function public.public_booking_info(p_clinic uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'clinic_name', coalesce(s.clinic_name, 'Clinic'),
    'settings', json_build_object(
      'working_days', coalesce(s.working_days, array[1,2,3,4,5,6]),
      'open_time',    coalesce(s.open_time, '09:00'),
      'close_time',   coalesce(s.close_time, '13:00'),
      'slot_minutes', coalesce(s.slot_minutes, 20),
      'break_start',  s.break_start,
      'break_end',    s.break_end,
      'holidays',     coalesce(s.holidays, array[]::text[])
    )
  )
  from (select p_clinic as cid) base
  left join public.appointment_settings s on s.clinic_id = base.cid;
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

-- Staff-side reads of the reservation mirror (clinic-scoped).
create or replace function public.clinic_slot_rows(p_clinic uuid, p_date date default null)
returns setof public.appointment_slots
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.appointment_slots
  where clinic_id = p_clinic
    and (p_date is null or slot_date = p_date)
    and status <> 'CANCELLED'
  order by slot_date, start_time;
$$;

create or replace function public.clinic_update_slot_status(
  p_id uuid,
  p_status text,
  p_backend_id text default null
)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.appointment_slots
  set status = p_status,
      backend_appointment_id = coalesce(p_backend_id, backend_appointment_id)
  where id = p_id;
$$;

create or replace function public.clinic_reserve_slot(
  p_clinic uuid,
  p_date date,
  p_start text,
  p_end text,
  p_patient_id text,
  p_name text,
  p_phone text,
  p_visit_type text,
  p_reason text
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.appointment_slots
    (clinic_id, slot_date, start_time, end_time, patient_id, patient_name,
     patient_phone, visit_type, chief_complaint, status, booking_source)
  values
    (p_clinic, p_date, p_start, p_end, nullif(p_patient_id, ''), coalesce(p_name, ''),
     coalesce(p_phone, ''), p_visit_type, p_reason, 'CONFIRMED', 'receptionist')
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
revoke all on function public.clinic_slot_rows(uuid, date) from public;
revoke all on function public.clinic_update_slot_status(uuid, text, text) from public;
revoke all on function public.clinic_reserve_slot(uuid, date, text, text, text, text, text, text, text) from public;

grant execute on function public.public_booking_info(uuid) to anon, authenticated;
grant execute on function public.public_booked_times(uuid, date) to anon, authenticated;
grant execute on function public.public_book_slot(uuid, date, text, text, text, text, text) to anon, authenticated;
grant execute on function public.clinic_slot_rows(uuid, date) to anon, authenticated;
grant execute on function public.clinic_update_slot_status(uuid, text, text) to anon, authenticated;
grant execute on function public.clinic_reserve_slot(uuid, date, text, text, text, text, text, text, text) to anon, authenticated;