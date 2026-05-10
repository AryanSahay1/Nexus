/**
 * Detox configuration for Project Nexus.
 *
 * Detox is the device-level orchestrator: it builds the app, installs it,
 * launches it, and runs the e2e flows in `e2e/flows/`. Test execution
 * itself happens through Jest under a separate runner config so unit
 * tests (run by the top-level jest.config.js) and e2e tests (run by
 * `e2e/jest.config.js`) never trip over each other.
 *
 * The Android binary path matches the `expo prebuild` + Gradle output
 * convention; the iOS path is documented for parity but Nexus does not
 * currently ship an iOS build.
 */
/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120_000,
    },
  },
  apps: {
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build:
        'cd android && ./gradlew :app:assembleDebug :app:assembleAndroidTest -DtestBuildType=debug',
    },
    'android.release': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      build:
        'cd android && ./gradlew :app:assembleRelease :app:assembleAndroidTest -DtestBuildType=release',
    },
  },
  devices: {
    emulator: {
      type: 'android.emulator',
      device: { avdName: 'Pixel_6_API_33' },
    },
  },
  configurations: {
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug',
    },
    'android.emu.release': {
      device: 'emulator',
      app: 'android.release',
    },
  },
};
