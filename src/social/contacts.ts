import { supabase } from "@/auth/supabaseClient";

export interface UserContacts {
  whatsapp: string | null;
  instagram: string | null;
}

interface ContactRow {
  user_id: string;
  whatsapp: string | null;
  instagram: string | null;
}

export async function fetchUserContacts(userId: string): Promise<UserContacts | null> {
  const { data, error } = await supabase
    .from("user_contacts")
    .select("user_id, whatsapp, instagram")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as ContactRow;
  return { whatsapp: row.whatsapp, instagram: row.instagram };
}

export async function updateMyContacts(userId: string, c: UserContacts): Promise<void> {
  const payload = {
    user_id: userId,
    whatsapp: c.whatsapp ? c.whatsapp.trim() : null,
    instagram: c.instagram ? c.instagram.trim() : null,
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase
    .from("user_contacts")
    .upsert(payload, { onConflict: "user_id" });
  if (error) throw error;
}

/**
 * Normaliza un número de WhatsApp a la forma que `wa.me` espera (solo dígitos).
 * Si el input no parece un número válido, devuelve null.
 */
export function normalizeWhatsapp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return null; // muy corto para ser un número real
  return digits;
}

/**
 * Normaliza un handle de Instagram (quita @, espacios, valida charset).
 */
export function normalizeInstagram(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const handle = raw.trim().replace(/^@/, "");
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(handle)) return null;
  return handle;
}

export function whatsappUrl(raw: string | null | undefined): string | null {
  const digits = normalizeWhatsapp(raw);
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

export function instagramUrl(raw: string | null | undefined): string | null {
  const handle = normalizeInstagram(raw);
  if (!handle) return null;
  return `https://instagram.com/${handle}`;
}
