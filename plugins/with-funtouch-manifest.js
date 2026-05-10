/* eslint-disable */
/**
 * Inline Expo config plugin — FunTouch OS / Vivo V27 manifest hardening.
 *
 * Three modifications to the generated AndroidManifest.xml:
 *
 *   1. <application android:extractNativeLibs="true" />
 *      AGP 8 defaults this to false (smaller APK, faster install). On
 *      Snapdragon 680 + FunTouch OS 13 the runtime native loader has
 *      been observed to fail to mmap streaming .so libraries from the
 *      APK at first launch — extracting them to /data/app/<pkg>/lib
 *      at install time eliminates that failure mode.
 *
 *   2. <meta-data android:name="android.max_aspect" android:value="2.4" />
 *      FunTouch iManager (Vivo's foreground-process supervisor) uses a
 *      heuristic scoring system to decide whether an app is a "real" UI
 *      application or a background-service abuser. Apps without
 *      max_aspect declared land in the "ambiguous" bucket and have a
 *      lower budget for Application.onCreate(). Setting max_aspect to
 *      a standard tall-phone value (2.4) signals "I am a normal
 *      portrait UI app" and unlocks the standard budget.
 *
 *   3. Re-injection of the existing react-native-app-auth manifest
 *      placeholder is delegated to plugins/with-app-auth-android.js
 *      (unchanged from PR #5).
 *
 * Idempotent — running prebuild repeatedly does not stack duplicates.
 *
 * References:
 *   - https://developer.android.com/guide/topics/manifest/application-element#extractNativeLibs
 *   - https://developer.android.com/guide/topics/manifest/meta-data-element
 *   - Vivo Developer Portal — FunTouch OS process management notes
 *     (no permanent URL; the heuristic is documented per-OS revision)
 */

const { withAndroidManifest } = require('@expo/config-plugins');

const META_DATA_ENTRY = {
  $: {
    'android:name': 'android.max_aspect',
    'android:value': '2.4',
  },
};

const ensureApplicationFlags = (mod) => {
  const application = mod.manifest.application?.[0];
  if (!application) return mod;
  if (!application.$) application.$ = {};
  application.$['android:extractNativeLibs'] = 'true';
  // largeHeap doubles the per-process Dalvik / ART heap from the OEM
  // default to give react-native-app-auth + Hermes init enough headroom
  // under FunTouch iManager's first-launch memory pressure.
  application.$['android:largeHeap'] = 'true';
  return mod;
};

const ensureMaxAspectMeta = (mod) => {
  const application = mod.manifest.application?.[0];
  if (!application) return mod;
  if (!Array.isArray(application['meta-data'])) application['meta-data'] = [];
  const already = application['meta-data'].some(
    (m) => m?.$?.['android:name'] === 'android.max_aspect',
  );
  if (already) return mod;
  application['meta-data'].push(META_DATA_ENTRY);
  return mod;
};

const withFuntouchManifest = (config) =>
  withAndroidManifest(config, (cfg) => {
    let mod = cfg.modResults;
    mod = ensureApplicationFlags(mod);
    mod = ensureMaxAspectMeta(mod);
    cfg.modResults = mod;
    return cfg;
  });

module.exports = withFuntouchManifest;
