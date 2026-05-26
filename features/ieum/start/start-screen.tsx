import { type Href, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ActionLine } from '@/components/ieum/ieum-ui';
import { IeumColors } from '@/constants/theme';
import { useTapSequence } from '@/hooks/use-tap-sequence';
import { ScreenFrame } from '@/features/ieum/shared/screen-frame';
import { repeatAnnouncement, useAnnouncement } from '@/features/ieum/shared/use-announcement';

const ANNOUNCEMENT = '이음 앱을 시작합니다. 안내를 시작하려면 화면을 두 번 터치해주세요.';
const DESTINATION_ROUTE = '/destination' as Href;

export function StartScreen() {
  const router = useRouter();
  const { registerTap } = useTapSequence((count) => {
    if (count === 2) {
      router.push(DESTINATION_ROUTE);
    } else if (count === 3) {
      repeatAnnouncement(ANNOUNCEMENT);
    }
  });

  useAnnouncement(ANNOUNCEMENT);

  return (
    <ScreenFrame phase="앱 실행" accent="#6B89A4" onPress={registerTap}>
      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>IEUM</Text>
        </View>
        <Text style={styles.title}>이음 앱을 시작합니다</Text>
        <Text style={styles.subtitle}>접근성 경로 안내를 시작할 준비가 되었습니다.</Text>
      </View>
      <View style={styles.actions}>
        <ActionLine count={2} label="안내 시작" />
        <ActionLine count={3} label="시작 안내 다시 듣기" />
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconCircle: {
    height: 116,
    width: 116,
    borderRadius: 58,
    borderWidth: 1,
    borderColor: '#344052',
    backgroundColor: IeumColors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { color: IeumColors.cyan, fontWeight: '800', fontSize: 22, letterSpacing: 3 },
  title: { marginTop: 26, color: IeumColors.text, fontSize: 28, fontWeight: '800' },
  subtitle: { marginTop: 9, color: IeumColors.textSecondary, fontSize: 14, textAlign: 'center' },
  actions: { gap: 7, paddingBottom: 6 },
});
