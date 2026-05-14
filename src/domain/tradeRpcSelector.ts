export type FriendshipStateForRpc = { status: "pending" | "accepted" | "blocked" | "rejected" } | null;

/**
 * Decide qué RPC usar para proponer un trueque según el estado de amistad.
 *
 * - 'insert': amistad ya aceptada → insert directo en `trades` (la RLS valida).
 * - 'combo': sin relación previa o pending → llamar al RPC trade_propose_combo
 *   que crea friendship pending (si hace falta) + trade pending atómicos.
 *
 * Tira 'friendship_blocked' si el otro nos bloqueó o rechazó previamente.
 */
export function pickProposeRpc(friendship: FriendshipStateForRpc): "insert" | "combo" {
  if (!friendship) return "combo";
  switch (friendship.status) {
    case "accepted":
      return "insert";
    case "pending":
      return "combo";
    case "blocked":
    case "rejected":
      throw new Error("friendship_blocked");
  }
}
