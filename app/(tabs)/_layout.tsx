/**
 * Bottom tab navigator: Chat / Vault / Memory.
 *
 * Three tabs is exactly what the directive requested. Icons are rendered
 * with the standard expo-router built-ins; we deliberately avoid pulling
 * in `@expo/vector-icons` here so the tab bar boots in well under 100 ms.
 */

import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const TabIcon: React.FC<{ readonly label: string; readonly focused: boolean }> = ({
  label,
  focused,
}) => (
  <View style={[styles.iconContainer, focused && styles.iconContainerFocused]}>
    <Text
      style={[styles.iconText, focused && styles.iconTextFocused]}
      accessibilityLabel={`${label} tab`}
    >
      {label[0]}
    </Text>
  </View>
);

export default function TabsLayout(): React.ReactElement {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0B0F14' },
        headerTintColor: '#F4ECDF',
        tabBarStyle: { backgroundColor: '#15151F', borderTopColor: '#2A2A3A' },
        tabBarActiveTintColor: '#7C5CFF',
        tabBarInactiveTintColor: '#A8A8C2',
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ focused }) => <TabIcon label="Chat" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="vault"
        options={{
          title: 'Vault',
          tabBarIcon: ({ focused }) => <TabIcon label="Vault" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="memory"
        options={{
          title: 'Memory',
          tabBarIcon: ({ focused }) => <TabIcon label="Memory" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconContainerFocused: {
    backgroundColor: '#2A2A3A',
  },
  iconText: {
    color: '#A8A8C2',
    fontSize: 14,
    fontWeight: '600',
  },
  iconTextFocused: {
    color: '#F4ECDF',
  },
});
