import React from "react";
import { View, Text } from "react-native";
import { SvgXml } from "react-native-svg";
import { FLAG_MAP } from "./flagMap";

interface Props {
  code: string | null;          // FIFA code, o null para especiales
  section?: string;             // requerido si code === null
  size?: number;                // ancho/alto en px; default ocupa el contenedor
}

export function FlagSvg({ code, section, size }: Props) {
  if (code && FLAG_MAP[code]) {
    return (
      <SvgXml
        xml={FLAG_MAP[code]}
        width={size ?? "100%"}
        height={size ?? "100%"}
        preserveAspectRatio="xMidYMid slice"
      />
    );
  }
  // Fallback visual mientras el badge especial todavia no esta listo
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
