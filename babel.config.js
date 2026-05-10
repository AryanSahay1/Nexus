module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // expo-router/babel was deprecated in SDK 50 — its functionality is
    // now bundled into babel-preset-expo above. The reanimated plugin
    // MUST remain last per the reanimated docs.
    plugins: ['react-native-reanimated/plugin'],
  };
};
