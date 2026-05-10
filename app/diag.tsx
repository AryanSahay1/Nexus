/**
 * Diagnostic mode — minimal-dependency screen that probes every native
 * module Nexus depends on and renders pass/fail per row.
 *
 * The user lands here automatically when the previous launch crashed
 * mid-bootstrap (see `_layout.tsx` `previous_crash` branch). Or they
 * tap "Run diagnostic" from the boot-failed screen.
 *
 * This screen MUST NOT depend on bootstrap / fonts / Reanimated. The
 * whole point is that even if everything else is broken, this screen
 * still renders.
 */

import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  type DiagReport,
  type ProbeResult,
  runDiagProbes,
} from '../src/utils/diagProbes';
import { clearSentinel } from '../src/utils/crashSentinel';

const COLORS = {
  bg: '#0A0A0F',
  surface: '#111118',
  border: 'rgba(0, 245, 212, 0.12)',
  cyan: '#00F5D4',
  amber: '#FFB830',
  coral: '#FF4757',
  green: '#10B981',
  text: '#F0F0F5',
  muted: '#8888A0',
  faded: '#44445A',
};

const indicatorFor = (status: ProbeResult['status']): string => {
  if (status === 'pass') return '✓';
  if (status === 'fail') return '✗';
  return '⏳';
};

const colorFor = (status: ProbeResult['status']): string => {
  if (status === 'pass') return COLORS.green;
  if (status === 'fail') return COLORS.coral;
  return COLORS.muted;
};

const DiagRow: React.FC<{ probe: ProbeResult }> = ({ probe }) => (
  <View style={styles.row}>
    <Text style={[styles.indicator, { color: colorFor(probe.status) }]}>
      {indicatorFor(probe.status)}
    </Text>
    <View style={styles.rowBody}>
      <Text style={styles.rowLabel}>{probe.label}</Text>
      {probe.errorCode !== undefined ? (
        <Text style={styles.rowError}>
          [{probe.errorCode}] {probe.errorMessage}
        </Text>
      ) : probe.latencyMs !== undefined && probe.status === 'pass' ? (
        <Text style={styles.rowMeta}>{probe.latencyMs}ms</Text>
      ) : null}
    </View>
  </View>
);

const DiagScreen: React.FC = () => {
  const router = useRouter();
  const [report, setReport] = useState<DiagReport | null>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback((): void => {
    setRunning(true);
    setReport(null);
    void (async () => {
      const r = await runDiagProbes();
      setReport(r);
      setRunning(false);
    })();
  }, []);

  // Auto-run on first focus.
  useFocusEffect(
    useCallback(() => {
      run();
    }, [run]),
  );

  const handleResetAndExit = useCallback((): void => {
    void (async () => {
      await clearSentinel();
      router.replace('/');
    })();
  }, [router]);

  const allPassed =
    report !== null && report.probes.every((p) => p.status === 'pass');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>NEXUS</Text>
        <Text style={styles.heading}>Diagnostic mode</Text>
        <Text style={styles.subheading}>
          Each row tests one native module. Take a screenshot once every
          row shows ✓ or ✗ and send it to the team — we'll know exactly
          what's failing.
        </Text>

        <View style={styles.panel}>
          {report === null ? (
            <Text style={styles.runningText}>
              {running ? 'Running probes...' : 'Tap Run to start.'}
            </Text>
          ) : (
            report.probes.map((p) => <DiagRow key={p.id} probe={p} />)
          )}
        </View>

        {report !== null ? (
          <View style={styles.summary}>
            <Text style={styles.summaryLabel}>Hermes engine</Text>
            <Text
              style={[
                styles.summaryValue,
                {
                  color: report.hermesPresent ? COLORS.green : COLORS.coral,
                },
              ]}
            >
              {report.hermesPresent ? 'present ✓' : 'NOT detected ✗'}
            </Text>
            <Text style={styles.summaryLabel}>Build fingerprint</Text>
            <Text style={styles.summaryValueMono}>
              {report.buildFingerprint || '(unavailable)'}
            </Text>
            {allPassed ? (
              <Text style={styles.allPassNote}>
                All probes passed. The native modules are healthy. The
                previous crash was likely transient — tap "Reset and
                retry" to attempt a fresh boot.
              </Text>
            ) : (
              <Text style={styles.someFailedNote}>
                One or more probes failed. The failing module is the
                cause of the immediate-close on this device. Send the
                screenshot.
              </Text>
            )}
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Re-run probes"
          onPress={run}
          disabled={running}
          style={({ pressed }) => [
            styles.button,
            { opacity: pressed ? 0.85 : running ? 0.4 : 1 },
          ]}
        >
          <Text style={styles.buttonLabel}>
            {running ? 'Running…' : 'Re-run probes'}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset and retry boot"
          onPress={handleResetAndExit}
          style={({ pressed }) => [
            styles.buttonGhost,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.buttonGhostLabel}>Reset and retry boot</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 24, paddingBottom: 64 },
  brand: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.cyan,
    letterSpacing: 4,
  },
  heading: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 4,
  },
  subheading: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 8,
    lineHeight: 18,
  },
  panel: {
    marginTop: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  runningText: {
    fontSize: 14,
    color: COLORS.muted,
    padding: 12,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  indicator: {
    fontSize: 18,
    width: 24,
    fontWeight: '700',
  },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  rowError: {
    fontSize: 12,
    color: COLORS.coral,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  rowMeta: { fontSize: 11, color: COLORS.faded, marginTop: 2 },
  summary: {
    marginTop: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 8,
  },
  summaryValue: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  summaryValueMono: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: COLORS.text,
    marginTop: 2,
  },
  allPassNote: { fontSize: 12, color: COLORS.green, marginTop: 12 },
  someFailedNote: { fontSize: 12, color: COLORS.coral, marginTop: 12 },
  button: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: 'rgba(0,245,212,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,245,212,0.45)',
    alignSelf: 'center',
  },
  buttonLabel: {
    color: COLORS.cyan,
    fontSize: 14,
    fontWeight: '600',
  },
  buttonGhost: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignSelf: 'center',
  },
  buttonGhostLabel: {
    color: COLORS.muted,
    fontSize: 13,
  },
});

export default DiagScreen;
