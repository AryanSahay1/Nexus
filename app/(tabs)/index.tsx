/**
 * Chat screen — flagship.
 *
 * Composition:
 *   - HeaderBar (conversation title + new conversation button)
 *   - "Connect Google" amber banner when google is disconnected
 *   - Empty state with suggestion chips when there are no messages
 *   - FlashList of MessageBubble entries (newest at the bottom)
 *   - TypingIndicator + ToolExecutionBadge driven by chatStore
 *   - ConfirmationSheet driven by pendingAction
 *   - Input bar with TextInput + Send GlowButton
 */

import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { ClawPanel } from '../../src/components/shared/ClawPanel';
import { GlowButton } from '../../src/components/shared/GlowButton';
import { ConfirmationSheet } from '../../src/components/chat/ConfirmationSheet';
import { ErrorBoundary } from '../../src/components/shared/ErrorBoundary';
import { MessageBubble } from '../../src/components/chat/MessageBubble';
import { StatusPill } from '../../src/components/shared/StatusPill';
import { ToolExecutionBadge } from '../../src/components/chat/ToolExecutionBadge';
import { TypingIndicator } from '../../src/components/chat/TypingIndicator';
import { useAgentLoop } from '../../src/hooks/useAgentLoop';
import { useConfirmation } from '../../src/hooks/useConfirmation';
import { useVoiceInput } from '../../src/hooks/useVoiceInput';
import { getChatStore } from '../../src/store/chatStore';
import { getSettingsStore } from '../../src/store/settingsStore';
import { getVaultStore } from '../../src/store/vaultStore';
import { THEME } from '../../src/theme';
import { type Message } from '../../src/types/agent';

const SUGGESTIONS: readonly string[] = [
  'Read my latest email',
  "What's on my calendar this week?",
  'Show recent Drive files',
  'Remember that I prefer dark mode',
];

const ChatScreenInner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const messages = useStore(getChatStore(), (s) => s.messages);
  const agentStatus = useStore(getChatStore(), (s) => s.agentStatus);
  const currentToolName = useStore(getChatStore(), (s) => s.currentToolName);
  const pendingAction = useStore(getChatStore(), (s) => s.pendingAction);
  const googleConnected = useStore(
    getVaultStore(),
    (s) => s.snapshot.google.status === 'connected',
  );
  const hapticsEnabled = useStore(getSettingsStore(), (s) => s.hapticsEnabled);

  const confirmation = useConfirmation();
  const { send, isAgentBusy } = useAgentLoop(confirmation.awaitConfirmation);
  const listRef = useRef<FlashList<Message> | null>(null);

  const [text, setText] = useState('');
  const [showBanner, setShowBanner] = useState(true);

  // Voice input: tap mic to record, tap again to stop. Transcript fills
  // the input bar so the user can review and edit before sending.
  const voice = useVoiceInput();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (voice.isRecording) {
      pulse.value = withRepeat(
        withTiming(1.18, { duration: 600, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 150 });
    }
    return (): void => cancelAnimation(pulse);
  }, [voice.isRecording, pulse]);
  useEffect(() => {
    if (voice.transcript !== null && voice.transcript.length > 0) {
      setText((prev) => (prev.length === 0 ? voice.transcript! : `${prev} ${voice.transcript!}`));
      voice.reset();
    }
  }, [voice.transcript, voice]);

  const micAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const handleMicPress = useCallback(async (): Promise<void> => {
    if (voice.isRecording) {
      await voice.stopRecording();
      return;
    }
    await voice.startRecording();
  }, [voice]);

  const handleSend = useCallback(async (): Promise<void> => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || isAgentBusy) return;
    setText('');
    await send(trimmed);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [text, isAgentBusy, send]);

  const handleSuggestion = useCallback(
    (s: string) => {
      setText(s);
    },
    [],
  );

  const renderItem = useCallback(({ item }: { item: Message }): React.ReactElement => {
    const id = `${item.role}-${item.toolCallId ?? Math.random().toString(36)}-${item.content.slice(0, 8)}`;
    return (
      <MessageBubble
        id={id}
        role={item.role === 'system' ? 'assistant' : item.role}
        content={item.content}
        {...(item.toolName !== undefined ? { toolName: item.toolName } : {})}
      />
    );
  }, []);

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <ClawPanel style={styles.header} contentStyle={styles.headerContent}>
        <Text style={styles.headerTitle}>Chat</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New conversation"
          onPress={() => getChatStore().getState().clearHistory()}
          hitSlop={THEME.hitSlop}
          style={styles.newButton}
        >
          <Text style={styles.newButtonGlyph}>＋</Text>
        </Pressable>
      </ClawPanel>

      {!googleConnected && showBanner ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(tabs)/vault')}
          style={styles.banner}
        >
          <Text style={styles.bannerText}>
            Connect Google to unlock Gmail, Calendar, and Drive.
          </Text>
          <Pressable
            onPress={() => setShowBanner(false)}
            hitSlop={THEME.hitSlop}
            accessibilityLabel="Dismiss banner"
          >
            <Text style={styles.bannerDismiss}>×</Text>
          </Pressable>
        </Pressable>
      ) : null}

      <View style={styles.listWrap}>
        {messages.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyBolt}>⚡</Text>
            <Text style={styles.emptyBrand}>NEXUS</Text>
            <Text style={styles.emptyTagline}>Your local AI agent</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsRow}
            >
              {SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => handleSuggestion(s)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.suggestion, { opacity: pressed ? 0.8 : 1 }]}
                >
                  <ClawPanel contentStyle={styles.suggestionContent}>
                    <Text style={styles.suggestionLabel}>{s}</Text>
                  </ClawPanel>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : (
          <FlashList
            ref={listRef}
            data={messages as Message[]}
            keyExtractor={(_, idx) => `m-${idx}`}
            renderItem={renderItem}
            estimatedItemSize={80}
            contentContainerStyle={styles.list}
          />
        )}

        <ToolExecutionBadge
          {...(currentToolName !== null ? { toolName: currentToolName } : { toolName: null })}
        />
        <TypingIndicator
          status={agentStatus}
          {...(currentToolName !== null ? { currentToolName } : {})}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.bottom}
      >
        {voice.error !== null ? (
          <View style={styles.voiceErrorRow}>
            <StatusPill
              label={voice.error.message}
              tone="warning"
              testID="voice-error-pill"
            />
          </View>
        ) : null}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + THEME.spacing.md }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={voice.isRecording ? 'Stop recording' : 'Start voice recording'}
            onPress={() => void handleMicPress()}
            disabled={voice.isTranscribing || isAgentBusy}
            hitSlop={THEME.hitSlop}
            testID="chat-mic-button"
            style={({ pressed }) => [styles.micButton, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Animated.View
              style={[
                styles.micCore,
                voice.isRecording ? styles.micCoreRecording : styles.micCoreIdle,
                micAnimatedStyle,
              ]}
            >
              <Text style={styles.micGlyph}>{voice.isTranscribing ? '…' : '🎙'}</Text>
            </Animated.View>
          </Pressable>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Ask anything"
            placeholderTextColor={THEME.colors.text.muted}
            style={styles.textInput}
            multiline
            maxLength={4000}
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={() => void handleSend()}
            accessibilityLabel="Message input"
            testID="chat-input"
          />
          <GlowButton
            label="Send"
            variant="primary"
            disabled={text.trim().length === 0 || isAgentBusy}
            loading={isAgentBusy}
            hapticsEnabled={hapticsEnabled}
            onPress={() => void handleSend()}
            testID="chat-send"
          />
        </View>
      </KeyboardAvoidingView>

      <ConfirmationSheet
        pendingAction={pendingAction}
        onConfirm={confirmation.confirm}
        onCancel={confirmation.cancel}
        hapticsEnabled={hapticsEnabled}
      />
    </View>
  );
};

const ChatScreen: React.FC = () => (
  <ErrorBoundary screen="chat">
    <ChatScreenInner />
  </ErrorBoundary>
);

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: THEME.colors.background.primary },
  header: { marginHorizontal: THEME.spacing.lg, marginTop: THEME.spacing.sm },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.md,
  },
  headerTitle: {
    fontFamily: THEME.fonts.displayBold,
    fontSize: THEME.fontSizes.lg,
    color: THEME.colors.text.primary,
  },
  newButton: {
    width: 36,
    height: 36,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border.active,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.accentFill.cyanStrong,
  },
  newButtonGlyph: {
    fontSize: THEME.fontSizes.lg,
    color: THEME.colors.accent.cyan,
  },
  banner: {
    marginHorizontal: THEME.spacing.lg,
    marginTop: THEME.spacing.md,
    padding: THEME.spacing.md,
    backgroundColor: THEME.colors.accentFill.amberStrong,
    borderColor: THEME.colors.border.warning,
    borderWidth: 1,
    borderRadius: THEME.radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerText: {
    fontFamily: THEME.fonts.bodyMedium,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.accent.amber,
    flex: 1,
    marginRight: THEME.spacing.md,
  },
  bannerDismiss: {
    fontSize: THEME.fontSizes.lg,
    color: THEME.colors.accent.amber,
  },
  listWrap: { flex: 1, paddingHorizontal: THEME.spacing.md },
  list: {
    paddingVertical: THEME.spacing.lg,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: THEME.spacing.xl,
  },
  emptyBolt: { fontSize: 48, color: THEME.colors.accent.cyan },
  emptyBrand: {
    fontFamily: THEME.fonts.display,
    fontSize: THEME.fontSizes.display,
    color: THEME.colors.accent.cyan,
    letterSpacing: 4,
    marginTop: THEME.spacing.lg,
  },
  emptyTagline: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.secondary,
    marginTop: THEME.spacing.sm,
  },
  suggestionsRow: {
    paddingTop: THEME.spacing.xxl,
    paddingHorizontal: THEME.spacing.md,
    gap: THEME.spacing.sm,
  },
  suggestion: { marginRight: THEME.spacing.sm },
  suggestionContent: {
    paddingVertical: THEME.spacing.sm,
    paddingHorizontal: THEME.spacing.md,
  },
  suggestionLabel: {
    fontFamily: THEME.fonts.bodyMedium,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.primary,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: THEME.colors.background.surface,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border.default,
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.md,
    gap: THEME.spacing.md,
  },
  voiceErrorRow: {
    paddingHorizontal: THEME.spacing.lg,
    paddingBottom: THEME.spacing.sm,
    backgroundColor: THEME.colors.background.surface,
  },
  micButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 4,
  },
  micCore: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  micCoreIdle: {
    backgroundColor: THEME.colors.background.elevated,
    borderColor: THEME.colors.border.default,
  },
  micCoreRecording: {
    backgroundColor: THEME.colors.accentFill.coralStrong,
    borderColor: THEME.colors.border.danger,
  },
  micGlyph: {
    fontSize: 18,
    color: THEME.colors.text.primary,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
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
});

export default ChatScreen;
