import { type Href, useRouter } from 'expo-router';
import {
  AudioQuality,
  IOSOutputFormat,
  type RecordingOptions,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
const API_URL = process.env.EXPO_PUBLIC_IEUM_API_URL ?? 'http://127.0.0.1:8020';
const DESTINATION_RECORDING_OPTIONS: RecordingOptions = {
  // Android default encoder usually produces AAC/MPEG-4 data, so upload it with a matching extension.
  extension: '.m4a',
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 128000,
  android: {
    outputFormat: 'default',
    audioEncoder: 'default',
  },
  ios: {
    extension: '.wav',
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.MAX,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

function guessAudioUpload(uri: string) {
  const normalized = uri.toLowerCase();
  if (normalized.endsWith('.wav')) {
    return { name: 'destination.wav', type: 'audio/wav' };
  }
  if (normalized.endsWith('.webm')) {
    return { name: 'destination.webm', type: 'audio/webm' };
  }
  return { name: 'destination.m4a', type: 'audio/mp4' };
}

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
  const [sttRecording, setSttRecording] = useState(false);
  const [sttStatus, setSttStatus] = useState<string | null>(null);
  const [speechPrompt, setSpeechPrompt] = useState<string | null>(null);
  const recorder = useAudioRecorder(DESTINATION_RECORDING_OPTIONS);
  const flashValue = useRef(new Animated.Value(0)).current;

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

  const ttsMessage = speechPrompt ?? state.tts;
  useAnnouncement(ttsMessage);

  useEffect(() => {
    if (!speechPrompt) {
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(flashValue, { toValue: 1, duration: 220, useNativeDriver: false }),
      Animated.timing(flashValue, { toValue: 0, duration: 900, useNativeDriver: false }),
    ]).start();
  }, [flashValue, speechPrompt]);

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

  const sendSttFile = useCallback(
    async (uri: string) => {
      try {
        setSttStatus('인식 중');
        const upload = guessAudioUpload(uri);
        const formData = new FormData();
        formData.append('file', { uri, name: upload.name, type: upload.type } as any);
        const sttRes = await fetch(`${API_URL}/api/v1/voice/destination`, { method: 'POST', body: formData });
        if (!sttRes.ok) {
          let detail = '음성 인식을 시작하지 못했습니다.';
          try {
            const errorData = await sttRes.json();
            if (typeof errorData?.detail === 'string' && errorData.detail.trim()) {
              detail = errorData.detail;
            }
          } catch {}
          throw new Error(detail);
        }
        const data = await sttRes.json();
        const nextDestination = (data.destination || data.text || '').trim();
        setSpeechPrompt(data.prompt || null);
        if (nextDestination) {
          setDestinationQuery(nextDestination);
          clearRoute();
        }
        if (data.prompt) {
          setPhase('input');
          setSttStatus('추가 입력 대기');
          return;
        }
        if (nextDestination) {
          setPhase('candidate');
          setSttStatus('입력 확인');
          return;
        }
        setSttStatus('목적지 추출 실패');
      } catch (cause) {
        setSttStatus(cause instanceof Error ? cause.message : '음성 인식을 완료하지 못했습니다.');
      }
    },
    [clearRoute, setDestinationQuery]
  );

  const startDestinationRecord = useCallback(async () => {
    if (sttRecording) {
      return;
    }
    setSpeechPrompt(null);
    setSttStatus('마이크 요청 중');
    setError(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setSttStatus('마이크 권한이 필요합니다.');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setSttRecording(true);
    setSttStatus('목적지 듣는 중');
  }, [recorder, sttRecording]);

  const stopDestinationRecord = useCallback(async () => {
    setSttRecording(false);
    setSttStatus('음성 입력 종료');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        setSttStatus('녹음 파일이 없습니다.');
        return;
      }
      await sendSttFile(uri);
    } catch (cause) {
      setSttStatus(cause instanceof Error ? cause.message : '녹음을 종료하지 못했습니다.');
    }
  }, [recorder, sendSttFile]);

  const handleTap = (count: number) => {
    if (speechPrompt) {
      setSpeechPrompt(null);
    }
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

  const flashBackground = flashValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,0,0,0)', 'rgba(18,159,196,0.18)'],
  });

  return (
    <View style={styles.screenWrap}>
      <Animated.View pointerEvents="none" style={[styles.flashOverlay, { backgroundColor: flashBackground }]} />
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
                setSpeechPrompt(null);
              }}
              onPressIn={(event) => event.stopPropagation()}
              onSubmitEditing={Keyboard.dismiss}
              placeholder="예: 강남역"
              placeholderTextColor={IeumColors.textMuted}
              returnKeyType="done"
              style={styles.input}
            />
            <View style={styles.sttRow}>
              <Pressable
                style={[styles.sttButton, sttRecording && styles.sttButtonActive]}
                onPressIn={(event) => event.stopPropagation()}
                onPress={sttRecording ? stopDestinationRecord : startDestinationRecord}
                disabled={loading}>
                <Text style={styles.sttButtonText}>{sttRecording ? '목적지 듣는 중...' : '목적지 음성 입력'}</Text>
              </Pressable>
              {sttStatus ? <Text style={styles.sttStatus}>{sttStatus}</Text> : null}
            </View>
            {speechPrompt ? <Text style={styles.sttPrompt}>{speechPrompt}</Text> : null}
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
          <Text style={styles.ttsText}>{ttsMessage}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrap: { flex: 1 },
  flashOverlay: { ...StyleSheet.absoluteFillObject },
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
  sttRow: { marginTop: 12 },
  sttButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#1C2A3D',
    borderWidth: 1,
    borderColor: '#2E415A',
  },
  sttButtonActive: {
    backgroundColor: '#14374C',
    borderColor: '#1C5E7E',
  },
  sttButtonText: { color: IeumColors.text, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  sttStatus: { color: IeumColors.textMuted, fontSize: 11, marginTop: 6 },
  sttPrompt: { color: IeumColors.cyan, fontSize: 12, fontWeight: '600', marginTop: 8 },
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
