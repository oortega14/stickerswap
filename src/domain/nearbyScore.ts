import type { NearbyMatch, NearbyMatchRaw } from "./types";

/**
 * Calcula score = min(theyHaveINeed, iHaveTheyNeed) para cada match,
 * filtra los que tengan score < 1 (sin trade bidireccional posible),
 * y ordena por score desc, desempatando alfabéticamente por username.
 */
export function rankNearbyMatches(raw: NearbyMatchRaw[]): NearbyMatch[] {
  return raw
    .map((m) => ({ ...m, score: Math.min(m.theyHaveINeed, m.iHaveTheyNeed) }))
    .filter((m) => m.score >= 1)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.username.localeCompare(b.username);
    });
}
