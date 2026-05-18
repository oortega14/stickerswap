// Ruta legacy: /team/[code] redirige a /?expand=<id>. Lo conservamos para que
// links externos o deep links viejos sigan funcionando.
import { Redirect, useLocalSearchParams } from "expo-router";

export default function TeamRedirect() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <Redirect href={`/?expand=${encodeURIComponent(code ?? "")}`} />;
}
