import { type Href, useRouter } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionLine, Pill } from '@/components/ieum/ieum-ui';
import { MapVisual } from '@/components/ieum/map-visual';
import { IeumColors } from '@/constants/theme';
import { distanceMeters } from '@/features/ieum/guidance/route-navigator';
import { useCurrentLocation } from '@/features/ieum/guidance/use-current-location';
import { useTapSequence } from '@/hooks/use-tap-sequence';
import { requestAccessibleRoute } from '@/services/route-api';
import { useRouteSession } from '@/features/ieum/session/route-session-provider';
import { ScreenFrame } from '@/features/ieum/shared/screen-frame';
import { repeatAnnouncement, useAnnouncement } from '@/features/ieum/shared/use-announcement';

type DestinationPhase = 'input' | 'candidate' | 'building';
type VoiceCaptureStage = 'prompting' | 'starting' | 'listening' | 'processing' | 'retry';
const GUIDANCE_ROUTE = '/guidance' as Href;
const API_URL = process.env.EXPO_PUBLIC_IEUM_API_URL ?? 'http://127.0.0.1:8020';
const VOICE_DESTINATION_URL = `${API_URL}/api/v1/voice/destination`;
const VOICE_PROMPT = '목적지를 말씀해주세요.';
const LOCATION_WAIT_PROMPT = '현재 위치를 파악 중입니다. 잠시만 기다려 주세요.';
const LOCATION_READY_PROMPT = '현재 위치 파악이 끝났습니다. 목적지를 말씀해주세요.';
const CUE_DURATION_MS = 760;
const PENDING_CURRENT_LOCATION_LABEL = '현재 위치 확인 중';

type VoiceDestinationResponse = {
  text: string;
  destination: string;
};

function speakPrompt(text: string) {
  return new Promise<void>((resolve) => {
    Speech.speak(text, {
      language: 'ko-KR',
      rate: 0.95,
      useApplicationAudioSession: false,
      onDone: resolve,
      onStopped: resolve,
      onError: () => resolve(),
    });
  });
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export function DestinationScreen() {
  const router = useRouter();
  const {
    originQuery,
    originCoordinate,
    destinationQuery,
    route,
    setOriginQuery,
    setOriginCoordinate,
    setDestinationQuery,
    setRoute,
    clearRoute,
  } = useRouteSession();
  const [phase, setPhase] = useState<DestinationPhase>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceStatus, setVoiceStatus] = useState(VOICE_PROMPT);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceFlowActive, setIsVoiceFlowActive] = useState(false);
  const [voiceCaptureStage, setVoiceCaptureStage] = useState<VoiceCaptureStage>('prompting');
  const [originStatus, setOriginStatus] = useState('현재 위치를 확인하는 중입니다.');
  const [isOriginReady, setIsOriginReady] = useState(false);
  const endCuePlayer = useAudioPlayer(require('../../../assets/audio/voice_recognition_end_tiding_down.wav'));
  const gps = useCurrentLocation(phase !== 'building' || !route);
  const isRecognitionActiveRef = useRef(false);
  const recognitionSettledRef = useRef(true);
  const ignoredAbortCountRef = useRef(0);
  const activeRecognitionSequenceRef = useRef(0);
  const voiceSequenceRef = useRef(0);
  const phaseRef = useRef(phase);
  const autoOriginRef = useRef<string | null>(null);
  const lastReverseGeocodedOriginRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const locationReadyPromptedRef = useRef(false);
  phaseRef.current = phase;

  const formatCurrentAddress = useCallback((address: Location.LocationGeocodedAddress) => {
    const road = [address.street, address.name].filter(Boolean).join(' ');
    const area = [address.region, address.city, address.district].filter(Boolean).join(' ');
    return (road || area || '현재 위치').trim();
  }, []);

  useEffect(() => {
    const current = gps.currentLocation;
    if (!current) {
      if (gps.error) {
        setOriginStatus(gps.error);
      }
      setIsOriginReady(false);
      return;
    }

    const fixedCurrent = current;
    let cancelled = false;
    async function updateOriginFromCurrentLocation() {
      const coordinate = { latitude: fixedCurrent.latitude, longitude: fixedCurrent.longitude };
      const previous = lastReverseGeocodedOriginRef.current;
      if (previous && distanceMeters(previous, coordinate) < 25) {
        return;
      }
      lastReverseGeocodedOriginRef.current = coordinate;
      try {
        const [address] = await Location.reverseGeocodeAsync(coordinate);
        if (cancelled) {
          return;
        }
        const label = address ? formatCurrentAddress(address) : `현재 위치 ${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`;
        if (!originQuery.trim() || originQuery === PENDING_CURRENT_LOCATION_LABEL || originQuery === autoOriginRef.current) {
          autoOriginRef.current = label;
          setOriginQuery(label);
          setOriginCoordinate(coordinate);
          setIsOriginReady(true);
          clearRoute();
        }
        setOriginStatus(`현재 위치 출발지: ${label}`);
      } catch {
        if (!cancelled) {
          const label = `현재 위치 ${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`;
          if (!originQuery.trim() || originQuery === PENDING_CURRENT_LOCATION_LABEL || originQuery === autoOriginRef.current) {
            autoOriginRef.current = label;
            setOriginQuery(label);
            setOriginCoordinate(coordinate);
            setIsOriginReady(true);
            clearRoute();
          }
          setOriginStatus('주소 변환은 실패했지만 현재 위치 좌표를 출발지로 사용합니다.');
        }
      }
    }

    void updateOriginFromCurrentLocation();

    return () => {
      cancelled = true;
    };
  }, [
    clearRoute,
    formatCurrentAddress,
    gps.currentLocation,
    gps.error,
    originQuery,
    setOriginCoordinate,
    setOriginQuery,
  ]);

  useEffect(() => {
    setDestinationQuery('');
    setRoute(null);
    clearRoute();
    setVoiceStatus(VOICE_PROMPT);
    setVoiceCaptureStage('prompting');
  }, [clearRoute, setDestinationQuery, setRoute]);

  useEffect(() => {
    return () => {
      voiceSequenceRef.current += 1;
      recognitionSettledRef.current = true;
      if (isRecognitionActiveRef.current) {
        isRecognitionActiveRef.current = false;
        ExpoSpeechRecognitionModule.abort();
      }
    };
  }, []);

  const signalVoiceInputStart = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const playEndCue = useCallback(async () => {
    await endCuePlayer.seekTo(0);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    endCuePlayer.play();
    await wait(CUE_DURATION_MS);
  }, [endCuePlayer]);

  const sendRecognizedDestinationText = useCallback(async (text: string) => {
    let response: Response;
    try {
      response = await fetch(VOICE_DESTINATION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    } catch {
      throw new Error('목적지 분석 요청에 실패했습니다. 네트워크를 확인하세요.');
    }

    const payload = (await response.json()) as VoiceDestinationResponse & { detail?: unknown };
    if (!response.ok) {
      throw new Error(typeof payload.detail === 'string' ? payload.detail : '음성 목적지를 확인하지 못했습니다.');
    }
    return payload;
  }, []);

  const failVoiceRecognition = useCallback((message: string) => {
    if (recognitionSettledRef.current) {
      return;
    }

    recognitionSettledRef.current = true;
    isRecognitionActiveRef.current = false;
    setIsListening(false);
    setIsVoiceFlowActive(false);
    setError(message);
    setVoiceStatus(message);
    setVoiceCaptureStage('retry');
    repeatAnnouncement(message);
  }, []);

  const completeVoiceRecognition = useCallback(async (destination: string) => {
    if (recognitionSettledRef.current || phaseRef.current !== 'input') {
      return;
    }

    const sequence = activeRecognitionSequenceRef.current;
    recognitionSettledRef.current = true;
    isRecognitionActiveRef.current = false;
    setIsListening(false);
    setIsVoiceFlowActive(true);
    setVoiceCaptureStage('processing');
    await Speech.stop();
    setVoiceStatus('종료 신호음입니다. 목적지를 확인 중입니다.');
    await playEndCue();

    if (sequence !== voiceSequenceRef.current || phaseRef.current !== 'input') {
      setIsVoiceFlowActive(false);
      return;
    }

    try {
      const result = await sendRecognizedDestinationText(destination);
      const extractedDestination = result.destination.trim();
      if (!extractedDestination) {
        throw new Error('목적지를 인식하지 못했습니다. 화면을 두 번 터치해 다시 입력해주세요.');
      }

      setError(null);
      setDestinationQuery(extractedDestination);
      clearRoute();
      setIsVoiceFlowActive(false);
      setPhase('candidate');
      setVoiceStatus(`${extractedDestination}으로 인식했습니다.`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '음성 목적지를 처리하지 못했습니다.';
      setIsVoiceFlowActive(false);
      setError(message);
      setVoiceStatus(message);
      setVoiceCaptureStage('retry');
      repeatAnnouncement(message);
    }
  }, [clearRoute, playEndCue, sendRecognizedDestinationText, setDestinationQuery]);

  const startVoiceRecognition = useCallback(async (sequence: number) => {
    try {
      setIsVoiceFlowActive(true);
      setVoiceStatus('음성 인식 권한을 확인 중입니다.');

      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        const message = '이 기기에서 음성 인식을 사용할 수 없습니다. 화면을 두 번 터치해 다시 시도해주세요.';
        setIsVoiceFlowActive(false);
        setVoiceStatus(message);
        setVoiceCaptureStage('retry');
        repeatAnnouncement(message);
        return;
      }

      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        const message = '마이크와 음성 인식 권한이 필요합니다. 화면을 두 번 터치해 다시 시도해주세요.';
        setIsVoiceFlowActive(false);
        setVoiceStatus(message);
        setVoiceCaptureStage('retry');
        repeatAnnouncement(message);
        return;
      }

      setVoiceCaptureStage('starting');
      setVoiceStatus('진동 뒤에 목적지를 말씀해주세요.');
      await signalVoiceInputStart();
      if (sequence !== voiceSequenceRef.current || phaseRef.current !== 'input') {
        setIsVoiceFlowActive(false);
        return;
      }

      activeRecognitionSequenceRef.current = sequence;
      recognitionSettledRef.current = false;
      ExpoSpeechRecognitionModule.start({
        lang: 'ko-KR',
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
      });
    } catch (cause) {
      recognitionSettledRef.current = false;
      failVoiceRecognition(cause instanceof Error ? cause.message : '음성 인식을 시작하지 못했습니다.');
    }
  }, [failVoiceRecognition, signalVoiceInputStart]);

  const cancelCurrentRecognition = useCallback(() => {
    recognitionSettledRef.current = true;
    if (isRecognitionActiveRef.current) {
      ignoredAbortCountRef.current += 1;
      ExpoSpeechRecognitionModule.abort();
      isRecognitionActiveRef.current = false;
    }
    setIsListening(false);
  }, []);

  useSpeechRecognitionEvent('start', () => {
    if (recognitionSettledRef.current || phaseRef.current !== 'input') {
      return;
    }
    isRecognitionActiveRef.current = true;
    setIsListening(true);
    setVoiceCaptureStage('listening');
    setVoiceStatus('듣는 중입니다. 말씀을 마치면 자동으로 확인합니다.');
  });

  useSpeechRecognitionEvent('result', (event) => {
    if (recognitionSettledRef.current || phaseRef.current !== 'input') {
      return;
    }
    const destination = event.results[0]?.transcript.trim() ?? '';
    if (!destination) {
      return;
    }
    setDestinationQuery(destination);
    setVoiceStatus(`인식 중: ${destination}`);
    if (event.isFinal) {
      void completeVoiceRecognition(destination);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'aborted' && ignoredAbortCountRef.current > 0) {
      ignoredAbortCountRef.current -= 1;
      return;
    }
    const message =
      event.error === 'no-speech' || event.error === 'speech-timeout'
        ? '목적지를 듣지 못했습니다. 화면을 두 번 터치해 다시 입력해주세요.'
        : event.error === 'not-allowed'
          ? '마이크와 음성 인식 권한이 필요합니다. 설정을 확인해주세요.'
          : `음성 인식을 완료하지 못했습니다. 화면을 두 번 터치해 다시 입력해주세요. (${event.error})`;
    failVoiceRecognition(message);
  });

  useSpeechRecognitionEvent('end', () => {
    if (isRecognitionActiveRef.current && !recognitionSettledRef.current) {
      failVoiceRecognition('목적지를 인식하지 못했습니다. 화면을 두 번 터치해 다시 입력해주세요.');
    }
  });

  const promptAndStartVoiceRecognition = useCallback(async (promptText = VOICE_PROMPT) => {
    const sequence = voiceSequenceRef.current + 1;
    voiceSequenceRef.current = sequence;
    setError(null);
    clearRoute();
    setDestinationQuery('');
    setIsVoiceFlowActive(true);
    setVoiceCaptureStage('prompting');
    await Speech.stop();
    cancelCurrentRecognition();
    setVoiceStatus(promptText);
    await speakPrompt(promptText);

    if (sequence !== voiceSequenceRef.current || phaseRef.current !== 'input') {
      setIsVoiceFlowActive(false);
      return;
    }
    await startVoiceRecognition(sequence);
  }, [cancelCurrentRecognition, clearRoute, setDestinationQuery, startVoiceRecognition]);

  useEffect(() => {
    if (phase === 'input') {
      if (!isOriginReady) {
        setVoiceStatus(LOCATION_WAIT_PROMPT);
        setVoiceCaptureStage('prompting');
        setIsVoiceFlowActive(false);
        repeatAnnouncement(LOCATION_WAIT_PROMPT);
        return;
      }
      if (!locationReadyPromptedRef.current) {
        locationReadyPromptedRef.current = true;
        void promptAndStartVoiceRecognition(LOCATION_READY_PROMPT);
        return;
      }
      void promptAndStartVoiceRecognition();
    } else {
      voiceSequenceRef.current += 1;
      cancelCurrentRecognition();
    }
  }, [cancelCurrentRecognition, isOriginReady, phase, promptAndStartVoiceRecognition]);

  const state = useMemo(() => {
    if (phase === 'input') {
      return {
        phase: '경로 입력',
        accent: '#129FC4',
        title: isOriginReady ? '어디로 안내할까요?' : '현재 위치 확인 중',
        subtitle: isOriginReady
          ? '목적지를 말씀한 뒤 잠시 기다리면 자동으로 확인합니다.'
          : '출발지로 사용할 현재 위치를 확인하고 있습니다.',
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
  }, [destinationQuery, error, isOriginReady, originQuery, phase, route, voiceStatus]);

  useAnnouncement(state.tts, phase !== 'input' && !isVoiceFlowActive);

  const calculateRoute = useCallback(async () => {
    setPhase('building');
    setLoading(true);
    setError(null);
    clearRoute();
    try {
      if (!originCoordinate && originQuery.trim() === PENDING_CURRENT_LOCATION_LABEL) {
        throw new Error('현재 위치를 아직 확인하지 못했습니다. 위치 권한을 허용하고 잠시 뒤 다시 시도해주세요.');
      }
      const origin = originCoordinate
        ? { query: originQuery.trim(), coordinate: originCoordinate, label: originQuery.trim() || '현재 위치' }
        : originQuery.trim();
      const response = await requestAccessibleRoute(origin, destinationQuery.trim());
      setRoute(response);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '경로를 계산하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [clearRoute, destinationQuery, originCoordinate, originQuery, setRoute]);

  const handleTap = (count: number) => {
    if (count === 2 && phase === 'input') {
      Keyboard.dismiss();
      if (!isOriginReady) {
        repeatAnnouncement(LOCATION_WAIT_PROMPT);
        return;
      }
      void promptAndStartVoiceRecognition();
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
  const isVoiceCueActive = voiceCaptureStage === 'starting' || voiceCaptureStage === 'processing';
  const voiceStateLabel =
    voiceCaptureStage === 'starting'
      ? '진동 후 말씀해주세요'
      : voiceCaptureStage === 'listening'
        ? '듣는 중 · 말씀을 마치면 자동 완료'
        : voiceCaptureStage === 'processing'
          ? '종료 신호음 · 확인 중'
          : '화면을 두 번 터치해 다시 입력';

  return (
    <ScreenFrame
      phase={state.phase}
      accent={state.accent}
      warm={voiceCaptureStage === 'starting' || isListening}
      onPress={handleScreenPress}>
      <View style={styles.body}>
        {phase === 'input' && (
          <View style={styles.inputCard}>
            <Text style={styles.label}>출발지 (개발용 입력)</Text>
            <TextInput
              accessibilityLabel="출발지 입력"
              value={originQuery}
              onChangeText={(value) => {
                autoOriginRef.current = null;
                setOriginQuery(value);
                setOriginCoordinate(null);
                setIsOriginReady(Boolean(value.trim()));
                clearRoute();
              }}
              onPressIn={(event) => event.stopPropagation()}
              onSubmitEditing={Keyboard.dismiss}
              placeholder="예: 고덕로 210 또는 127.1500,37.5500"
              placeholderTextColor={IeumColors.textMuted}
              returnKeyType="done"
              style={styles.input}
            />
            <Text style={styles.originStatus}>{originStatus}</Text>
            <Text style={styles.label}>목적지 (음성 입력)</Text>
            <View style={[styles.voiceState, isListening && styles.voiceStateRecording, isVoiceCueActive && styles.voiceStateCue]}>
              {(isListening || isVoiceCueActive) && <ActivityIndicator color={IeumColors.surface} />}
              <Text style={styles.voiceStateText}>{voiceStateLabel}</Text>
            </View>
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
          label={phase === 'input' ? '다시 입력' : phase === 'candidate' ? '경로 탐색' : route ? '안내 시작' : '다시 계산'}
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
  voiceState: {
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
  voiceStateRecording: {
    backgroundColor: '#B84C45',
    borderColor: '#E06E67',
  },
  voiceStateCue: {
    backgroundColor: '#8F5631',
    borderColor: '#D8944A',
  },
  voiceStateText: { color: IeumColors.text, fontSize: 14, fontWeight: '800' },
  voiceHint: { color: IeumColors.textMuted, fontSize: 11, marginTop: 8 },
  originStatus: { color: IeumColors.cyan, fontSize: 11, lineHeight: 16, marginTop: 8 },
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
