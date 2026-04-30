import * as H from "expo-haptics";

export const haptics = {
  light: () => H.impactAsync(H.ImpactFeedbackStyle.Light),
  medium: () => H.impactAsync(H.ImpactFeedbackStyle.Medium),
  heavy: () => H.impactAsync(H.ImpactFeedbackStyle.Heavy),
  success: () => H.notificationAsync(H.NotificationFeedbackType.Success),
  warning: () => H.notificationAsync(H.NotificationFeedbackType.Warning),
  error: () => H.notificationAsync(H.NotificationFeedbackType.Error)
};
