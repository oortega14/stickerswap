import Constants from "expo-constants";

export const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";
export const BUILD_NUMBER =
  Constants.expoConfig?.ios?.buildNumber ??
  String(Constants.expoConfig?.android?.versionCode ?? 1);
