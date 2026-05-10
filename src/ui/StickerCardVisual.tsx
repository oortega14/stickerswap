// src/ui/StickerCardVisual.tsx
//
// Renderiza el visual SVG dentro de la card de un sticker en team page.
// Switch por sticker.type: player → camiseta con iniciales, team_badge →
// escudo heater con código FIFA, team_photo → grilla 3×3 de mini-camisetas.
// Otros tipos (icon/special) no aparecen en team page → render null.

import React from "react";
import Svg, { Path, G, Text as SvgText } from "react-native-svg";
import type { Sticker } from "@/domain/types";
import { getTeamColors, type TeamColors } from "@/theme/teamColors";
import { darkenHex, luminance } from "@/theme/colorUtils";
import { getInitials } from "@/domain/playerInitials";

interface Props {
  sticker: Sticker;
  // Color del View que envuelve este SVG. Lo usamos para "carve out"
  // visualmente el cuello de la camiseta (que en realidad es un Path
  // sólido encima del body con este color).
  cardBgColor: string;
}

function pickSleeveColor(colors: TeamColors): string {
  return luminance(colors.bg) < 0.10 ? colors.accent : darkenHex(colors.bg, 0.20);
}

function pickShieldDarkColor(colors: TeamColors): string {
  const dark = darkenHex(colors.bg, 0.50);
  return dark === colors.bg ? colors.accent : dark;
}

// Body + sleeves + neck cutout. viewBox 0..100.
function JerseyShape({
  body,
  sleeves,
  neck
}: {
  body: string;
  sleeves: string;
  neck: string;
}) {
  return (
    <>
      <Path d="M 8,28 L 28,18 L 32,40 L 18,42 Z" fill={sleeves} />
      <Path d="M 92,28 L 72,18 L 68,40 L 82,42 Z" fill={sleeves} />
      <Path
        d="M 28,18 Q 38,12 50,16 Q 62,12 72,18 L 78,28 L 78,90 Q 78,94 74,94 L 26,94 Q 22,94 22,90 L 22,28 Z"
        fill={body}
      />
      <Path d="M 38,15 Q 50,22 62,15 L 60,12 Q 50,18 40,12 Z" fill={neck} />
    </>
  );
}

function JerseyVisual({
  initials,
  colors,
  cardBgColor
}: {
  initials: string;
  colors: TeamColors;
  cardBgColor: string;
}) {
  const sleeves = pickSleeveColor(colors);
  return (
    <Svg viewBox="0 0 100 100" width="100%" height="100%">
      <JerseyShape body={colors.bg} sleeves={sleeves} neck={cardBgColor} />
      <SvgText
        x="50"
        y="62"
        textAnchor="middle"
        fontSize="22"
        fontWeight="900"
        fontFamily="Impact, Arial Black, sans-serif"
        letterSpacing="3"
        fill={colors.bgText}
      >
        {initials}
      </SvgText>
    </Svg>
  );
}

function ShieldVisual({ code, colors }: { code: string; colors: TeamColors }) {
  const dark = pickShieldDarkColor(colors);
  return (
    <Svg viewBox="0 0 100 100" width="100%" height="100%">
      {/* Heater shield body */}
      <Path
        d="M 22,18 L 78,18 L 78,55 Q 78,82 50,92 Q 22,82 22,55 Z"
        fill={colors.bg}
        stroke={dark}
        strokeWidth="2.5"
      />
      {/* Top dark band */}
      <Path d="M 22,18 L 78,18 L 78,30 L 22,30 Z" fill={dark} opacity="0.85" />
      {/* 3 stars on band */}
      <SvgText x="32" y="27" fontSize="10" fill={colors.accent}>
        ★
      </SvgText>
      <SvgText x="50" y="27" fontSize="10" fill={colors.accent} textAnchor="middle">
        ★
      </SvgText>
      <SvgText x="68" y="27" fontSize="10" fill={colors.accent} textAnchor="end">
        ★
      </SvgText>
      {/* FIFA code */}
      <SvgText
        x="50"
        y="65"
        textAnchor="middle"
        fontSize="22"
        fontWeight="900"
        fontFamily="Impact, Arial Black, sans-serif"
        letterSpacing="2"
        fill={colors.bgText}
      >
        {code}
      </SvgText>
    </Svg>
  );
}

// 9 mini-camisetas SIN cuello (no haría falta a ese tamaño). Usa el mismo
// JerseyShape pero con neck=sleeves para que el cutout no sea visible.
function SquadGridVisual({ colors }: { colors: TeamColors }) {
  const sleeves = pickSleeveColor(colors);
  const positions: Array<[number, number]> = [
    [14, 14],
    [38, 14],
    [62, 14],
    [14, 38],
    [38, 38],
    [62, 38],
    [14, 62],
    [38, 62],
    [62, 62]
  ];
  return (
    <Svg viewBox="0 0 100 100" width="100%" height="100%">
      {positions.map(([x, y]) => (
        <G key={`${x}-${y}`} transform={`translate(${x}, ${y}) scale(0.18)`}>
          <JerseyShape body={colors.bg} sleeves={sleeves} neck={sleeves} />
        </G>
      ))}
    </Svg>
  );
}

export function StickerCardVisual({ sticker, cardBgColor }: Props) {
  const teamCode = sticker.team ?? "";
  const colors = getTeamColors(teamCode);

  switch (sticker.type) {
    case "player":
      return (
        <JerseyVisual
          initials={getInitials(sticker.name)}
          colors={colors}
          cardBgColor={cardBgColor}
        />
      );
    case "team_badge":
      return <ShieldVisual code={teamCode || "?"} colors={colors} />;
    case "team_photo":
      return <SquadGridVisual colors={colors} />;
    default:
      return null;
  }
}
