// Apple Sign-In está deshabilitado por ahora — requiere licencia paga de Apple
// Developer para que la entitlement com.apple.developer.applesignin funcione.
// Cuando llegue la licencia, reinstalar `expo-apple-authentication` y restaurar
// el contenido original (ver git log).

export async function isAppleAvailable(): Promise<boolean> {
  return false;
}

export async function signInWithApple(): Promise<void> {
  throw new Error("Apple Sign-In no disponible en esta build.");
}
