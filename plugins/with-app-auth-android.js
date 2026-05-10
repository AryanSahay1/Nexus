/* eslint-disable */
/**
 * Inline Expo config plugin: adds the `appAuthRedirectScheme` manifest
 * placeholder that react-native-app-auth's AndroidManifest expects.
 *
 * Without this, prebuild generates an AndroidManifest with
 *   <data android:scheme="${appAuthRedirectScheme}" />
 * and gradle fails with "Attribute data@scheme requires a placeholder
 * substitution but no value for <appAuthRedirectScheme> is provided".
 *
 * This plugin sets the placeholder to the Android package id, which is
 * also the scheme we declare in app.json's android.intentFilters.
 */

const { withAppBuildGradle } = require('@expo/config-plugins');

const PLACEHOLDER_LINE = 'manifestPlaceholders = [appAuthRedirectScheme: "com.nexus.app"]';

const withAppAuthAndroid = (config) => {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (contents.includes('appAuthRedirectScheme')) {
      return cfg;
    }
    // Inject the placeholder into the defaultConfig {} block.
    const defaultConfigPattern = /(defaultConfig\s*{)/;
    if (!defaultConfigPattern.test(contents)) {
      console.warn(
        'with-app-auth-android: defaultConfig block not found; manifest placeholder not injected.',
      );
      return cfg;
    }
    contents = contents.replace(
      defaultConfigPattern,
      `$1\n        ${PLACEHOLDER_LINE}`,
    );
    cfg.modResults.contents = contents;
    return cfg;
  });
};

module.exports = withAppAuthAndroid;
