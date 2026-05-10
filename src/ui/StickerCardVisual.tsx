// src/ui/StickerCardVisual.tsx
//
// Renderiza el visual SVG dentro de la card de un sticker en team page.
// Switch por sticker.type: player → camiseta con iniciales, team_badge →
// escudo heater con código FIFA, team_photo → grilla 3×3 de mini-camisetas.
// Otros tipos (icon/special) no aparecen en team page → render null.
//
// Cada equipo puede tener un diseño de camiseta custom en teamJerseys.ts
// (body, sleeves, iniciales, franjas). Si no está registrado, derivamos del
// teamColors via pickSleeveColor.

import React from "react";
import Svg, { Path, G, Defs, ClipPath, Rect, Circle, Text as SvgText } from "react-native-svg";
import type { Sticker } from "@/domain/types";
import { getTeamColors, type TeamColors } from "@/theme/teamColors";
import { darkenHex, luminance } from "@/theme/colorUtils";
import {
  getTeamJersey,
  type JerseyDesign,
  type JerseyStripes,
  type JerseyStripesLayout
} from "@/theme/teamJerseys";
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

const BODY_PATH =
  "M 28,18 Q 38,12 50,16 Q 62,12 72,18 L 78,28 L 78,90 Q 78,94 74,94 L 26,94 Q 22,94 22,90 L 22,28 Z";

interface StripeRect {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}

function stripesToRects(layout: JerseyStripesLayout, colors: string[]): StripeRect[] {
  switch (layout) {
    case "side-vertical": {
      const stripeW = 4;
      return colors.map((c, i) => ({ x: 22 + i * stripeW, y: 18, w: stripeW, h: 76, fill: c }));
    }
    case "chest-horizontal": {
      const stripeH = 6;
      return colors.map((c, i) => ({ x: 0, y: 22 + i * stripeH, w: 100, h: stripeH, fill: c }));
    }
    case "full-horizontal": {
      const stripeH = 9;
      return colors.map((c, i) => ({ x: 0, y: 32 + i * stripeH, w: 100, h: stripeH, fill: c }));
    }
    case "full-vertical": {
      const totalW = 56;
      const stripeW = totalW / colors.length;
      return colors.map((c, i) => ({ x: 22 + i * stripeW, y: 18, w: stripeW, h: 76, fill: c }));
    }
  }
}

function StripesOverlay({ stripes, clipId }: { stripes: JerseyStripes; clipId: string }) {
  const rects = stripesToRects(stripes.layout, stripes.colors);
  return (
    <>
      <Defs>
        <ClipPath id={clipId}>
          <Path d={BODY_PATH} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        {rects.map((r, i) => (
          <Rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />
        ))}
      </G>
    </>
  );
}

// Body + sleeves + (optional stripes) + neck cutout. viewBox 0..100.
function JerseyShape({
  body,
  sleeves,
  neck,
  stripes,
  clipId
}: {
  body: string;
  sleeves: string;
  neck: string;
  stripes?: JerseyStripes;
  clipId?: string;
}) {
  return (
    <>
      <Path d="M 8,28 L 28,18 L 32,40 L 18,42 Z" fill={sleeves} />
      <Path d="M 92,28 L 72,18 L 68,40 L 82,42 Z" fill={sleeves} />
      <Path d={BODY_PATH} fill={body} />
      {stripes && clipId && <StripesOverlay stripes={stripes} clipId={clipId} />}
      <Path d="M 38,15 Q 50,22 62,15 L 60,12 Q 50,18 40,12 Z" fill={neck} />
    </>
  );
}

function JerseyVisual({
  initials,
  colors,
  cardBgColor,
  override,
  clipId
}: {
  initials: string;
  colors: TeamColors;
  cardBgColor: string;
  override: JerseyDesign | null;
  clipId: string;
}) {
  const body = override?.body ?? colors.bg;
  const sleeves = override?.sleeves ?? pickSleeveColor(colors);
  const initialsColor = override?.initialsColor ?? colors.bgText;
  const initialsX = 50 + (override?.initialsXOffset ?? 0);
  return (
    <Svg viewBox="0 0 100 100" width="100%" height="100%">
      <JerseyShape
        body={body}
        sleeves={sleeves}
        neck={cardBgColor}
        stripes={override?.stripes}
        clipId={clipId}
      />
      <SvgText
        x={initialsX}
        y="62"
        textAnchor="middle"
        fontSize="22"
        fontWeight="900"
        fontFamily="Impact, Arial Black, sans-serif"
        letterSpacing="3"
        fill={initialsColor}
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
      <Path
        d="M 22,18 L 78,18 L 78,55 Q 78,82 50,92 Q 22,82 22,55 Z"
        fill={colors.bg}
        stroke={dark}
        strokeWidth="2.5"
      />
      <Path d="M 22,18 L 78,18 L 78,30 L 22,30 Z" fill={dark} opacity="0.85" />
      <SvgText x="32" y="27" fontSize="10" fill={colors.accent}>
        ★
      </SvgText>
      <SvgText x="50" y="27" fontSize="10" fill={colors.accent} textAnchor="middle">
        ★
      </SvgText>
      <SvgText x="68" y="27" fontSize="10" fill={colors.accent} textAnchor="end">
        ★
      </SvgText>
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

// Visual genérico para tipos icon/special (Intro/Extras/Coca-Cola) que no
// tienen equipo. Círculo con el código del sticker centrado en color accent.
function GenericVisual({ code, colors }: { code: string; colors: TeamColors }) {
  const fontSize = code.length > 4 ? 14 : 20;
  return (
    <Svg viewBox="0 0 100 100" width="100%" height="100%">
      <Circle cx="50" cy="52" r="36" fill={colors.bg} />
      <SvgText
        x="50"
        y={52 + fontSize / 3}
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight="900"
        fontFamily="Impact, Arial Black, sans-serif"
        letterSpacing="1"
        fill={colors.bgText}
      >
        {code}
      </SvgText>
    </Svg>
  );
}

// 9 mini-camisetas SIN cuello (no haría falta a ese tamaño). Las franjas se
// omiten porque a 18% de escala son básicamente invisibles.
function SquadGridVisual({
  colors,
  override
}: {
  colors: TeamColors;
  override: JerseyDesign | null;
}) {
  const body = override?.body ?? colors.bg;
  const sleeves = override?.sleeves ?? pickSleeveColor(colors);
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
          <JerseyShape body={body} sleeves={sleeves} neck={sleeves} />
        </G>
      ))}
    </Svg>
  );
}

export function StickerCardVisual({ sticker, cardBgColor }: Props) {
  const teamCode = sticker.team ?? "";
  const colors = getTeamColors(teamCode);
  const override = getTeamJersey(teamCode);

  switch (sticker.type) {
    case "player":
      return (
        <JerseyVisual
          initials={getInitials(sticker.name)}
          colors={colors}
          cardBgColor={cardBgColor}
          override={override}
          clipId={`bc-${sticker.code}`}
        />
      );
    case "team_badge":
      return <ShieldVisual code={teamCode || "?"} colors={colors} />;
    case "team_photo":
      return <SquadGridVisual colors={colors} override={override} />;
    case "icon":
    case "special":
      return <GenericVisual code={sticker.code} colors={colors} />;
    default:
      return null;
  }
}
