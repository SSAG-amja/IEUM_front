import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { RouteSessionProvider } from '@/features/ieum/session/route-session-provider';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RouteSessionProvider>
        <Stack screenOptions={{ headerShown: false }} />
        <StatusBar style="light" />
      </RouteSessionProvider>
    </GestureHandlerRootView>
  );
}
