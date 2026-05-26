import * as Speech from 'expo-speech';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GuidanceVisual } from '@/components/ieum/guidance-visual';
import { ActionLine, Pill } from '@/components/ieum/ieum-ui';
import { MapVisual } from '@/components/ieum/map-visual';
import {
  allowsHelperMapMode,
  COMMANDS,
  DESTINATION_CANDIDATES,
  getNextIndex,
  getRouteInstructionViewState,
  getViewState,
  IEUM_STATES,
  isGpsGuidedInstruction,
  requiresGuidanceConfirmation,
  shouldOpenRequestPanel,
  TOUCH_ACTIONS,
} from '@/constants/ieum-prototype';
import { IeumColors } from '@/constants/theme';
import { useMutedGuidanceHaptics } from '@/hooks/use-muted-guidance-haptics';
import { useTapSequence } from '@/hooks/use-tap-sequence';
import { Coordinate, requestAccessibleRoute, RouteResponse } from '@/services/route-api';

export function IeumPrototypeScreen() {
  const [index, setIndex] = useState(0);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [originQuery, setOriginQuery] = useState('시청역');
  const [destinationQuery, setDestinationQuery] = useState('강남역');
  const [showRequestPanel, setShowRequestPanel] = useState(false);
  const [helperMode, setHelperMode] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [showHelperReminder, setShowHelperReminder] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [guidanceStepIndex, setGuidanceStepIndex] = useState(0);
  const announceAutoTrackingReturn = useRef(false);
  const transitionProgress = useSharedValue(1);

  const state = IEUM_STATES[index];
  const baseViewState = getViewState(state, candidateIndex, originQuery, destinationQuery);
  const routeInstructions = useMemo(
    () => route?.instructions.filter((instruction) => instruction.type !== 'route_start') ?? [],
    [route]
  );
  const activeInstruction =
    state.key === 'WALK_GUIDANCE' ? routeInstructions[guidanceStepIndex] : undefined;
  const instructionViewState = activeInstruction
    ? getRouteInstructionViewState(
        activeInstruction,
        guidanceStepIndex,
        routeInstructions.length,
        routeInstructions[guidanceStepIndex - 1]
      )
    : null;
  const viewState =
    route && state.key === 'BUILDING_ROUTE'
      ? {
          ...baseViewState,
          phase: '경로 계산 완료',
          main: '안전 경로를 찾았습니다',
          sub: `총 ${Math.round(route.summary.total_length_m)}m · ${route.summary.uses_subway ? '지하철 포함' : '도보 경로'} · 환승 ${route.summary.transfer_count}회`,
          tts: `${destinationQuery}까지 접근성 경로를 찾았습니다. 안내를 시작하려면 화면을 두 번 터치해주세요.`,
          chip: 'Safety-first',
        }
      : routeError && state.key === 'BUILDING_ROUTE'
        ? {
            ...baseViewState,
            phase: '경로 탐색 실패',
            main: '경로를 찾지 못했습니다',
            sub: routeError,
            tts: '경로를 찾지 못했습니다. 입력을 확인한 뒤 다시 계산해주세요.',
            chip: '다시 시도',
          }
      : instructionViewState ?? baseViewState;
  const baseActions = TOUCH_ACTIONS[state.key];
  const actions =
    instructionViewState?.key === 'ARRIVED'
      ? { two: '새 목적지 입력', three: '요청 메뉴', four: null }
      : requiresGuidanceConfirmation(activeInstruction)
        ? { two: '현재 안내 다시 듣기', three: '음성 명령', four: '이동 완료 확인 / 다음 안내' }
        : instructionViewState
        ? {
            two: '현재 안내 다시 듣기',
            three: instructionViewState.visual === 'map' ? '음성 명령 / 주변 도움 모드' : '음성 명령',
            four: null,
          }
        : state.key === 'BUILDING_ROUTE' && route
      ? { ...baseActions, two: '안내 시작' }
      : state.key === 'BUILDING_ROUTE' && routeError
        ? { ...baseActions, two: '다시 계산' }
        : baseActions;
  const progress = instructionViewState
    ? `${Math.round(((guidanceStepIndex + 1) / routeInstructions.length) * 100)}%` as const
    : `${Math.round(((index + 1) / IEUM_STATES.length) * 100)}%` as const;
  const transitionKey = `${viewState.key}-${candidateIndex}-${guidanceStepIndex}-${helperMode}`;
  const helperMapAvailable = instructionViewState
    ? isGpsGuidedInstruction(activeInstruction) && instructionViewState.key !== 'ARRIVED'
    : allowsHelperMapMode(state.key);
  const visibleCommands = helperMapAvailable
    ? COMMANDS
    : COMMANDS.filter((command) => command.label !== '주변 도움 모드');
  // Expo Go cannot observe the device media-output volume. In a development build,
  // replace this with `volume === 0` from a native system-volume listener.
  const isOutputMuted: boolean | null = null;

  useMutedGuidanceHaptics({
    guidanceActive: !helperMode && state.key !== 'ARRIVED',
    isOutputMuted,
  });

  const stopSpeech = useCallback(() => {
    Speech.stop();
  }, []);

  const speakAnnouncement = useCallback((announcement: string) => {
    Speech.stop();
    Speech.speak(announcement, {
      language: 'ko-KR',
      rate: 0.95,
      useApplicationAudioSession: false,
    });
  }, []);

  const setAutoTrackingMode = () => {
    setHelperMode(false);
    setMapFullscreen(false);
    setShowHelperReminder(false);
  };

  const calculateRoute = useCallback(async () => {
    if (!originQuery.trim()) {
      setRouteError('출발지를 입력해주세요.');
      return;
    }
    if (!destinationQuery.trim()) {
      setRouteError('목적지를 입력해주세요.');
      return;
    }
    setRouteLoading(true);
    setRouteError(null);
    try {
      Keyboard.dismiss();
      const nextRoute = await requestAccessibleRoute(originQuery.trim(), destinationQuery.trim());
      setCurrentLocation({
        latitude: nextRoute.summary.start.lat,
        longitude: nextRoute.summary.start.lon,
      });
      setGuidanceStepIndex(0);
      setRoute(nextRoute);
    } catch (error) {
      setRoute(null);
      setRouteError(error instanceof Error ? error.message : '경로를 계산하지 못했습니다.');
    } finally {
      setRouteLoading(false);
    }
  }, [destinationQuery, originQuery]);

  const moveToIndex = (nextIndex: number) => {
    setShowRequestPanel(false);
    setIndex(nextIndex);
    if (!allowsHelperMapMode(IEUM_STATES[nextIndex].key)) {
      setAutoTrackingMode();
    }
  };

  const advanceGuidanceStep = () => {
    if (guidanceStepIndex < routeInstructions.length - 1) {
      setGuidanceStepIndex((previous) => previous + 1);
    }
  };

  const handleTapAction = (count: number) => {
    if (count === 3 && helperMode && helperMapAvailable) {
      announceAutoTrackingReturn.current = true;
      setAutoTrackingMode();
      return;
    }

    if (count === 3 && state.key === 'CANDIDATE_CONFIRMATION') {
      setShowRequestPanel(false);
      if (destinationQuery.trim()) {
        moveToIndex(IEUM_STATES.findIndex((item) => item.key === 'WAIT_DESTINATION_INPUT'));
      } else {
        setCandidateIndex((previous) => (previous + 1) % DESTINATION_CANDIDATES.length);
      }
      return;
    }

    if (instructionViewState?.key === 'ARRIVED' && count === 2) {
      setRoute(null);
      setCurrentLocation(null);
      setGuidanceStepIndex(0);
      moveToIndex(IEUM_STATES.findIndex((item) => item.key === 'WAIT_DESTINATION_INPUT'));
      return;
    }

    if (requiresGuidanceConfirmation(activeInstruction) && count === 4) {
      advanceGuidanceStep();
      return;
    }

    if (shouldOpenRequestPanel(state.key, count)) {
      setShowRequestPanel(true);
      return;
    }

    const nextIndex = getNextIndex(index, count);
    if (state.key === 'CANDIDATE_CONFIRMATION' && count === 2) {
      setRoute(null);
      setRouteError(null);
    }
    if (state.key === 'BUILDING_ROUTE' && count === 2 && !route) {
      if (!routeLoading) {
        void calculateRoute();
      }
      return;
    }
    if (nextIndex !== index) {
      moveToIndex(nextIndex);
    } else if (count === 2) {
      setShowRequestPanel(false);
      if (!helperMode) {
        speakAnnouncement(viewState.tts);
      }
    }
  };

  const { registerTap: registerScreenTap, cancelPendingSequence } = useTapSequence(handleTapAction);
  const handleScreenPress = () => {
    Keyboard.dismiss();
    registerScreenTap();
  };
  const handleMapTripleTap = () => {
    cancelPendingSequence();
    handleTapAction(3);
  };

  useEffect(() => {
    if (state.key === 'BUILDING_ROUTE' && !route && !routeLoading && !routeError) {
      void calculateRoute();
    }
  }, [calculateRoute, route, routeError, routeLoading, state.key]);

  useEffect(() => {
    if (helperMode) {
      return;
    }

    const announcement = announceAutoTrackingReturn.current
      ? `자동 안내로 돌아갑니다. ${viewState.tts}`
      : viewState.tts;
    announceAutoTrackingReturn.current = false;
    speakAnnouncement(announcement);

    return () => {
      stopSpeech();
    };
  }, [helperMode, speakAnnouncement, stopSpeech, viewState.tts]);

  useEffect(() => {
    if (!helperMode || !helperMapAvailable) {
      setShowHelperReminder(false);
      return;
    }

    let hideReminder: ReturnType<typeof setTimeout> | null = null;
    const remindReturnGesture = () => {
      setShowHelperReminder(true);
      speakAnnouncement('주변 도움 모드입니다. 자동 안내로 돌아가려면 화면을 세 번 터치해주세요.');
      if (hideReminder) {
        clearTimeout(hideReminder);
      }
      hideReminder = setTimeout(() => setShowHelperReminder(false), 5000);
    };

    remindReturnGesture();
    const interval = setInterval(remindReturnGesture, 20000);

    return () => {
      clearInterval(interval);
      if (hideReminder) {
        clearTimeout(hideReminder);
      }
      stopSpeech();
    };
  }, [helperMapAvailable, helperMode, speakAnnouncement, stopSpeech]);

  useEffect(() => {
    transitionProgress.value = 0;
    transitionProgress.value = withTiming(1, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [transitionKey, transitionProgress]);

  const transitionStyle = useAnimatedStyle(() => ({
    opacity: transitionProgress.value,
    transform: [
      { translateY: (1 - transitionProgress.value) * 18 },
      { scale: 0.98 + transitionProgress.value * 0.02 },
    ],
  }));

  return (
    <Pressable style={styles.screen} onPress={handleScreenPress} accessible={false}>
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          pointerEvents="none"
          colors={[`${viewState.accent}45`, `${viewState.accent}18`, 'transparent']}
          locations={[0, 0.42, 0.82]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.stateGradient}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(105, 221, 235, 0)', 'rgba(105, 221, 235, 0.12)']}
          start={{ x: 0.65, y: 0.2 }}
          end={{ x: 0, y: 1 }}
          style={styles.ambientGradient}
        />
        <View style={styles.content}>
          <View style={styles.header}>
            <View>
              <Text style={styles.logoCaption}>IEUM</Text>
              <Text style={styles.logo}>이음</Text>
            </View>
            <View style={styles.headerActions}>
              <Pill>{viewState.phase}</Pill>
              {isGpsGuidedInstruction(activeInstruction) && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="GPS 자동 이동 시뮬레이션"
                  style={styles.gpsAdvanceButton}
                  onPress={(event) => {
                    event.stopPropagation();
                    advanceGuidanceStep();
                  }}>
                  <Text style={styles.gpsAdvanceButtonText}>GPS 이동</Text>
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressValue, { width: progress }]} />
          </View>

          <Animated.View style={[styles.animatedBody, transitionStyle]}>
            <View style={styles.mainContent}>
              {(state.key === 'WAIT_DESTINATION_INPUT' || state.key === 'LISTENING_DESTINATION') && (
                <View style={styles.destinationCard}>
                  <Text style={styles.destinationLabel}>출발지 (개발용 입력)</Text>
                  <TextInput
                    accessibilityLabel="출발지 입력"
                    value={originQuery}
                    onChangeText={setOriginQuery}
                    onPressIn={(event) => event.stopPropagation()}
                    onSubmitEditing={() => Keyboard.dismiss()}
                    placeholder="예: 시청역 또는 126.977088,37.565715"
                    placeholderTextColor={IeumColors.textMuted}
                    returnKeyType="done"
                    style={styles.destinationInput}
                  />
                  <Text style={styles.destinationLabel}>목적지</Text>
                  <TextInput
                    accessibilityLabel="목적지 입력"
                    value={destinationQuery}
                    onChangeText={setDestinationQuery}
                    onPressIn={(event) => event.stopPropagation()}
                    onSubmitEditing={() => Keyboard.dismiss()}
                    placeholder="예: 강남역"
                    placeholderTextColor={IeumColors.textMuted}
                    returnKeyType="done"
                    style={styles.destinationInput}
                  />
                  <Text style={styles.destinationHint}>서울 내 역명 또는 경도,위도 좌표로 접근성 경로를 테스트합니다.</Text>
                </View>
              )}
              <GuidanceVisual
                state={viewState}
                helperMode={helperMode && helperMapAvailable}
                currentLocation={currentLocation}
                route={route}
                instruction={activeInstruction}
                onMapTripleTap={handleMapTripleTap}
                onOpenFullscreen={() => setMapFullscreen(true)}
              />

              <View style={styles.titleBlock}>
                <Pill>{viewState.chip}</Pill>
                <Text style={styles.title}>{viewState.main}</Text>
                <Text style={styles.subtitle} numberOfLines={2}>
                  {viewState.sub}
                </Text>
              </View>

              <View style={styles.ttsCard}>
                <Text style={styles.ttsHeading}>🔊  현재 음성 안내</Text>
                <Text style={styles.ttsText} numberOfLines={2}>
                  {viewState.tts}
                </Text>
              </View>
              {state.key === 'BUILDING_ROUTE' && routeLoading && (
                <View style={styles.routeStatus}>
                  <ActivityIndicator color={IeumColors.cyan} />
                  <Text style={styles.routeStatusText}>입력한 출발지에서 경로를 계산 중입니다.</Text>
                </View>
              )}
              {state.key === 'BUILDING_ROUTE' && routeError && (
                <View style={styles.routeError}>
                  <Text style={styles.routeErrorText}>{routeError}</Text>
                  <Pressable style={styles.retryButton} onPress={() => void calculateRoute()}>
                    <Text style={styles.retryButtonText}>다시 계산</Text>
                  </Pressable>
                </View>
              )}
              {route && state.key === 'BUILDING_ROUTE' && (
                <View style={styles.routeSteps}>
                  {routeInstructions.slice(0, 3).map((instruction, stepIndex) => (
                    <Text key={`${instruction.type}-${stepIndex}`} style={styles.routeStepText} numberOfLines={2}>
                      {stepIndex + 1}. {instruction.text}
                    </Text>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.actions}>
              <ActionLine count={2} label={actions.two} />
              <ActionLine count={3} label={helperMode ? '자동 안내로 복귀' : actions.three} />
              {(!activeInstruction || requiresGuidanceConfirmation(activeInstruction)) && (
                <ActionLine
                  count={4}
                  label={actions.four ?? '이 상태에서는 사용하지 않음'}
                  muted={!actions.four}
                />
              )}
              <Text style={styles.instructions}>
                {instructionViewState?.key === 'ARRIVED'
                  ? '새 목적지 안내를 시작하려면 화면을 빠르게 2번 터치하세요'
                  : isGpsGuidedInstruction(activeInstruction)
                  ? '실외 구간은 GPS 이동 버튼으로 자동 진행을 시뮬레이션합니다'
                  : requiresGuidanceConfirmation(activeInstruction)
                    ? '다시 듣기는 2번, 이동 완료 확인은 화면을 빠르게 4번 터치하세요'
                    : '화면 전체를 빠르게 2번, 3번, 4번 터치해서 조작합니다'}
              </Text>
            </View>
          </Animated.View>
        </View>

        {showHelperReminder && helperMode && (
          <View pointerEvents="none" style={styles.helperReminder}>
            <Text style={styles.helperReminderText}>🔊 자동 안내 복귀: 화면을 3번 터치하세요</Text>
          </View>
        )}

        <Modal transparent visible={showRequestPanel} animationType="slide" onRequestClose={() => setShowRequestPanel(false)}>
          <View style={styles.modalRoot}>
            <Pressable
              accessibilityLabel="요청 메뉴 닫기"
              style={styles.modalBackdrop}
              onPress={() => setShowRequestPanel(false)}
            />
            <View style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <Text style={styles.requestHeading}>🎙️  다른 선택 / 요청</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="요청 메뉴 닫기"
                  style={styles.closeButton}
                  onPress={() => setShowRequestPanel(false)}>
                  <Text style={styles.closeButtonText}>닫기</Text>
                </Pressable>
              </View>
              <View style={styles.commandGrid}>
                {visibleCommands.map((command) => (
                  <Pressable
                    key={command.label}
                    accessibilityRole="button"
                    accessibilityLabel={command.label}
                    style={styles.command}
                    onPress={() => {
                      if (command.label === '주변 도움 모드') {
                        setHelperMode((previous) => !previous);
                        setShowRequestPanel(false);
                      }
                    }}>
                    <Text style={styles.commandText}>
                      {command.icon}  {command.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={mapFullscreen && helperMode}
          animationType="fade"
          onRequestClose={() => setMapFullscreen(false)}>
          <Pressable style={styles.fullscreenRoot} onPress={handleScreenPress} accessible={false}>
            <SafeAreaView style={styles.fullscreenSafeArea}>
              <MapVisual
                title="주변 도움 지도"
                fullscreen
                helperMode
                currentLocation={currentLocation}
                route={route}
                onTripleTap={handleMapTripleTap}
                onCloseFullscreen={() => setMapFullscreen(false)}
              />
              {showHelperReminder && (
                <View pointerEvents="none" style={styles.fullscreenReminder}>
                  <Text style={styles.helperReminderText}>🔊 자동 안내 복귀: 화면을 3번 터치하세요</Text>
                </View>
              )}
            </SafeAreaView>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: IeumColors.page },
  safeArea: { flex: 1, backgroundColor: IeumColors.surface },
  stateGradient: { ...StyleSheet.absoluteFillObject },
  ambientGradient: { ...StyleSheet.absoluteFillObject },
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoCaption: { color: '#8491A4', fontSize: 11, letterSpacing: 4, fontWeight: '600' },
  logo: { color: IeumColors.text, fontSize: 19, lineHeight: 28, fontWeight: '700' },
  gpsAdvanceButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#276C86',
    backgroundColor: '#153743',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  gpsAdvanceButtonText: { color: IeumColors.cyan, fontSize: 11, fontWeight: '800' },
  progressTrack: { height: 5, backgroundColor: '#273141', borderRadius: 10, marginTop: 10, overflow: 'hidden' },
  progressValue: { height: 6, backgroundColor: '#EEF2F7', borderRadius: 10 },
  animatedBody: { flex: 1 },
  mainContent: { flex: 1, justifyContent: 'center', minHeight: 0 },
  titleBlock: { alignItems: 'center', marginTop: 10 },
  title: {
    marginTop: 8,
    color: IeumColors.text,
    fontSize: 25,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  subtitle: {
    maxWidth: 330,
    marginTop: 5,
    color: IeumColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  ttsCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: IeumColors.border,
    backgroundColor: IeumColors.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  ttsHeading: { color: '#E1E5EB', fontWeight: '700', fontSize: 12 },
  ttsText: { color: '#B7C0CE', fontSize: 12, lineHeight: 17, marginTop: 5 },
  destinationCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: IeumColors.border,
    backgroundColor: IeumColors.card,
    padding: 12,
    marginBottom: 10,
  },
  destinationLabel: { color: IeumColors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 8 },
  destinationInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A485C',
    color: IeumColors.text,
    backgroundColor: IeumColors.cardStrong,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 16,
  },
  destinationHint: { color: IeumColors.textMuted, fontSize: 11, marginTop: 7 },
  routeStatus: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  routeStatusText: { color: IeumColors.textSecondary, fontSize: 12 },
  routeError: { marginTop: 10, alignItems: 'center', gap: 8 },
  routeErrorText: { color: '#FF9C95', fontSize: 12, textAlign: 'center' },
  retryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#38516D',
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  retryButtonText: { color: IeumColors.cyan, fontSize: 12, fontWeight: '700' },
  routeSteps: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: '#111D2D',
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 4,
  },
  routeStepText: { color: '#C7D0DE', fontSize: 11, lineHeight: 15 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3, 7, 13, 0.68)' },
  requestCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#205162',
    backgroundColor: '#10313E',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  requestHeading: { color: '#ADF0F5', fontWeight: '700', fontSize: 13 },
  closeButton: { borderRadius: 12, backgroundColor: '#203F4B', paddingHorizontal: 12, paddingVertical: 7 },
  closeButtonText: { color: '#D3DCE5', fontSize: 12, fontWeight: '700' },
  commandGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  command: {
    width: '48.8%',
    borderRadius: 13,
    backgroundColor: '#203F4B',
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  commandText: { color: '#D3DCE5', fontSize: 12, fontWeight: '600' },
  actions: { gap: 5, marginTop: 8, paddingBottom: 2 },
  instructions: { color: IeumColors.textMuted, textAlign: 'center', fontSize: 10, marginTop: 4 },
  helperReminder: {
    position: 'absolute',
    top: 62,
    left: 16,
    right: 16,
    zIndex: 20,
    borderWidth: 1,
    borderColor: '#705826',
    borderRadius: 12,
    backgroundColor: '#382F1D',
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  helperReminderText: { color: IeumColors.amber, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  fullscreenRoot: { flex: 1, backgroundColor: IeumColors.page },
  fullscreenSafeArea: { flex: 1, backgroundColor: IeumColors.cardStrong },
  fullscreenReminder: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 18,
    borderWidth: 1,
    borderColor: '#705826',
    borderRadius: 12,
    backgroundColor: '#382F1D',
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
});
