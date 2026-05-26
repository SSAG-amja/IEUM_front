import * as Speech from 'expo-speech';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GuidanceVisual } from '@/components/ieum/guidance-visual';
import { ActionLine, Pill } from '@/components/ieum/ieum-ui';
import { MapPosition, MapVisual } from '@/components/ieum/map-visual';
import {
  allowsHelperMapMode,
  COMMANDS,
  DESTINATION_CANDIDATES,
  getNextIndex,
  getViewState,
  IEUM_STATES,
  shouldOpenRequestPanel,
  TOUCH_ACTIONS,
} from '@/constants/ieum-prototype';
import { IeumColors } from '@/constants/theme';
import { useMutedGuidanceHaptics } from '@/hooks/use-muted-guidance-haptics';
import { useTapSequence } from '@/hooks/use-tap-sequence';

export function IeumPrototypeScreen() {
  const [index, setIndex] = useState(0);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [showRequestPanel, setShowRequestPanel] = useState(false);
  const [helperMode, setHelperMode] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [showHelperReminder, setShowHelperReminder] = useState(false);
  const [mapPan, setMapPan] = useState<MapPosition>({ x: 0, y: 0 });
  const [mapZoom, setMapZoom] = useState(1);
  const announceAutoTrackingReturn = useRef(false);
  const transitionProgress = useSharedValue(1);

  const state = IEUM_STATES[index];
  const viewState = getViewState(state, candidateIndex);
  const actions = TOUCH_ACTIONS[state.key];
  const progress = useMemo(() => `${Math.round(((index + 1) / IEUM_STATES.length) * 100)}%` as const, [index]);
  const transitionKey = `${viewState.key}-${candidateIndex}-${helperMode}`;
  const helperMapAvailable = allowsHelperMapMode(state.key);
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
    setMapPan({ x: 0, y: 0 });
    setMapZoom(1);
  };

  const moveToIndex = (nextIndex: number) => {
    setShowRequestPanel(false);
    setIndex(nextIndex);
    if (!allowsHelperMapMode(IEUM_STATES[nextIndex].key)) {
      setAutoTrackingMode();
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
      setCandidateIndex((previous) => (previous + 1) % DESTINATION_CANDIDATES.length);
      return;
    }

    if (shouldOpenRequestPanel(state.key, count)) {
      setShowRequestPanel(true);
      return;
    }

    const nextIndex = getNextIndex(index, count);
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
  const handleMapTripleTap = () => {
    cancelPendingSequence();
    handleTapAction(3);
  };

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

  const handlePinch = (scaleChange: number) => {
    if (!helperMode) {
      return;
    }
    setMapZoom((previous) =>
      Math.max(0.75, Math.min(1.75, Number((previous * scaleChange).toFixed(3))))
    );
  };

  return (
    <Pressable style={styles.screen} onPress={registerScreenTap} accessible={false}>
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
              {state.key === 'WALK_GUIDANCE' && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="역 입구 도착 시뮬레이션"
                  style={styles.qaButton}
                  onPress={(event) => {
                    event.stopPropagation();
                    moveToIndex(IEUM_STATES.findIndex((item) => item.key === 'ENTERING_STATION'));
                  }}>
                  <Text style={styles.qaButtonText}>QA</Text>
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressValue, { width: progress }]} />
          </View>

          <Animated.View style={[styles.animatedBody, transitionStyle]}>
            <View style={styles.mainContent}>
              <GuidanceVisual
                state={viewState}
                candidatePreviewIndex={state.key === 'CANDIDATE_CONFIRMATION' ? candidateIndex : undefined}
                helperMode={helperMode && helperMapAvailable}
                mapPan={mapPan}
                mapZoom={mapZoom}
                onPan={(dx, dy) => {
                  if (helperMode) {
                    setMapPan((previous) => ({ x: previous.x + dx, y: previous.y + dy }));
                  }
                }}
                onPinch={handlePinch}
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
            </View>

            <View style={styles.actions}>
              <ActionLine count={2} label={actions.two} />
              <ActionLine count={3} label={helperMode ? '자동 안내로 복귀' : actions.three} />
              <ActionLine
                count={4}
                label={actions.four ?? '이 상태에서는 사용하지 않음'}
                muted={!actions.four}
              />
              <Text style={styles.instructions}>화면 전체를 빠르게 2번, 3번, 4번 터치해서 조작합니다</Text>
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
          <Pressable style={styles.fullscreenRoot} onPress={registerScreenTap} accessible={false}>
            <SafeAreaView style={styles.fullscreenSafeArea}>
              <MapVisual
                title="주변 도움 지도"
                fullscreen
                helperMode
                pan={mapPan}
                zoom={mapZoom}
                onPan={(dx, dy) => setMapPan((previous) => ({ x: previous.x + dx, y: previous.y + dy }))}
                onPinch={handlePinch}
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
  qaButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#38516D',
    backgroundColor: '#16283A',
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  qaButtonText: { color: '#7FB8E4', fontSize: 11, fontWeight: '800' },
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
