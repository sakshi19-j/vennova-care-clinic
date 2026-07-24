// Clinic profile + branding asset uploads.
// Profile fields are persisted via the existing Railway /settings/clinic endpoint.
// Logo and signature files are uploaded to the Supabase `clinic-branding` bucket
// and their public URLs are saved into logo_url / signature_url.

import { api } from "@/lib/api-client";
import { supabase } from "@/integrations/supabase/client";

export type ClinicProfile = {
  name?: string;
  clinic_name?: string;
  doctor_name?: string;
  qualification?: string;
  registration_number?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  timings?: string;
  clinic_type?: string;
  logo_url?: string;
  signature_url?: string;
  primary_color?: string;
  secondary_color?: string;
  footer_text?: string;
  website?: string;
  [k: string]: unknown;
};

const BRANDING_BUCKET = "clinic-branding";

/** Return the value only when it parses as a well-formed absolute URL.
 *  Blank strings, undefined, and half-typed values return undefined so
 *  callers can skip `new URL(...)` construction without throwing. */
export function safeBrandingUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    // new URL throws on empty / malformed strings — guarded above.
    // eslint-disable-next-line no-new
    new URL(trimmed);
    return trimmed;
  } catch {
    return undefined;
  }
}

export const clinicProfileService = {
  get: () => api.get<ClinicProfile>("/auth/clinic"),
  update: (body: ClinicProfile) => {
    // Never send a blank / half-typed URL to the backend; skip the field.
    const cleaned: ClinicProfile = { ...body };
    if ("logo_url" in cleaned) cleaned.logo_url = safeBrandingUrl(cleaned.logo_url);
    if ("signature_url" in cleaned) cleaned.signature_url = safeBrandingUrl(cleaned.signature_url);
    return api.put<ClinicProfile>("/auth/clinic", cleaned);
  },

  async uploadBrandingAsset(
    kind: "logo" | "signature",
    file: File,
  ): Promise<string> {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id ?? "anon";
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${uid}/${kind}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from(BRANDING_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type || undefined });

    if (error) {
      const msg = error.message || "Upload failed";
      if (/bucket.*not.*found/i.test(msg)) {
        throw new Error(
          `Supabase storage bucket "${BRANDING_BUCKET}" is missing. Create it in Lovable Cloud → Storage and retry.`,
        );
      }
      throw new Error(msg);
    }

    const { data: pub } = supabase.storage.from(BRANDING_BUCKET).getPublicUrl(path);
    return pub.publicUrl;
  },
};
