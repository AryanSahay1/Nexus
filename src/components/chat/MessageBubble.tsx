/**
 * MessageBubble — chat-message renderer.
 *
 * Three role variants:
 *   - user      : right-aligned, amber accent
 *   - assistant : left-aligned,  cyan accent + lightweight inline markdown
 *   - tool      : centered,      purple accent + dashed border
 *
 * Markdown handled inline (Marcus's spec is intentionally narrow):
 *   - **bold**          → semibold
 *   - `inline code`     → mono pill
 *   - lines starting `- ` → bullets
 *   - lines starting `# ` → header
 *
 * Triple-backtick code blocks are rendered as a separate dark container
 * with a copy-to-clipboard button.
 */

import * as Clipboard from 'expo-clipboard';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, SlideInLeft, SlideInRight } from 'react-native-reanimated';

import { THEME } from '../../theme';

export interface MessageBubbleProps {
  readonly id: string;
  readonly role: 'user' | 'assistant' | 'tool';
  readonly content: string;
  readonly toolName?: string | null;
  readonly timestampIso?: string | null;
  readonly modelName?: string | null;
  readonly testID?: string;
  readonly style?: StyleProp<ViewStyle>;
}

interface ParsedSegment {
  readonly kind: 'text' | 'codeblock';
  readonly content: string;
  readonly language?: string;
}

const splitCodeBlocks = (input: string): readonly ParsedSegment[] => {
  const segs: ParsedSegment[] = [];
  const re = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = re.exec(input);
  while (match !== null) {
    if (match.index > lastIndex) {
      segs.push({ kind: 'text', content: input.slice(lastIndex, match.index) });
    }
    segs.push({
      kind: 'codeblock',
      content: match[2] ?? '',
      ...(match[1] && match[1].length > 0 ? { language: match[1] } : {}),
    });
    lastIndex = match.index + match[0].length;
    match = re.exec(input);
  }
  if (lastIndex < input.length) {
    segs.push({ kind: 'text', content: input.slice(lastIndex) });
  }
  return segs;
};

interface InlineToken {
  readonly kind: 'text' | 'bold' | 'code';
  readonly value: string;
}

const tokenizeInline = (line: string): readonly InlineToken[] => {
  const tokens: InlineToken[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '*' && line[i + 1] === '*') {
      const end = line.indexOf('**', i + 2);
      if (end !== -1) {
        tokens.push({ kind: 'bold', value: line.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    if (line[i] === '`') {
      const end = line.indexOf('`', i + 1);
      if (end !== -1) {
        tokens.push({ kind: 'code', value: line.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    let next = line.length;
    for (const marker of ['**', '`']) {
      const at = line.indexOf(marker, i);
      if (at !== -1 && at < next) next = at;
    }
    tokens.push({ kind: 'text', value: line.slice(i, next) });
    i = next;
  }
  return tokens;
};

const renderInlineLine = (line: string, keyPrefix: string): React.ReactNode => (
  <Text style={styles.bodyText}>
    {tokenizeInline(line).map((tok, idx) => {
      const k = `${keyPrefix}-${idx}`;
      if (tok.kind === 'bold') {
        return (
          <Text key={k} style={styles.bold}>
            {tok.value}
          </Text>
        );
      }
      if (tok.kind === 'code') {
        return (
          <Text key={k} style={styles.codeInline}>
            {tok.value}
          </Text>
        );
      }
      return (
        <Text key={k} style={styles.bodyText}>
          {tok.value}
        </Text>
      );
    })}
  </Text>
);

const renderTextSegment = (text: string): React.ReactNode[] => {
  const out: React.ReactNode[] = [];
  const lines = text.split('\n');
  lines.forEach((rawLine, idx) => {
    const k = `l-${idx}`;
    if (rawLine.startsWith('# ')) {
      out.push(
        <Text key={k} style={styles.header}>
          {rawLine.slice(2)}
        </Text>,
      );
      return;
    }
    if (rawLine.startsWith('- ')) {
      out.push(
        <View key={k} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>•</Text>
          {renderInlineLine(rawLine.slice(2), k)}
        </View>,
      );
      return;
    }
    if (rawLine.length === 0) {
      out.push(<View key={k} style={styles.spacer} />);
      return;
    }
    out.push(<View key={k}>{renderInlineLine(rawLine, k)}</View>);
  });
  return out;
};

const formatTimestamp = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const MessageBubbleImpl: React.FC<MessageBubbleProps> = ({
  id,
  role,
  content,
  toolName,
  timestampIso,
  modelName,
  testID,
  style,
}) => {
  const segments = useMemo(() => splitCodeBlocks(content), [content]);
  const ts = formatTimestamp(timestampIso ?? null);

  const onCopyCode = (codeText: string): void => {
    void Clipboard.setStringAsync(codeText);
  };

  if (role === 'tool') {
    return (
      <Animated.View
        testID={testID}
        entering={FadeInDown.duration(THEME.animation.fastIn)}
        style={[styles.toolWrap, style]}
        accessibilityLabel={`Tool result from ${toolName ?? 'unknown'}`}
      >
        {toolName !== undefined && toolName !== null && toolName.length > 0 ? (
          <Text style={styles.toolName}>{toolName}</Text>
        ) : null}
        <Text style={styles.toolBody} numberOfLines={4}>
          {content}
        </Text>
      </Animated.View>
    );
  }

  const isUser = role === 'user';
  const containerStyle = isUser ? styles.userBubble : styles.assistantBubble;
  const entering = isUser ? SlideInRight.duration(THEME.animation.fastIn) : SlideInLeft.duration(THEME.animation.fastIn);

  return (
    <Animated.View
      testID={testID}
      entering={entering.delay(20)}
      style={[styles.bubbleWrap, isUser ? styles.bubbleWrapRight : styles.bubbleWrapLeft, style]}
      accessibilityLabel={`${role} message ${id}`}
    >
      <View style={containerStyle}>
        {segments.map((seg, idx) =>
          seg.kind === 'codeblock' ? (
            <View key={`s-${idx}`} style={styles.codeBlock}>
              {seg.language !== undefined ? (
                <Text style={styles.codeLanguage}>{seg.language}</Text>
              ) : null}
              <Text style={styles.codeBlockText}>{seg.content}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Copy code"
                hitSlop={THEME.hitSlop}
                onPress={() => onCopyCode(seg.content)}
                style={styles.copyButton}
              >
                <Text style={styles.copyButtonLabel}>Copy</Text>
              </Pressable>
            </View>
          ) : (
            <View key={`s-${idx}`}>{renderTextSegment(seg.content)}</View>
          ),
        )}
      </View>
      {(ts.length > 0 || (modelName && modelName.length > 0)) && (
        <View style={[styles.metaRow, isUser ? styles.metaRowRight : styles.metaRowLeft]}>
          {ts.length > 0 ? <Text style={styles.metaText}>{ts}</Text> : null}
          {modelName !== undefined && modelName !== null && modelName.length > 0 ? (
            <Text style={styles.metaText}>{modelName}</Text>
          ) : null}
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bubbleWrap: {
    marginVertical: THEME.spacing.xs,
    maxWidth: '85%',
  },
  bubbleWrapRight: {
    alignSelf: 'flex-end',
    maxWidth: '80%',
  },
  bubbleWrapLeft: {
    alignSelf: 'flex-start',
  },
  userBubble: {
    backgroundColor: THEME.colors.accentFill.amber,
    borderLeftWidth: 3,
    borderLeftColor: THEME.colors.accent.amber,
    borderRadius: THEME.radius.md,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 10,
  },
  assistantBubble: {
    backgroundColor: THEME.colors.accentFill.cyan,
    borderLeftWidth: 3,
    borderLeftColor: THEME.colors.accent.cyan,
    borderRadius: THEME.radius.md,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 10,
  },
  bodyText: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.primary,
    lineHeight: THEME.fontSizes.md * THEME.lineHeights.body,
  },
  bold: {
    fontFamily: THEME.fonts.bodySemibold,
  },
  codeInline: {
    fontFamily: THEME.fonts.mono,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.accent.cyan,
    backgroundColor: THEME.colors.accentFill.cyanStrong,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: THEME.radius.xs,
  },
  header: {
    fontFamily: THEME.fonts.displayBold,
    fontSize: THEME.fontSizes.lg,
    color: THEME.colors.text.primary,
    marginTop: 4,
    marginBottom: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginVertical: 2,
  },
  bulletDot: {
    color: THEME.colors.accent.cyan,
    fontSize: THEME.fontSizes.md,
    lineHeight: THEME.fontSizes.md * THEME.lineHeights.body,
  },
  spacer: { height: 6 },
  codeBlock: {
    backgroundColor: THEME.colors.background.code,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border.active,
    borderRadius: THEME.radius.sm,
    padding: THEME.spacing.md,
    marginVertical: 6,
    position: 'relative',
  },
  codeLanguage: {
    fontFamily: THEME.fonts.mono,
    fontSize: THEME.fontSizes.xs,
    color: THEME.colors.text.muted,
    marginBottom: 4,
  },
  codeBlockText: {
    fontFamily: THEME.fonts.mono,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.primary,
    lineHeight: THEME.fontSizes.sm * THEME.lineHeights.mono,
  },
  copyButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 2,
    borderRadius: THEME.radius.xs,
    backgroundColor: THEME.colors.accentFill.cyanStrong,
  },
  copyButtonLabel: {
    fontFamily: THEME.fonts.bodyMedium,
    fontSize: 10,
    color: THEME.colors.accent.cyan,
    letterSpacing: 0.4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    marginTop: 4,
  },
  metaRowLeft: { justifyContent: 'flex-start' },
  metaRowRight: { justifyContent: 'flex-end' },
  metaText: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.xs,
    color: THEME.colors.text.muted,
  },
  toolWrap: {
    alignSelf: 'center',
    backgroundColor: THEME.colors.accentFill.purple,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: THEME.colors.border.memory,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 6,
    marginVertical: THEME.spacing.xs,
    maxWidth: '90%',
  },
  toolName: {
    fontFamily: THEME.fonts.mono,
    fontSize: THEME.fontSizes.xs,
    color: THEME.colors.accent.purple,
    marginBottom: 2,
  },
  toolBody: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.secondary,
  },
});

export const MessageBubble = React.memo(MessageBubbleImpl);
MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;
