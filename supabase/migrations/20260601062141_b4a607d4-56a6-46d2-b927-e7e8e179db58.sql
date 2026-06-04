
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.current_clinic_id() from public, anon;
revoke execute on function public.register_clinic_owner(text, text) from public, anon;
