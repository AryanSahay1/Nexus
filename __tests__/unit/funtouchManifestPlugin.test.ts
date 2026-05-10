/**
 * Unit tests for plugins/with-funtouch-manifest.js.
 *
 * The plugin is plain CommonJS and consumed by the Expo prebuild Node
 * loader. We exercise its mod function against in-memory AndroidManifest
 * shapes (the same shape `@expo/config-plugins` passes at prebuild time).
 *
 * Locks down NX-002 manifest hardening from PR #10 / v1.0.1:
 *   - extractNativeLibs="true"   (FunTouch on Snapdragon 680 mmap fix)
 *   - largeHeap="true"           (iManager first-launch memory pressure)
 *   - <meta-data android.max_aspect="2.4">  (iManager UI-app heuristic)
 *
 * The plugin must be idempotent: running it twice does not duplicate
 * the meta-data entry or stack the boolean attributes.
 */

interface AndroidManifestApplication {
  $?: Record<string, string>;
  'meta-data'?: { $: Record<string, string> }[];
}

interface AndroidManifest {
  manifest: { application?: AndroidManifestApplication[] };
}

interface ExpoConfigShim {
  modResults: AndroidManifest;
}

interface PluginCallback {
  (cfg: ExpoConfigShim): ExpoConfigShim;
}

let capturedCallback: PluginCallback | null = null;

jest.mock('@expo/config-plugins', () => ({
  __esModule: true,
  withAndroidManifest: (
    config: unknown,
    cb: PluginCallback,
  ): unknown => {
    capturedCallback = cb;
    return config;
  },
}));

// Importing the plugin registers its callback through withAndroidManifest.
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const withFuntouchManifest = require('../../plugins/with-funtouch-manifest.js') as (
  c: { name: string },
) => { name: string };

const buildEmptyManifest = (): AndroidManifest => ({
  manifest: { application: [{ $: {}, 'meta-data': [] }] },
});

const apply = (mod: AndroidManifest): AndroidManifest => {
  withFuntouchManifest({ name: 'nexus' });
  if (capturedCallback === null) throw new Error('plugin did not register a callback');
  const cfg: ExpoConfigShim = { modResults: mod };
  return capturedCallback(cfg).modResults;
};

beforeEach(() => {
  capturedCallback = null;
});

describe('with-funtouch-manifest config plugin', () => {
  it('sets extractNativeLibs="true" on <application>', () => {
    const mod = apply(buildEmptyManifest());
    const app = mod.manifest.application?.[0];
    expect(app?.$?.['android:extractNativeLibs']).toBe('true');
  });

  it('sets largeHeap="true" on <application>', () => {
    const mod = apply(buildEmptyManifest());
    const app = mod.manifest.application?.[0];
    expect(app?.$?.['android:largeHeap']).toBe('true');
  });

  it('inserts the canonical max_aspect meta-data entry', () => {
    const mod = apply(buildEmptyManifest());
    const meta = mod.manifest.application?.[0]?.['meta-data'] ?? [];
    const aspect = meta.find((m) => m.$['android:name'] === 'android.max_aspect');
    expect(aspect).toBeDefined();
    expect(aspect?.$['android:value']).toBe('2.4');
  });

  it('preserves existing application attributes', () => {
    const initial = buildEmptyManifest();
    const app = initial.manifest.application?.[0];
    if (app && app.$) {
      app.$['android:label'] = '@string/app_name';
      app.$['android:theme'] = '@style/AppTheme';
    }
    const mod = apply(initial);
    const after = mod.manifest.application?.[0];
    expect(after?.$?.['android:label']).toBe('@string/app_name');
    expect(after?.$?.['android:theme']).toBe('@style/AppTheme');
  });

  it('preserves existing meta-data entries', () => {
    const initial = buildEmptyManifest();
    initial.manifest.application?.[0]?.['meta-data']?.push({
      $: { 'android:name': 'expo.modules.updates.UPDATES_LAUNCH_WAIT_MS', 'android:value': '0' },
    });
    const mod = apply(initial);
    const meta = mod.manifest.application?.[0]?.['meta-data'] ?? [];
    expect(meta.some((m) => m.$['android:name'] === 'expo.modules.updates.UPDATES_LAUNCH_WAIT_MS')).toBe(true);
    expect(meta.some((m) => m.$['android:name'] === 'android.max_aspect')).toBe(true);
  });

  it('is idempotent — running twice does not duplicate the max_aspect entry', () => {
    const initial = buildEmptyManifest();
    const once = apply(initial);
    const twice = apply(once);
    const meta = twice.manifest.application?.[0]?.['meta-data'] ?? [];
    const aspectCount = meta.filter((m) => m.$['android:name'] === 'android.max_aspect').length;
    expect(aspectCount).toBe(1);
  });

  it('handles a manifest with no <application> gracefully', () => {
    const empty: AndroidManifest = { manifest: {} };
    expect(() => apply(empty)).not.toThrow();
  });

  it('handles a manifest with <application> but no $ attrs object', () => {
    const odd: AndroidManifest = { manifest: { application: [{}] } };
    const mod = apply(odd);
    const app = mod.manifest.application?.[0];
    expect(app?.$?.['android:extractNativeLibs']).toBe('true');
    expect(app?.$?.['android:largeHeap']).toBe('true');
  });
});
