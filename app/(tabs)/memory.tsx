/**
 * Memory screen — what Nexus remembers about you.
 *
 * Shows:
 *   - 3 stat tiles: facts saved, conversations (currently 0 surface),
 *     messages (count of in-memory chat history).
 *   - Saved Facts list (FlatList over preferencesStore.entries).
 *   - "Clear all memories" Danger Zone.
 *
 * Add-fact UX is intentionally lightweight: a key/value/category form
 * row at the top of the panel.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { ClawPanel } from '../../src/components/shared/ClawPanel';
import { ErrorBoundary } from '../../src/components/shared/ErrorBoundary';
import { GlowButton } from '../../src/components/shared/GlowButton';
import { buildMemoryFirstOpenSteps, useTour } from '../../src/components/guide';
import { type PreferenceCategory } from '../../src/db/preferencesRepo';
import { getChatStore } from '../../src/store/chatStore';
import { getPreferencesStore } from '../../src/store/preferencesStore';
import { THEME } from '../../src/theme';

const CATEGORIES: readonly PreferenceCategory[] = ['communication', 'contacts', 'behavior'];

const MemoryScreenInner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const entries = useStore(getPreferencesStore(), (s) => s.entries);
  const messageCount = useStore(getChatStore(), (s) => s.messages.length);

  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [category, setCategory] = useState<PreferenceCategory>('behavior');
  const [saving, setSaving] = useState(false);

  // ── Guided tour ──
  const tilesRef = useRef<View>(null);
  const keyInputRef = useRef<View>(null);
  const memoryChatTabRef = useRef<View>(null);
  const memoryTour = useTour(
    'memory_first_open',
    buildMemoryFirstOpenSteps({
      statTiles: tilesRef,
      addFactKeyInput: keyInputRef,
      chatTab: memoryChatTabRef,
    }),
  );
  useEffect(() => {
    void memoryTour.startTour();
  }, [memoryTour]);

  const handleAdd = useCallback(async () => {
    if (key.trim().length === 0 || value.length === 0) return;
    setSaving(true);
    try {
      const r = await getPreferencesStore().getState().set(key.trim(), value, category);
      if (!r.ok) {
        Alert.alert('Could not save', r.error.message);
        return;
      }
      setKey('');
      setValue('');
    } finally {
      setSaving(false);
    }
  }, [key, value, category]);

  const handleDelete = useCallback((targetKey: string) => {
    Alert.alert('Delete memory?', `Remove "${targetKey}" from local storage.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void getPreferencesStore().getState().remove(targetKey);
        },
      },
    ]);
  }, []);

  const handleClearAll = useCallback(() => {
    Alert.alert('Clear ALL memories?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear all',
        style: 'destructive',
        onPress: () => {
          void getPreferencesStore().getState().clearAll();
        },
      },
    ]);
  }, []);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + THEME.spacing.lg }]}
    >
      <Text style={styles.heading}>MEMORY</Text>
      <Text style={styles.subheading}>What Nexus remembers about you</Text>

      <View ref={tilesRef} collapsable={false} style={styles.tilesRow}>
        <ClawPanel style={styles.tile}>
          <Text style={styles.tileNumber}>{entries.length}</Text>
          <Text style={styles.tileLabel}>Saved facts</Text>
        </ClawPanel>
        <ClawPanel style={styles.tile}>
          <Text style={styles.tileNumber}>1</Text>
          <Text style={styles.tileLabel}>Conversation</Text>
        </ClawPanel>
        <ClawPanel style={styles.tile}>
          <Text style={styles.tileNumber}>{messageCount}</Text>
          <Text style={styles.tileLabel}>Messages</Text>
        </ClawPanel>
      </View>

      <ClawPanel style={styles.section}>
        <Text style={styles.sectionTitle}>Add a fact</Text>
        <Text style={styles.sectionHint}>
          These get injected into every system prompt automatically.
        </Text>
        <View ref={keyInputRef} collapsable={false}>
          <TextInput
            value={key}
            onChangeText={setKey}
            placeholder="key  e.g. email_tone"
            placeholderTextColor={THEME.colors.text.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
        </View>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="value  e.g. always professional"
          placeholderTextColor={THEME.colors.text.muted}
          style={styles.input}
        />
        <View style={styles.categoryRow}>
          {CATEGORIES.map((c) => {
            const active = c === category;
            return (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setCategory(c)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ marginTop: THEME.spacing.md }}>
          <GlowButton
            label="Save fact"
            variant="primary"
            fullWidth
            loading={saving}
            disabled={key.trim().length === 0 || value.length === 0}
            onPress={() => void handleAdd()}
          />
        </View>
      </ClawPanel>

      <ClawPanel style={styles.section}>
        <Text style={styles.sectionTitle}>Saved facts</Text>
        {entries.length === 0 ? (
          <Text style={styles.empty}>No facts saved yet.</Text>
        ) : (
          entries.map((e) => (
            <Pressable
              key={e.key}
              onLongPress={() => handleDelete(e.key)}
              accessibilityRole="button"
              accessibilityHint="Long press to delete"
              style={styles.factRow}
            >
              <Text style={styles.factKey} numberOfLines={1}>
                {e.key}
              </Text>
              <Text style={styles.factValue} numberOfLines={2}>
                {e.value}
              </Text>
              <Text style={styles.factCategory}>{e.category}</Text>
            </Pressable>
          ))
        )}
      </ClawPanel>

      <ClawPanel tone="danger" style={styles.section}>
        <Text style={styles.dangerTitle}>Danger zone</Text>
        <Text style={styles.dangerHint}>
          These actions cannot be undone.
        </Text>
        <View style={{ marginTop: THEME.spacing.md }}>
          <GlowButton label="Clear all memories" variant="danger" fullWidth onPress={handleClearAll} />
        </View>
      </ClawPanel>
    </ScrollView>
  );
};

const MemoryScreen: React.FC = () => (
  <ErrorBoundary screen="memory">
    <MemoryScreenInner />
  </ErrorBoundary>
);

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: THEME.colors.background.primary },
  content: { padding: THEME.spacing.lg, paddingBottom: THEME.spacing.xxxl },
  heading: {
    fontFamily: THEME.fonts.display,
    fontSize: THEME.fontSizes.display,
    color: THEME.colors.text.primary,
    letterSpacing: 4,
  },
  subheading: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.secondary,
    marginTop: THEME.spacing.xs,
    marginBottom: THEME.spacing.xl,
  },
  tilesRow: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
    marginBottom: THEME.spacing.lg,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
  },
  tileNumber: {
    fontFamily: THEME.fonts.display,
    fontSize: THEME.fontSizes.xl,
    color: THEME.colors.accent.cyan,
  },
  tileLabel: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.xs,
    color: THEME.colors.text.secondary,
    marginTop: 2,
    textAlign: 'center',
  },
  section: { marginBottom: THEME.spacing.lg },
  sectionTitle: {
    fontFamily: THEME.fonts.bodySemibold,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.primary,
  },
  sectionHint: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.xs,
    color: THEME.colors.text.muted,
    marginTop: 2,
    marginBottom: THEME.spacing.md,
  },
  input: {
    marginTop: THEME.spacing.sm,
    backgroundColor: THEME.colors.background.elevated,
    borderColor: THEME.colors.border.default,
    borderWidth: 1,
    borderRadius: THEME.radius.md,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 10,
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.primary,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
    marginTop: THEME.spacing.md,
  },
  chip: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 6,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    borderColor: THEME.colors.border.default,
  },
  chipActive: {
    backgroundColor: THEME.colors.accentFill.cyanStrong,
    borderColor: THEME.colors.border.active,
  },
  chipLabel: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.secondary,
    textTransform: 'capitalize',
  },
  chipLabelActive: { color: THEME.colors.accent.cyan, fontFamily: THEME.fonts.bodyMedium },
  empty: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.muted,
    marginTop: THEME.spacing.md,
  },
  factRow: {
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border.default,
  },
  factKey: {
    fontFamily: THEME.fonts.mono,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.accent.cyan,
  },
  factValue: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.primary,
    marginTop: 2,
  },
  factCategory: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.xs,
    color: THEME.colors.text.muted,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dangerTitle: {
    fontFamily: THEME.fonts.bodySemibold,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.accent.coral,
  },
  dangerHint: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.secondary,
    marginTop: 4,
  },
});

export default MemoryScreen;
