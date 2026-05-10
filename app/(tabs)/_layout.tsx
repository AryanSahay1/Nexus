/**
 * Custom tab bar — four tabs (Chat, Vault, Memory, Settings).
 *
 * The tabs themselves are rendered via expo-router's Tabs primitive
 * but the chrome is a custom component so the cyan-indicator slide
 * animation can be Reanimated. Light haptic on every tap.
 */

import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DURATIONS, EASINGS, THEME } from '../../src/theme';

interface TabDescriptor {
  readonly name: string;
  readonly label: string;
  readonly glyph: string;
}

const TABS: readonly TabDescriptor[] = [
  { name: 'index', label: 'Chat', glyph: '⚡' },
  { name: 'mail', label: 'Mail', glyph: '✉' },
  { name: 'calendar', label: 'Calendar', glyph: '📅' },
  { name: 'settings', label: 'Settings', glyph: '⚙' },
];

/**
 * Per-tab pressable. The focused glyph scales up to 1.1× via a snappy
 * spring (skill §12 — micro-interaction "trigger feedback"), and the
 * inactive glyphs settle back to 1.0×. The label fades in / out rather
 * than popping, so the row reads as a single fluid element instead of
 * four separate buttons fighting for the user's eye.
 */
interface TabButtonProps {
  readonly focused: boolean;
  readonly descriptor: TabDescriptor;
  readonly onPress: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ focused, descriptor, onPress }) => {
  const glyphScale = useSharedValue(focused ? 1.1 : 1);
  const labelOpacity = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    glyphScale.value = withSpring(focused ? 1.1 : 1, THEME.motion.springs.snappy);
    labelOpacity.value = withTiming(focused ? 1 : 0, {
      duration: DURATIONS.normal,
      easing: EASINGS.out,
    });
  }, [focused, glyphScale, labelOpacity]);

  const glyphStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glyphScale.value }],
  }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: labelOpacity.value }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${descriptor.label} tab`}
      accessibilityState={{ selected: focused }}
      style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.85 : 1 }]}
    >
      <Animated.Text
        style={[styles.glyph, focused && styles.glyphActive, glyphStyle]}
      >
        {descriptor.glyph}
      </Animated.Text>
      <Animated.Text style={[styles.label, labelStyle]}>
        {descriptor.label}
      </Animated.Text>
    </Pressable>
  );
};

interface CustomTabBarProps {
  readonly state: { readonly index: number; readonly routes: readonly { readonly name: string; readonly key: string }[] };
  readonly navigation: {
    readonly navigate: (name: string) => void;
    readonly emit: (e: { type: string; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
  };
}

const CustomTabBar: React.FC<CustomTabBarProps> = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();
  const indicatorX = useSharedValue(state.index);

  React.useEffect(() => {
    // Snappy spring gives a light overshoot — the eye reads it as a
    // confirmation that the tap landed.
    indicatorX.value = withSpring(state.index, THEME.motion.springs.snappy);
  }, [state.index, indicatorX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value * (100 / TABS.length) + '%' as unknown as number }],
  }));

  const ordered = useMemo(() => {
    return TABS.filter((t) => state.routes.some((r) => r.name === t.name));
  }, [state.routes]);

  const onPress = (descriptor: TabDescriptor): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const targetRoute = state.routes.find((r) => r.name === descriptor.name);
    if (!targetRoute) return;
    const event = navigation.emit({
      type: 'tabPress',
      target: targetRoute.key,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented) navigation.navigate(descriptor.name);
  };

  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: insets.bottom, height: 64 + insets.bottom },
      ]}
    >
      <Animated.View
        style={[
          styles.indicatorTrack,
          { width: `${100 / TABS.length}%` },
          indicatorStyle,
        ]}
      >
        <View style={styles.indicator} />
      </Animated.View>
      {ordered.map((descriptor, idx) => {
        const focused = state.index === idx;
        return (
          <TabButton
            key={descriptor.name}
            focused={focused}
            descriptor={descriptor}
            onPress={() => onPress(descriptor)}
          />
        );
      })}
    </View>
  );
};

const TabsLayout: React.FC = () => (
  <Tabs
    screenOptions={{ headerShown: false }}
    tabBar={(props) => (
      <CustomTabBar
        state={props.state as unknown as CustomTabBarProps['state']}
        navigation={props.navigation as unknown as CustomTabBarProps['navigation']}
      />
    )}
  >
    <Tabs.Screen name="index" options={{ title: 'Chat' }} />
    <Tabs.Screen name="mail" options={{ title: 'Mail' }} />
    <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
    <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    {/* Vault and Memory remain navigable by deep link / via Settings sub-sections,
        but no longer occupy a primary tab slot. expo-router auto-hides routes
        not declared in <Tabs.Screen>. */}
    <Tabs.Screen name="vault" options={{ href: null, title: 'Vault' }} />
    <Tabs.Screen name="memory" options={{ href: null, title: 'Memory' }} />
  </Tabs>
);

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.background.surface,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border.default,
    position: 'relative',
  },
  indicatorTrack: {
    position: 'absolute',
    top: 0,
    height: 24,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  indicator: {
    width: 24,
    height: 2,
    backgroundColor: THEME.colors.accent.cyan,
    borderRadius: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: THEME.spacing.md,
    paddingBottom: THEME.spacing.sm,
  },
  glyph: {
    fontSize: 20,
    color: THEME.colors.text.muted,
  },
  glyphActive: {
    color: THEME.colors.accent.cyan,
  },
  label: {
    fontFamily: THEME.fonts.bodyMedium,
    fontSize: 10,
    color: THEME.colors.accent.cyan,
    marginTop: 2,
    letterSpacing: 0.4,
  },
});

export default TabsLayout;
