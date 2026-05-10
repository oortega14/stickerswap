// src/domain/playerInitials.ts
//
// Extrae 2 caracteres en mayúscula del nombre de un jugador para
// renderizarlos como "dorsal" sobre la camiseta de la card.
//
// Algoritmo:
// 1. Split por whitespace.
// 2. Por cada token, strip todo lo que no sea letra ("K." → "K", "J.J." → "JJ").
// 3. Filtrar tokens que quedan vacíos.
// 4. Si quedan ≥2 tokens: primera letra del primero + primera letra del último.
// 5. Si queda 1 token: primeras 2 letras si tiene ≥2, o esa única letra si tiene 1.
// 6. Si quedan 0 tokens (o input null/empty): "??".

export function getInitials(name: string | null | undefined): string {
  if (!name || typeof name !== "string") return "??";
  const tokens = name.split(/\s+/).filter(Boolean);
  const cleaned = tokens.map((t) => t.replace(/[^\p{L}]/gu, "")).filter(Boolean);
  if (cleaned.length === 0) return "??";
  if (cleaned.length === 1) {
    const t = cleaned[0];
    return t.length >= 2 ? t.slice(0, 2).toUpperCase() : t.toUpperCase();
  }
  return (cleaned[0][0] + cleaned[cleaned.length - 1][0]).toUpperCase();
}
