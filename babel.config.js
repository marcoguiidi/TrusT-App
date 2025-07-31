module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          unstable_transformImportMeta: true,
        },
      ],
      "nativewind/babel",
    ],
    plugins: [
      [
        "module-resolver",
        {
          alias: {
            crypto: "react-native-crypto",
            stream: "react-native-stream",
            buffer: "@craftzdog/react-native-buffer",
          },
        },
      ],
    ],
  };
};
