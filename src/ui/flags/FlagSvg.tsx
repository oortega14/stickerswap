import React from "react";
import { View, Text, Image } from "react-native";
import { FLAG_PNG } from "./flagMap";
import { IntroBadge } from "./specialBadges/IntroBadge";
import { ExtrasBadge } from "./specialBadges/ExtrasBadge";
import { StarsBadge } from "./specialBadges/StarsBadge";

interface Props {
  code: string | null;          // código de país, o null para especiales
  section?: string;             // requerido si code === null
  size?: number;                // ancho/alto en px; default ocupa el contenedor
}

// Pese al nombre legacy ("FlagSvg"), las banderas de pais son PNG @1x/@2x/@3x
// para render instantaneo via hardware. Solo Intro/Extras/Estrellas siguen
// siendo SVG porque son badges custom hechos a mano.
export function FlagSvg({ code, section, size }: Props) {
  const source = code ? FLAG_PNG[code] : undefined;
  if (source) {
    return (
      <Image
        source={source}
        style={
          size != null
            ? { width: size, height: size }
            : { width: "100%", height: "100%" }
        }
        resizeMode="cover"
      />
    );
  }
  if (section === "Intro")     return <IntroBadge size={size} />;
  if (section === "Extras")    return <ExtrasBadge size={size} />;
  if (section === "Estrellas") return <StarsBadge size={size} />;

  return (
    <View
      style={{
        width: size ?? "100%",
        height: size ?? "100%",
        backgroundColor: "#a8a29e",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
        {code ?? section?.slice(0, 3).toUpperCase() ?? "?"}
      </Text>
    </View>
  );
}
