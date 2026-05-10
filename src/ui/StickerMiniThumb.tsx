import { View, Text, Pressable } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { getTeamColors } from "@/theme/teamColors";
import { useStickerDetail } from "@/hooks/useStickers";

interface Props {
  code: string;
  onPress?: () => void;
}

export function StickerMiniThumb({ code, onPress }: Props) {
  const { theme } = useTheme();
  const { data: sticker } = useStickerDetail(code);
  const teamColors = sticker?.team ? getTeamColors(sticker.team) : null;
  const bg = teamColors?.bg ?? theme.accent;
  const fg = teamColors?.bgText ?? "#ffffff";

  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`Cromo ${code}`}
      style={{
        minWidth: 44,
        height: 40,
        paddingHorizontal: 4,
        borderRadius: 4,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 4,
        marginBottom: 4,
        borderWidth: 1,
        borderColor: theme.border
      }}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={{ color: fg, fontWeight: "700", fontSize: 11 }}
      >
        {code}
      </Text>
    </Wrapper>
  );
}
