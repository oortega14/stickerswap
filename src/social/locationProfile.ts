import { supabase } from "@/auth/supabaseClient";
import { citySlug } from "@/lib/citySlug";

export interface LocationUpdate {
  country: string | null;     // ISO-2 ('CO', 'MX', 'OT', …) o null para limpiar
  cityLabel: string | null;   // 'Armenia' (display) o null
  discoverable: boolean;
}

/**
 * Persiste país, ciudad y flag de discoverable. La validación de constraint la
 * hace Postgres (discoverable=true requiere country y city_slug no nulos).
 */
export async function updateLocation(userId: string, u: LocationUpdate): Promise<void> {
  const slug = u.cityLabel ? citySlug(u.cityLabel) : null;
  const { error } = await supabase
    .from("profiles")
    .update({
      country: u.country,
      city_label: u.cityLabel,
      city_slug: slug,
      discoverable: u.discoverable
    })
    .eq("id", userId);
  if (error) throw error;
}
