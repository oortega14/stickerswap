// Ruta legacy: /section/[name] redirige a /?expand=<id>. Lo conservamos para
// que links externos o deep links viejos sigan funcionando.
import { Redirect, useLocalSearchParams } from "expo-router";

export default function SectionRedirect() {
  const { name } = useLocalSearchParams<{ name: string }>();
  return <Redirect href={`/?expand=${encodeURIComponent(name ?? "")}`} />;
}
