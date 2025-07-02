const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  buffer: path.resolve(
    __dirname,
    "node_modules/@craftzdog/react-native-buffer",
  ),
  crypto: path.resolve(__dirname, "node_modules/react-native-crypto"),
  stream: path.resolve(__dirname, "node_modules/react-native-stream"),
};

config.resolver.sourceExts.push("mjs", "cjs");

module.exports = withNativeWind(config, { input: "./global.css" });
