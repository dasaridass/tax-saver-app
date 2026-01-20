import React from 'react';
import { Tabs } from 'expo-router';
import { Calculator, Settings } from 'lucide-react-native';

import { useColorScheme } from '@/lib/useColorScheme';
import { useClientOnlyValue } from '@/lib/useClientOnlyValue';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#ea580c',
        tabBarInactiveTintColor: colorScheme === 'dark' ? '#6b7280' : '#9ca3af',
        headerShown: useClientOnlyValue(false, false),
        tabBarStyle: {
          backgroundColor: colorScheme === 'dark' ? '#111827' : '#ffffff',
          borderTopColor: colorScheme === 'dark' ? '#1f2937' : '#e5e7eb',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tax Optimizer',
          tabBarIcon: ({ color }: { color: string }) => (
            <Calculator size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }: { color: string }) => (
            <Settings size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
