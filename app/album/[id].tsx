import { useLocalSearchParams } from "expo-router";
import { AlbumScroll } from "@/ui/AlbumScroll";

export default function AlbumPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const decoded = decodeURIComponent(id ?? "");
  return <AlbumScroll startId={decoded} />;
}
