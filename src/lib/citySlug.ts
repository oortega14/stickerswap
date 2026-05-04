/**
 * Normaliza un nombre de ciudad para hacer match exacto entre usuarios:
 *   "Bogotá"        → "bogota"
 *   "San José"      → "san-jose"
 *   "  ARMENIA  "   → "armenia"
 *   "Quito #1!"     → "quito-1"
 */
export function citySlug(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacritics (combining marks)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")    // strip non-alphanumeric (preserve spaces and hyphens)
    .replace(/\s+/g, "-")            // spaces → hyphens
    .replace(/-+/g, "-")             // collapse multiple hyphens
    .replace(/^-|-$/g, "");          // trim leading/trailing hyphens
}
