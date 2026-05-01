import React from "react";
import { Pressable, Text, View } from "react-native";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row bg-space-dark rounded-lg p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityLabel={opt.label}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={`flex-1 py-2 rounded-md ${active ? "bg-space-purple" : ""}`}
          >
            <Text
              className={`text-center text-xs font-semibold ${active ? "text-white" : "text-space-mute"}`}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
