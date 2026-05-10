/**
 * ServiceCard — Vault screen tile for one provider connection.
 *
 * Renders a "connected" or "disconnected" state. For openai the connected
 * state shows the masked tail of the API key. For google it shows the
 * decoded user email + a "Reconnect / Disconnect" row.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { type Provider, type ServiceConnection } from '../../types/auth';
import { THEME } from '../../theme';

import { ClawPanel } from '../shared/ClawPanel';
import { GlowButton } from '../shared/GlowButton';
import { StatusPill } from '../shared/StatusPill';

export interface ServiceCardProps {
  readonly provider: Provider;
  readonly connection: ServiceConnection;
  readonly maskedApiKey?: string | null;
  readonly onConnect: () => void;
  readonly onDisconnect: () => void;
  readonly disabled?: boolean;
  readonly testID?: string;
  /**
   * When provided, the disconnected-state Connect button is replaced
   * with a yellow StatusPill carrying this message — used by the Vault
   * screen to surface "Set EXPO_PUBLIC_GOOGLE_CLIENT_ID to enable" when
   * the build-time env var is missing instead of crashing inside the
   * OAuth flow.
   */
  readonly unavailableReason?: string;
}

const labels: Record<Provider, { title: string; description: string }> = {
  google: {
    title: 'Google',
    description: 'Gmail, Calendar, and Drive in one tap.',
  },
  openai: {
    title: 'OpenAI',
    description: 'Provides the language model that powers Nexus.',
  },
  whatsapp: {
    title: 'WhatsApp',
    description: 'Send messages from chat (advanced — requires Business API).',
  },
};

const ServiceCardImpl: React.FC<ServiceCardProps> = ({
  provider,
  connection,
  maskedApiKey,
  onConnect,
  onDisconnect,
  disabled = false,
  testID,
  unavailableReason,
}) => {
  const meta = labels[provider];
  const connected = connection.status === 'connected';

  return (
    <ClawPanel style={styles.card} {...(testID !== undefined ? { testID } : {})}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{meta.title}</Text>
          <Text style={styles.description}>{meta.description}</Text>
        </View>
        <StatusPill
          label={connected ? 'Connected' : 'Disconnected'}
          tone={connected ? 'success' : 'neutral'}
        />
      </View>

      {connected ? (
        <View style={styles.connectedBlock}>
          {connection.userEmail !== null ? (
            <Text style={styles.email}>{connection.userEmail}</Text>
          ) : null}
          {provider === 'openai' && typeof maskedApiKey === 'string' && maskedApiKey.length > 0 ? (
            <Text style={styles.maskedKey}>{maskedApiKey}</Text>
          ) : null}
          <View style={styles.actionsRow}>
            <View style={styles.actionFlex}>
              <GlowButton
                label="Reconnect"
                variant="ghost"
                fullWidth
                onPress={onConnect}
                disabled={disabled}
              />
            </View>
            <View style={styles.actionFlex}>
              <GlowButton
                label="Disconnect"
                variant="danger"
                fullWidth
                onPress={onDisconnect}
                disabled={disabled}
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.disconnectedBlock}>
          {unavailableReason !== undefined ? (
            <View
              style={styles.unavailableRow}
              testID={`${provider}-unavailable-reason`}
            >
              <StatusPill label={unavailableReason} tone="warning" />
            </View>
          ) : (
            <GlowButton
              label={`Connect ${meta.title}`}
              variant="primary"
              fullWidth
              onPress={onConnect}
              disabled={disabled}
            />
          )}
        </View>
      )}
    </ClawPanel>
  );
};

const styles = StyleSheet.create({
  card: { marginBottom: THEME.spacing.lg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: THEME.spacing.md,
  },
  title: {
    fontFamily: THEME.fonts.displayBold,
    fontSize: THEME.fontSizes.lg,
    color: THEME.colors.text.primary,
  },
  description: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.secondary,
    marginTop: 4,
    lineHeight: THEME.fontSizes.sm * THEME.lineHeights.body,
  },
  connectedBlock: {
    marginTop: THEME.spacing.md,
    gap: THEME.spacing.sm,
  },
  email: {
    fontFamily: THEME.fonts.bodyMedium,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.accent.cyan,
  },
  maskedKey: {
    fontFamily: THEME.fonts.mono,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.muted,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
    marginTop: THEME.spacing.sm,
  },
  actionFlex: { flex: 1 },
  disconnectedBlock: {
    marginTop: THEME.spacing.md,
  },
  unavailableRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export const ServiceCard = React.memo(ServiceCardImpl);
ServiceCard.displayName = 'ServiceCard';

export default ServiceCard;
