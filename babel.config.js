module.exports = function (api) {
  const isTest = api.env("test");
  api.cache.using(() => process.env.NODE_ENV);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      ...(isTest ? [] : ["nativewind/babel"])
    ],
    plugins: isTest ? [] : ["react-native-reanimated/plugin"]
  };
};
