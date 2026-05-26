import { type Href, useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
const API_URL = process.env.EXPO_PUBLIC_IEUM_API_URL ?? 'http://127.0.0.1:8020';
const VOICE_DESTINATION_URL = `${API_URL}/api/v1/voice/destination`;

type VoiceDestinationResponse = {
  text: string;
  destination: string;
  prompt: string;
  audio: string;
};

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
  const [voiceStatus, setVoiceStatus] = useState('버튼을 눌러 목적지를 말해주세요.');
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

  useEffect(() => {
    setDestinationQuery('');
    setRoute(null);
    clearRoute();
    setVoiceStatus('버튼을 눌러 목적지를 말해주세요.');
  }, [clearRoute, setDestinationQuery, setRoute]);

  const sendVoiceDestination = useCallback(async (uri: string) => {
    const formData = new FormData();
    formData.append('file', {
      uri,
      name: 'destination.m4a',
      type: 'audio/m4a',
    } as unknown as Blob);

    let response: Response;
    try {
      response = await fetch(VOICE_DESTINATION_URL, {
        method: 'POST',
        body: formData,
      });
    } catch (err) {
      console.error('voice upload failed', err);
      throw new Error('음성 업로드에 실패했습니다. 네트워크를 확인하세요.');
    }

    const raw = await response.text();
    let payload: VoiceDestinationResponse & { detail?: string } | null = null;
    try {
      payload = JSON.parse(raw) as VoiceDestinationResponse & { detail?: string };
    } catch (parseErr) {
      console.warn('voice response is not json', raw);
      // 서버가 HTML/text error를 반환하는 경우도 있으므로 detail에 원문을 담아 처리
      payload = { text: '', destination: '', prompt: '', audio: '', detail: raw };
    }

    if (!response.ok) {
      const message = payload?.detail ?? '음성 목적지를 확인하지 못했습니다.';
      throw new Error(typeof message === 'string' ? message : '음성 목적지를 확인하지 못했습니다.');
    }

    return payload as VoiceDestinationResponse;
  }, []);

  const stopAndSubmitVoice = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) {
      return;
    }

    setIsRecording(false);
    setVoiceStatus('목적지를 확인 중입니다.');

    try {
      await recording.stopAndUnloadAsync();
      // restore audio mode to playback after recording — ensure routing to speaker and no ducking
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: false,
        });
      } catch (modeErr) {
        console.warn('failed to restore audio mode', modeErr);
      }
      const uri = recording.getURI();
      recordingRef.current = null;

      if (!uri) {
        throw new Error('녹음 파일을 찾지 못했습니다.');
      }

      const result = await sendVoiceDestination(uri);
      const destination = result.destination.trim();

      if (!destination) {
        setError(result.prompt || '목적지를 확인하지 못했습니다. 다시 말해주세요.');
        setVoiceStatus(result.prompt || '목적지를 확인하지 못했습니다. 다시 말해주세요.');
        return;
      }

      setError(null);
      setDestinationQuery(destination);
      clearRoute();
      setPhase('candidate');
      setVoiceStatus(result.prompt || `${destination}으로 인식했습니다.`);
    } catch (cause) {
      recordingRef.current = null;
      setError(cause instanceof Error ? cause.message : '음성 목적지를 처리하지 못했습니다.');
      setVoiceStatus(cause instanceof Error ? cause.message : '음성 목적지를 처리하지 못했습니다.');
    }
  }, [clearRoute, sendVoiceDestination, setDestinationQuery]);

  const startVoiceRecording = useCallback(async () => {
    try {
      setError(null);
      clearRoute();
      setVoiceStatus('마이크 권한을 확인 중입니다.');

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setVoiceStatus('마이크 권한이 필요합니다.');
        return;
      }

      // set recording audio mode explicitly
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          staysActiveInBackground: false,
        });
      } catch (modeErr) {
        console.warn('failed to set recording audio mode', modeErr);
      }

      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
      setVoiceStatus('목적지를 말씀해주세요. 다시 누르면 전송합니다.');
    } catch (cause) {
      recordingRef.current = null;
      setIsRecording(false);
      setVoiceStatus(cause instanceof Error ? cause.message : '녹음을 시작하지 못했습니다.');
    }
  }, [clearRoute]);

  const handleVoiceButtonPress = useCallback(() => {
    if (isRecording) {
      void stopAndSubmitVoice();
      return;
    }

    void startVoiceRecording();
  }, [isRecording, startVoiceRecording, stopAndSubmitVoice]);

  const state = useMemo(() => {
    if (phase === 'input') {
      return {
        phase: '경로 입력',
        accent: '#129FC4',
        title: '어디로 안내할까요?',
        subtitle: '출발지는 직접 입력하고 목적지는 음성으로 말합니다.',
        tts: voiceStatus,
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
  }, [destinationQuery, error, originQuery, phase, route, voiceStatus]);

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
            <Text style={styles.label}>목적지 (음성 입력)</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isRecording ? '목적지 음성 입력 종료' : '목적지 음성 입력 시작'}
              onPress={(event) => {
                event.stopPropagation();
                handleVoiceButtonPress();
              }}
              style={[styles.voiceButton, isRecording && styles.voiceButtonRecording]}>
              {isRecording && <ActivityIndicator color={IeumColors.surface} />}
              <Text style={styles.voiceButtonText}>{isRecording ? '녹음 종료' : '목적지 말하기'}</Text>
            </Pressable>
            <Text style={styles.voiceHint}>{voiceStatus}</Text>
            {destinationQuery.trim() ? (
              <View style={styles.recognizedCard}>
                <Text style={styles.recognizedLabel}>인식된 목적지</Text>
                <Text style={styles.recognizedText}>{destinationQuery.trim()}</Text>
              </View>
            ) : null}
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
  voiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#38516D',
    backgroundColor: '#172130',
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginTop: 2,
  },
  voiceButtonRecording: {
    backgroundColor: '#B84C45',
    borderColor: '#E06E67',
  },
  voiceButtonText: { color: IeumColors.text, fontSize: 14, fontWeight: '800' },
  voiceHint: { color: IeumColors.textMuted, fontSize: 11, marginTop: 8 },
  recognizedCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: IeumColors.border,
    backgroundColor: IeumColors.cardStrong,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  recognizedLabel: { color: IeumColors.textSecondary, fontSize: 11, fontWeight: '700' },
  recognizedText: { color: IeumColors.text, fontSize: 16, fontWeight: '800', marginTop: 4 },
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
