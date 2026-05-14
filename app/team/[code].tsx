// Ruta legacy: /team/[code] redirige a /album/[id]. Lo conservamos para que
// links externos o deep links viejos sigan funcionando.
import { Redirect, useLocalSearchParams } from "expo-router";

export default function TeamRedirect() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <Redirect href={`/album/${encodeURIComponent(code ?? "")}`} />;
}
