import React from "react";
import { View } from "react-native";
import { Skeleton } from "./Skeleton";

export function SkeletonAlbumGrid({ rows = 6 }: { rows?: number }) {
  const total = rows * 4;
  return (
    <View className="flex-row flex-wrap">
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={{ flexBasis: "25%", padding: 4 }}>
          <Skeleton style={{ aspectRatio: 1 }} />
        </View>
      ))}
    </View>
  );
}
