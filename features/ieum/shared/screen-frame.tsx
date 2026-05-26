import { LinearGradient } from 'expo-linear-gradient';
import { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Pill } from '@/components/ieum/ieum-ui';
import { IeumColors } from '@/constants/theme';

type ScreenFrameProps = PropsWithChildren<{
  phase: string;
  accent: string;
  onPress?: () => void;
  rightAction?: ReactNode;
}>;

export function ScreenFrame({ phase, accent, onPress, rightAction, children }: ScreenFrameProps) {
  return (
    <Pressable style={styles.screen} onPress={onPress} accessible={false}>
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          pointerEvents="none"
          colors={[`${accent}45`, `${accent}18`, 'transparent']}
          locations={[0, 0.42, 0.82]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        />
        <View style={styles.content}>
          <View style={styles.header}>
            <View>
              <Text style={styles.logoCaption}>IEUM</Text>
              <Text style={styles.logo}>이음</Text>
            </View>
            <View style={styles.actions}>
              <Pill>{phase}</Pill>
              {rightAction}
            </View>
          </View>
          {children}
        </View>
      </SafeAreaView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: IeumColors.page },
  safeArea: { flex: 1, backgroundColor: IeumColors.surface },
  gradient: { ...StyleSheet.absoluteFillObject },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoCaption: { color: '#8491A4', fontSize: 11, letterSpacing: 4, fontWeight: '600' },
  logo: { color: IeumColors.text, fontSize: 19, lineHeight: 28, fontWeight: '700' },
});
