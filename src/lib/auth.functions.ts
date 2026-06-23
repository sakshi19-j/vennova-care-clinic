import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const StaffRoleSchema = z.enum(["reception", "allopathy", "homeopathy", "admin"]);

const CreateStaffSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  fullName: z.string().trim().min(1).max(120),
  role: StaffRoleSchema,
});

export const createStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => CreateStaffSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Caller must be admin of a clinic.
    const { data: callerRole } = await supabase
      .from("user_roles")
      .select("role, clinic_id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!callerRole) throw new Error("Only clinic admins can add staff.");
    const clinicId = callerRole.clinic_id;

    // Create the auth user with the service-role admin client (email pre-confirmed
    // so the staffer can sign in immediately with the owner-issued credentials).
    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.fullName },
      });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Could not create user.");
    }

    const newUserId = created.user.id;

    const { error: profileErr } = await supabaseAdmin.from("profiles").insert({
      id: newUserId,
      clinic_id: clinicId,
      full_name: data.fullName,
      email: data.email,
    });
    if (profileErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error(profileErr.message);
    }

    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: newUserId,
      clinic_id: clinicId,
      role: data.role,
    });
    if (roleErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error(roleErr.message);
    }

    return { id: newUserId, email: data.email, fullName: data.fullName, role: data.role };
  });

export const deleteStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.userId === userId) throw new Error("You can't remove yourself.");

    const { data: callerRole } = await supabase
      .from("user_roles")
      .select("clinic_id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!callerRole) throw new Error("Only clinic admins can remove staff.");

    // Confirm target belongs to same clinic.
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("clinic_id")
      .eq("id", data.userId)
      .maybeSingle();
    if (!target || target.clinic_id !== callerRole.clinic_id) {
      throw new Error("Staff member not found in your clinic.");
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
