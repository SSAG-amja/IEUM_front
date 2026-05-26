import { type Href, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionLine, Pill } from '@/components/ieum/ieum-ui';
import { MapVisual } from '@/components/ieum/map-visual';
import { IeumColors } from '@/constants/theme';
import { useTapSequence } from '@/hooks/use-tap-sequence';
import { requestAccessibleRoute } from '@/services/route-api';
import { useRouteSession } from '@/features/ieum/session/route-session-provider';
import { ScreenFrame } from '@/features/ieum/shared/screen-frame';
import { repeatAnnouncement, useAnnouncement } from '@/features/ieum/shared/use-announcement';

type DestinationPhase = 'input' | 'candidate' | 'building';
const GUIDANCE_ROUTE = '/guidance' as Href;

export function DestinationScreen() {
  const router = useRouter();
  const {
    originQuery,
    destinationQuery,
    route,
    setOriginQuery,
    setDestinationQuery,
    setRoute,
    clearRoute,
  } = useRouteSession();
  const [phase, setPhase] = useState<DestinationPhase>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state = useMemo(() => {
    if (phase === 'input') {
      return {
        phase: '경로 입력',
        accent: '#129FC4',
        title: '어디로 안내할까요?',
        subtitle: '현재 개발 단계에서는 출발지와 목적지를 직접 입력합니다.',
        tts: '출발지와 목적지를 입력한 뒤 화면을 두 번 터치해 확인해주세요.',
      };
    }
    if (phase === 'candidate') {
      return {
        phase: '입력 확인',
        accent: '#17A37A',
        title: destinationQuery.trim() || '목적지',
        subtitle: `${originQuery.trim() || '출발지'}에서 출발합니다.`,
        tts: `${originQuery.trim()}에서 ${destinationQuery.trim()}으로 안내할까요? 맞으면 화면을 두 번, 입력을 고치려면 화면을 세 번 터치해주세요.`,
      };
    }
    if (route) {
      return {
        phase: '경로 계산 완료',
        accent: '#D78126',
        title: '안전 경로를 찾았습니다',
        subtitle: `총 ${Math.round(route.summary.total_length_m)}m · ${route.summary.uses_subway ? '지하철 포함' : '도보 경로'} · 환승 ${route.summary.transfer_count}회`,
        tts: `${destinationQuery.trim()}까지 접근성 경로를 찾았습니다. 안내를 시작하려면 화면을 두 번 터치해주세요.`,
      };
    }
    if (error) {
      return {
        phase: '경로 탐색 실패',
        accent: '#D14F48',
        title: '경로를 찾지 못했습니다',
        subtitle: error,
        tts: '경로를 찾지 못했습니다. 입력을 확인한 뒤 다시 계산해주세요.',
      };
    }
    return {
      phase: '경로 탐색 중',
      accent: '#D78126',
      title: '안전 경로를 탐색 중입니다',
      subtitle: `${originQuery.trim()}에서 ${destinationQuery.trim()}까지 접근성 경로를 계산하고 있습니다.`,
      tts: '안전 경로를 탐색 중입니다. 잠시 기다려주세요.',
    };
  }, [destinationQuery, error, originQuery, phase, route]);

  useAnnouncement(state.tts);

  const calculateRoute = useCallback(async () => {
    setPhase('building');
    setLoading(true);
    setError(null);
    clearRoute();
    try {
      const response = await requestAccessibleRoute(originQuery.trim(), destinationQuery.trim());
      setRoute(response);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '경로를 계산하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [clearRoute, destinationQuery, originQuery, setRoute]);

  const handleTap = (count: number) => {
    if (count === 2 && phase === 'input') {
      if (!originQuery.trim() || !destinationQuery.trim()) {
        setError('출발지와 목적지를 입력해주세요.');
        return;
      }
      Keyboard.dismiss();
      setError(null);
      setPhase('candidate');
      return;
    }
    if (count === 2 && phase === 'candidate') {
      void calculateRoute();
      return;
    }
    if (count === 2 && phase === 'building') {
      if (route) {
        router.push(GUIDANCE_ROUTE);
      } else if (error && !loading) {
        void calculateRoute();
      } else {
        repeatAnnouncement(state.tts);
      }
      return;
    }
    if (count === 3 && phase !== 'input') {
      clearRoute();
      setError(null);
      setPhase('input');
    }
  };

  const { registerTap } = useTapSequence(handleTap);
  const handleScreenPress = () => {
    Keyboard.dismiss();
    registerTap();
  };

  return (
    <ScreenFrame phase={state.phase} accent={state.accent} onPress={handleScreenPress}>
      <View style={styles.body}>
        {phase === 'input' && (
          <View style={styles.inputCard}>
            <Text style={styles.label}>출발지 (개발용 입력)</Text>
            <TextInput
              accessibilityLabel="출발지 입력"
              value={originQuery}
              onChangeText={(value) => {
                setOriginQuery(value);
                clearRoute();
              }}
              onPressIn={(event) => event.stopPropagation()}
              onSubmitEditing={Keyboard.dismiss}
              placeholder="예: 시청역 또는 126.977088,37.565715"
              placeholderTextColor={IeumColors.textMuted}
              returnKeyType="done"
              style={styles.input}
            />
            <Text style={styles.label}>목적지</Text>
            <TextInput
              accessibilityLabel="목적지 입력"
              value={destinationQuery}
              onChangeText={(value) => {
                setDestinationQuery(value);
                clearRoute();
              }}
              onPressIn={(event) => event.stopPropagation()}
              onSubmitEditing={Keyboard.dismiss}
              placeholder="예: 강남역"
              placeholderTextColor={IeumColors.textMuted}
              returnKeyType="done"
              style={styles.input}
            />
            <Text style={styles.hint}>서울 내 역명 또는 경도,위도 좌표로 테스트합니다.</Text>
          </View>
        )}

        {phase === 'candidate' && (
          <View style={styles.confirmCard}>
            <Pill>입력 확인</Pill>
            <Text style={styles.routeText}>{originQuery.trim()}</Text>
            <Text style={styles.arrow}>→</Text>
            <Text style={styles.routeText}>{destinationQuery.trim()}</Text>
          </View>
        )}

        {phase === 'building' && route && (
          <MapVisual
            title="전체 경로 요약"
            helperMode={false}
            currentLocation={{ latitude: route.summary.start.lat, longitude: route.summary.start.lon }}
            route={route}
          />
        )}

        <View style={styles.titleBlock}>
          <Text style={styles.title}>{state.title}</Text>
          <Text style={styles.subtitle}>{state.subtitle}</Text>
        </View>
        <View style={styles.ttsCard}>
          <Text style={styles.ttsHeading}>현재 음성 안내</Text>
          <Text style={styles.ttsText}>{state.tts}</Text>
        </View>
        {loading && (
          <View style={styles.status}>
            <ActivityIndicator color={IeumColors.cyan} />
            <Text style={styles.statusText}>경로를 계산 중입니다.</Text>
          </View>
        )}
        {error && phase === 'building' && (
          <Pressable
            style={styles.retry}
            onPress={(event) => {
              event.stopPropagation();
              void calculateRoute();
            }}>
            <Text style={styles.retryText}>다시 계산</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.actions}>
        <ActionLine
          count={2}
          label={phase === 'input' ? '입력 확인' : phase === 'candidate' ? '경로 탐색' : route ? '안내 시작' : '다시 계산'}
        />
        <ActionLine count={3} label={phase === 'input' ? '도움말 듣기' : '입력 수정'} muted={phase === 'input'} />
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center' },
  inputCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: IeumColors.border,
    backgroundColor: IeumColors.card,
    padding: 12,
    marginBottom: 10,
  },
  label: { color: IeumColors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 8 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A485C',
    color: IeumColors.text,
    backgroundColor: IeumColors.cardStrong,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 16,
  },
  hint: { color: IeumColors.textMuted, fontSize: 11, marginTop: 8 },
  confirmCard: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: IeumColors.border,
    backgroundColor: IeumColors.cardStrong,
    paddingVertical: 24,
    marginBottom: 14,
  },
  routeText: { color: IeumColors.text, fontSize: 24, fontWeight: '800', marginTop: 14 },
  arrow: { color: IeumColors.cyan, fontSize: 20, marginTop: 9 },
  titleBlock: { alignItems: 'center', marginTop: 16 },
  title: { color: IeumColors.text, fontSize: 25, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: IeumColors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8 },
  ttsCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: IeumColors.border,
    backgroundColor: IeumColors.card,
    padding: 12,
    marginTop: 14,
  },
  ttsHeading: { color: '#E1E5EB', fontWeight: '700', fontSize: 12 },
  ttsText: { color: '#B7C0CE', fontSize: 12, lineHeight: 18, marginTop: 6 },
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 },
  statusText: { color: IeumColors.textSecondary, fontSize: 12 },
  retry: {
    alignSelf: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#38516D',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 12,
  },
  retryText: { color: IeumColors.cyan, fontSize: 12, fontWeight: '700' },
  actions: { gap: 7, paddingBottom: 6 },
});
