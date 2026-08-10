/* eslint-disable @typescript-eslint/no-explicit-any */
// The clinic auth/database project holds `profiles`, `user_roles` and `clinics`.
// Those tables live outside Lovable Cloud, so the generated `Database` type does
// not describe them. This helper exposes the same runtime clients with a loose
// schema type so clinic-side queries keep compiling.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./client";

export type ClinicClient = SupabaseClient<any, "public", any>;

/** Browser client pointed at the clinic project, untyped schema. */
export const clinicDb = supabase as unknown as ClinicClient;

/** Cast any Supabase client to the clinic (untyped) schema. */
export const asClinicDb = (client: unknown): ClinicClient => client as ClinicClient;
