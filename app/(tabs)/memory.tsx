/**
 * Memory screen — read-only view of the persisted chat history grouped
 * by date. Tool messages are filtered out (they're transient orchestration
 * noise and not interesting to the user).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  clearAllMessages,
  listAllMessages,
  type PersistedChatMessage,
} from '../../src/db/chatHistoryRepo';
import { useUiStore } from '../../src/store/uiStore';
import { router } from 'expo-router';

interface DaySection {
  readonly day: string;
  readonly messages: readonly PersistedChatMessage[];
}

const formatDay = (epochMs: number): string => {
  const d = new Date(epochMs);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function MemoryScreen(): React.ReactElement {
  const [messages, setMessages] = useState<readonly PersistedChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestConfirmation = useUiStore((s) => s.request);

  const refresh = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    const result = await listAllMessages();
    if (result.ok) {
      setMessages(result.value);
      setErrorMessage(null);
    } else {
      setErrorMessage(result.error.message);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sections = useMemo<readonly DaySection[]>(() => {
    const filtered = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
    const byDay = new Map<string, PersistedChatMessage[]>();
    for (const m of filtered) {
      const day = formatDay(m.createdAt);
      const existing = byDay.get(day);
      if (existing === undefined) byDay.set(day, [m]);
      else existing.push(m);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([day, msgs]) => ({ day, messages: msgs }));
  }, [messages]);

  const handleClear = useCallback((): void => {
    requestConfirmation({
      id: 'clear-history',
      title: 'Clear chat history?',
      body: 'This deletes every saved message on this device. There is no undo.',
      confirmLabel: 'Clear all',
      cancelLabel: 'Keep it',
      destructive: true,
      onConfirm: () => {
        void (async () => {
          const result = await clearAllMessages();
          if (!result.ok) {
            setErrorMessage(result.error.message);
            return;
          }
          await refresh();
        })();
      },
      onCancel: () => undefined,
    });
    router.push('/confirm');
  }, [requestConfirmation, refresh]);

  if (isLoading && messages.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#7C5CFF" />
      </View>
    );
  }

  return (
    <FlatList<DaySection>
      data={sections}
      keyExtractor={(item) => item.day}
      style={styles.container}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Memory</Text>
          <Pressable
            style={({ pressed }) => [styles.clearButton, pressed && styles.clearButtonPressed]}
            onPress={handleClear}
          >
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        </View>
      }
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor="#7C5CFF" />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing here yet.</Text>
          <Text style={styles.emptyBody}>
            Conversations from the Chat tab will be saved here so you can revisit them later.
          </Text>
          {errorMessage !== null && (
            <Text style={styles.errorText}>{errorMessage}</Text>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.daySection}>
          <Text style={styles.dayLabel}>{item.day}</Text>
          {item.messages.map((m) => (
            <View
              key={m.id}
              style={[
                styles.messageRow,
                m.role === 'user' ? styles.messageUser : styles.messageAssistant,
              ]}
            >
              <Text style={styles.messageRole}>{m.role === 'user' ? 'You' : 'Nexus'}</Text>
              <Text style={styles.messageText}>{m.content}</Text>
            </View>
          ))}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F14' },
  content: { padding: 16, gap: 12 },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B0F14',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heading: { color: '#F4ECDF', fontSize: 22, fontWeight: '600' },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A53B33',
  },
  clearButtonPressed: { opacity: 0.7 },
  clearText: { color: '#A53B33', fontSize: 13, fontWeight: '600' },
  empty: { padding: 32, alignItems: 'center' },
  emptyTitle: { color: '#F4ECDF', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptyBody: { color: '#A8A8C2', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  errorText: { color: '#A53B33', fontSize: 13, marginTop: 12 },
  daySection: { gap: 6, marginBottom: 12 },
  dayLabel: {
    color: '#A8A8C2',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  messageRow: {
    backgroundColor: '#15151F',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2A2A3A',
  },
  messageUser: { borderColor: '#7C5CFF' },
  messageAssistant: { borderColor: '#2A2A3A' },
  messageRole: {
    color: '#A8A8C2',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageText: { color: '#F4ECDF', fontSize: 14, lineHeight: 20 },
});
