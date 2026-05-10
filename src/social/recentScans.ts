// Recordamos qué IDs acabamos de agregar nosotros mismos por QR para suprimir
// el snackbar "te escanearon" que llegará por realtime tras nuestro propio scan.
// El payload del row no distingue lado scanner vs lado escaneado, así que
// usamos esta marca local con TTL para diferenciar.

const TTL_MS = 10_000;
const seen = new Map<string, number>();

export function markScanned(otherId: string): void {
  seen.set(otherId, Date.now() + TTL_MS);
}

export function justScanned(otherId: string): boolean {
  const exp = seen.get(otherId);
  if (exp === undefined) return false;
  if (exp < Date.now()) {
    seen.delete(otherId);
    return false;
  }
  return true;
}

export function _resetForTest(): void {
  seen.clear();
}
