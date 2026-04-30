export interface CountUpdate {
  count: number;
  updatedAt: number;
}

export function resolveConflict(
  local: CountUpdate | null,
  remote: CountUpdate | null
): CountUpdate | null {
  if (!local) return remote;
  if (!remote) return local;
  return remote.updatedAt >= local.updatedAt ? remote : local;
}
