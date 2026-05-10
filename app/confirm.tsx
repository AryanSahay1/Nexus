/**
 * Generic confirmation modal.
 *
 * Presented from any screen by populating `useUiStore.request(...)` and
 * then `router.push('/confirm')`. The destructive variant uses an
 * oxblood-red CTA so the user can't miss what they're about to do.
 *
 * The modal animates in via expo-router's `presentation: 'transparentModal'`
 * + `animation: 'fade'` configured at the stack level; the inner card
 * itself springs in via reanimated.
 */

import { router } from 'expo-router';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { useUiStore } from '../src/store/uiStore';

export default function ConfirmModal(): React.ReactElement {
  const pending = useUiStore((s) => s.pendingConfirmation);
  const resolve = useUiStore((s) => s.resolve);

  const handleCancel = useCallback((): void => {
    pending?.onCancel();
    resolve();
    router.back();
  }, [pending, resolve]);

  const handleConfirm = useCallback((): void => {
    pending?.onConfirm();
    resolve();
    router.back();
  }, [pending, resolve]);

  if (pending === null) {
    // Defensive guard — if the user navigated here directly with no
    // request queued, just bounce back. Never leave a blank modal up.
    setTimeout(() => router.back(), 0);
    return <View style={styles.empty} />;
  }

  return (
    <Animated.View entering={FadeIn.duration(160)} style={styles.backdrop}>
      <Pressable style={styles.backdropPress} onPress={handleCancel} accessibilityRole="button">
        <Animated.View
          entering={ZoomIn.duration(180)}
          style={styles.card}
          onStartShouldSetResponder={() => true}
        >
          <Text style={styles.title}>{pending.title}</Text>
          <Text style={styles.body}>{pending.body}</Text>
          <View style={styles.buttonRow}>
            <Pressable
              onPress={handleCancel}
              style={({ pressed }) => [styles.button, styles.cancel, pressed && styles.pressed]}
              accessibilityLabel={pending.cancelLabel}
            >
              <Text style={styles.cancelText}>{pending.cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              style={({ pressed }) => [
                styles.button,
                pending.destructive ? styles.destructive : styles.confirm,
                pressed && styles.pressed,
              ]}
              accessibilityLabel={pending.confirmLabel}
            >
              <Text
                style={[
                  styles.confirmText,
                  pending.destructive && styles.destructiveText,
                ]}
              >
                {pending.confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, backgroundColor: 'transparent' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdropPress: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
  card: {
    backgroundColor: '#15151F',
    borderRadius: 20,
    padding: 24,
    width: '88%',
    maxWidth: 400,
    gap: 16,
    borderWidth: 1,
    borderColor: '#2A2A3A',
  },
  title: { color: '#F4ECDF', fontSize: 20, fontWeight: '600' },
  body: { color: '#A8A8C2', fontSize: 14, lineHeight: 20 },
  buttonRow: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 8 },
  button: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  pressed: { opacity: 0.85 },
  cancel: { backgroundColor: '#2A2A3A' },
  cancelText: { color: '#F4ECDF', fontSize: 14, fontWeight: '600' },
  confirm: { backgroundColor: '#7C5CFF' },
  confirmText: { color: '#FFF8EC', fontSize: 14, fontWeight: '600' },
  destructive: { backgroundColor: '#A53B33' },
  destructiveText: { color: '#FFF8EC' },
});
