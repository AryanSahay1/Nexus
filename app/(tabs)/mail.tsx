/**
 * Mail screen — Gmail inbox.
 *
 * Reads through gmailService.listGmailMessages (which is what the agent
 * loop also calls) so the UI sees exactly what the agent does. Per LAW 9
 * (no direct API calls from components), the screen calls the service
 * via a tiny adapter.
 *
 * UX:
 *   - Pull-to-refresh re-fetches the inbox
 *   - Tap a row to view the full email body via gmailService.getGmailMessage
 *   - Empty state when zero messages, loading state during initial fetch
 *   - When Google is not connected, render a "Connect Google" CTA
 */

import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClawPanel } from '../../src/components/shared/ClawPanel';
import { EmptyState } from '../../src/components/shared/EmptyState';
import { ErrorBoundary } from '../../src/components/shared/ErrorBoundary';
import { GlowButton } from '../../src/components/shared/GlowButton';
import { LoadingSpinner } from '../../src/components/shared/LoadingSpinner';
import { useAuth } from '../../src/hooks/useAuth';
import { useMail } from '../../src/hooks/useMail';
import { THEME } from '../../src/theme';
import { type GmailMessageSummary } from '../../src/types/tools';
import { type EmailDetail } from '../../src/types/google';

const formatRelativeDate = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const formatSenderName = (raw: string): string => {
  // Gmail "From" header looks like: "Alice <alice@example.com>" or just "alice@example.com".
  const m = /^([^<]+)<([^>]+)>$/.exec(raw.trim());
  if (m && m[1]) return m[1].trim().replace(/^"|"$/g, '');
  return raw;
};

const MailRow: React.FC<{
  thread: GmailMessageSummary;
  onPress: (id: string) => void;
}> = React.memo(({ thread, onPress }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={`Email from ${formatSenderName(thread.from)}: ${thread.subject}`}
    onPress={() => onPress(thread.id)}
    style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
  >
    <ClawPanel style={styles.row} contentStyle={styles.rowContent}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowFrom} numberOfLines={1}>
          {formatSenderName(thread.from) || 'Unknown sender'}
        </Text>
        <Text style={styles.rowDate}>{formatRelativeDate(thread.dateIso)}</Text>
      </View>
      <Text style={styles.rowSubject} numberOfLines={1}>
        {thread.subject || '(no subject)'}
      </Text>
      {thread.snippet.length > 0 ? (
        <Text style={styles.rowSnippet} numberOfLines={2}>
          {thread.snippet}
        </Text>
      ) : null}
    </ClawPanel>
  </Pressable>
));
MailRow.displayName = 'MailRow';

const MailScreenInner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { googleConnected } = useAuth();
  const mail = useMail();

  const [refreshing, setRefreshing] = useState(false);
  const [openMessage, setOpenMessage] = useState<EmailDetail | null>(null);
  const [openLoading, setOpenLoading] = useState(false);

  useEffect(() => {
    if (googleConnected) {
      void mail.load();
    }
    // mail is intentionally a stable hook reference — its identity is
    // constant per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleConnected]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void (async () => {
      await mail.refresh();
      setRefreshing(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpen = useCallback((id: string) => {
    setOpenLoading(true);
    setOpenMessage(null);
    void (async () => {
      const result = await mail.openThread(id);
      setOpenLoading(false);
      if (result.ok) setOpenMessage(result.value);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = useCallback(() => {
    setOpenMessage(null);
  }, []);

  const threads = mail.threads;
  const loading = mail.status === 'loading_cache' || mail.status === 'loading_network';
  const errorText = mail.error ? `${mail.error.code}: ${mail.error.message}` : null;

  if (!googleConnected) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top + THEME.spacing.lg }]}>
        <Text style={styles.heading}>MAIL</Text>
        <Text style={styles.subheading}>Connect Google to view your inbox.</Text>
        <ClawPanel style={styles.ctaPanel}>
          <Text style={styles.ctaTitle}>Google not connected</Text>
          <Text style={styles.ctaBody}>
            Mail uses your own Google account through OAuth — your messages
            never leave your phone except as Gmail API calls you authorized.
          </Text>
          <View style={{ marginTop: THEME.spacing.md }}>
            <GlowButton
              label="Open Vault"
              variant="primary"
              fullWidth
              onPress={() => router.push('/(tabs)/vault')}
            />
          </View>
        </ClawPanel>
      </View>
    );
  }

  if (openMessage !== null || openLoading) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top }]}>
        <ClawPanel style={styles.detailHeader} contentStyle={styles.detailHeaderContent}>
          <Pressable
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close email"
            style={styles.backButton}
          >
            <Text style={styles.backArrow}>‹</Text>
          </Pressable>
          <Text style={styles.detailHeaderTitle} numberOfLines={1}>
            {openMessage?.subject || 'Loading…'}
          </Text>
        </ClawPanel>
        {openLoading || openMessage === null ? (
          <View style={styles.detailLoading}>
            <LoadingSpinner label="Fetching email…" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.detailScroll}>
            <Text style={styles.detailFrom}>
              From: {formatSenderName(openMessage.from)}
            </Text>
            <Text style={styles.detailTo}>To: {openMessage.to || '(unknown)'}</Text>
            <Text style={styles.detailDate}>
              {openMessage.dateIso
                ? new Date(openMessage.dateIso).toLocaleString()
                : ''}
            </Text>
            <Text style={styles.detailBody}>{openMessage.bodyText || '(empty body)'}</Text>
          </ScrollView>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top + THEME.spacing.lg }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>MAIL</Text>
          <Text style={styles.subheading}>
            {threads.length} recent {threads.length === 1 ? 'message' : 'messages'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Compose new email"
          onPress={() => router.push('/compose')}
          hitSlop={THEME.hitSlop}
          style={styles.composeButton}
        >
          <Text style={styles.composeGlyph}>＋</Text>
        </Pressable>
      </View>

      {errorText !== null ? (
        <ClawPanel tone="danger" style={styles.errorPanel}>
          <Text style={styles.errorText}>{errorText}</Text>
        </ClawPanel>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <LoadingSpinner label="Loading inbox…" />
        </View>
      ) : threads.length === 0 ? (
        <EmptyState
          glyph="✉"
          title="Inbox empty"
          body="No recent messages. Pull down to refresh."
        />
      ) : (
        <FlashList
          data={threads as GmailMessageSummary[]}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MailRow thread={item} onPress={handleOpen} />}
          estimatedItemSize={92}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={THEME.colors.accent.cyan}
              colors={[THEME.colors.accent.cyan]}
            />
          }
        />
      )}
    </View>
  );
};

const MailScreen: React.FC = () => (
  <ErrorBoundary screen="mail">
    <MailScreenInner />
  </ErrorBoundary>
);

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: THEME.colors.background.primary },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingRight: THEME.spacing.lg,
  },
  composeButton: {
    width: 40,
    height: 40,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border.active,
    backgroundColor: THEME.colors.accentFill.cyanStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composeGlyph: {
    fontFamily: THEME.fonts.display,
    fontSize: THEME.fontSizes.xl,
    color: THEME.colors.accent.cyan,
    lineHeight: THEME.fontSizes.xl,
  },
  heading: {
    fontFamily: THEME.fonts.display,
    fontSize: THEME.fontSizes.display,
    color: THEME.colors.text.primary,
    letterSpacing: 4,
    paddingHorizontal: THEME.spacing.lg,
  },
  subheading: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.secondary,
    paddingHorizontal: THEME.spacing.lg,
    marginTop: 4,
    marginBottom: THEME.spacing.lg,
  },
  errorPanel: {
    marginHorizontal: THEME.spacing.lg,
    marginBottom: THEME.spacing.md,
  },
  errorText: {
    fontFamily: THEME.fonts.mono,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.danger,
  },
  listContent: {
    paddingHorizontal: THEME.spacing.lg,
    paddingBottom: THEME.spacing.xxxl,
  },
  row: { marginBottom: THEME.spacing.sm },
  rowContent: { padding: THEME.spacing.md },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowFrom: {
    fontFamily: THEME.fonts.bodySemibold,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.primary,
    flex: 1,
    marginRight: THEME.spacing.sm,
  },
  rowDate: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.xs,
    color: THEME.colors.text.muted,
  },
  rowSubject: {
    fontFamily: THEME.fonts.bodyMedium,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.primary,
    marginTop: 2,
  },
  rowSnippet: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.secondary,
    marginTop: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: THEME.spacing.xl,
  },
  emptyTitle: {
    fontFamily: THEME.fonts.displayBold,
    fontSize: THEME.fontSizes.xl,
    color: THEME.colors.text.primary,
  },
  emptyBody: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.secondary,
    marginTop: THEME.spacing.sm,
    textAlign: 'center',
  },
  ctaPanel: {
    marginHorizontal: THEME.spacing.lg,
    marginTop: THEME.spacing.lg,
  },
  ctaTitle: {
    fontFamily: THEME.fonts.bodySemibold,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.primary,
  },
  ctaBody: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.secondary,
    marginTop: THEME.spacing.sm,
    lineHeight: THEME.fontSizes.sm * THEME.lineHeights.body,
  },
  detailHeader: {
    marginHorizontal: THEME.spacing.lg,
    marginTop: THEME.spacing.sm,
  },
  detailHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.md,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: THEME.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: THEME.spacing.sm,
  },
  backArrow: {
    fontSize: THEME.fontSizes.xxl,
    color: THEME.colors.accent.cyan,
    lineHeight: THEME.fontSizes.xxl,
  },
  detailHeaderTitle: {
    flex: 1,
    fontFamily: THEME.fonts.bodySemibold,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.primary,
  },
  detailLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailScroll: {
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.lg,
    paddingBottom: THEME.spacing.xxxl,
  },
  detailFrom: {
    fontFamily: THEME.fonts.bodyMedium,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.primary,
  },
  detailTo: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.secondary,
    marginTop: 4,
  },
  detailDate: {
    fontFamily: THEME.fonts.mono,
    fontSize: THEME.fontSizes.xs,
    color: THEME.colors.text.muted,
    marginTop: 4,
    marginBottom: THEME.spacing.lg,
  },
  detailBody: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.primary,
    lineHeight: THEME.fontSizes.md * THEME.lineHeights.body,
  },
});

export default MailScreen;
