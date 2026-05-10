/**
 * Chat screen — the main agent surface.
 *
 * Uses `useChatStore` for the running message list and the agent status,
 * delegates the actual LLM round-trip to `runAgent` from `agentLoop`, and
 * uses `react-native-reanimated` to slide each new message in from the
 * bottom. The composer locks while the agent is thinking and surfaces
 * errors inline above the input.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { runAgent } from '../../src/agent/agentLoop';
import { useChatStore, type ChatUiMessage } from '../../src/store/chatStore';

export default function ChatScreen(): React.ReactElement {
  const messages = useChatStore((s) => s.messages);
  const status = useChatStore((s) => s.status);
  const errorMessage = useChatStore((s) => s.errorMessage);
  const appendUser = useChatStore((s) => s.appendUser);
  const appendAssistant = useChatStore((s) => s.appendAssistant);
  const setError = useChatStore((s) => s.setError);

  const [input, setInput] = useState('');
  const listRef = useRef<FlatList<ChatUiMessage>>(null);

  useEffect(() => {
    if (messages.length === 0) return;
    // Auto-scroll to the newest message after a short tick so layout has
    // settled. `requestAnimationFrame` would also work; setTimeout is just
    // friendlier across RN versions.
    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(timer);
  }, [messages.length]);

  const handleSend = useCallback(async (): Promise<void> => {
    const text = input.trim();
    if (text.length === 0 || status === 'thinking') return;
    setInput('');
    appendUser(text);
    const result = await runAgent({ userMessage: text });
    if (result.ok) {
      appendAssistant(result.value.text);
    } else {
      setError(result.error.message);
    }
  }, [input, status, appendUser, appendAssistant, setError]);

  const renderItem = useCallback(
    ({ item }: { item: ChatUiMessage }): React.ReactElement => (
      <Animated.View
        entering={FadeInUp.duration(240)}
        style={[
          styles.bubble,
          item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        <Text style={styles.bubbleText}>{item.text}</Text>
      </Animated.View>
    ),
    [],
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Hello.</Text>
            <Text style={styles.emptyBody}>
              Ask me about your inbox, your calendar, or just start a conversation.
            </Text>
          </View>
        }
      />
      {status === 'thinking' && (
        <View style={styles.thinking}>
          <ActivityIndicator size="small" color="#7C5CFF" />
          <Text style={styles.thinkingText}>Thinking…</Text>
        </View>
      )}
      {errorMessage !== null && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}
      <View style={styles.inputBar}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Message Nexus…"
          placeholderTextColor="#A8A8C2"
          style={styles.input}
          editable={status !== 'thinking'}
          multiline
          accessibilityLabel="Message input"
        />
        <Pressable
          onPress={handleSend}
          disabled={input.trim().length === 0 || status === 'thinking'}
          style={({ pressed }) => [
            styles.sendButton,
            (input.trim().length === 0 || status === 'thinking') && styles.sendButtonDisabled,
            pressed && styles.sendButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F14' },
  listContent: { padding: 16, gap: 8, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { color: '#F4ECDF', fontSize: 24, fontWeight: '600', marginBottom: 8 },
  emptyBody: { color: '#A8A8C2', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    marginVertical: 4,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#7C5CFF',
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: '#1F1F2C',
  },
  bubbleText: { color: '#F4ECDF', fontSize: 15, lineHeight: 22 },
  thinking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  thinkingText: { color: '#A8A8C2', fontSize: 13 },
  errorBanner: {
    backgroundColor: '#A53B33',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
  },
  errorText: { color: '#FFF8EC', fontSize: 13 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 8,
    backgroundColor: '#15151F',
    borderTopColor: '#2A2A3A',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#0B0F14',
    color: '#F4ECDF',
    borderRadius: 18,
    fontSize: 15,
  },
  sendButton: {
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 18,
    backgroundColor: '#7C5CFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonPressed: { opacity: 0.85 },
  sendButtonText: { color: '#FFF8EC', fontSize: 14, fontWeight: '600' },
});
