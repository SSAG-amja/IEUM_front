import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GuidanceVisual } from '@/components/ieum/guidance-visual';
import { ActionLine, Pill } from '@/components/ieum/ieum-ui';
import { MapVisual } from '@/components/ieum/map-visual';
import { IeumColors } from '@/constants/theme';
import { getDebugRoute } from '@/features/ieum/debug/route-fixtures';
import { useCurrentLocation } from '@/features/ieum/guidance/use-current-location';
import { useGpsGuidance } from '@/features/ieum/guidance/use-gps-guidance';
import { useGuidanceController } from '@/features/ieum/guidance/use-guidance-controller';
import { bearingDegrees, distanceMeters, type NavigationFix } from '@/features/ieum/guidance/route-navigator';
import { useRouteSession } from '@/features/ieum/session/route-session-provider';
import { ScreenFrame } from '@/features/ieum/shared/screen-frame';
import { repeatAnnouncement, useAnnouncement } from '@/features/ieum/shared/use-announcement';
import { useTapSequence } from '@/hooks/use-tap-sequence';
import { RouteInstruction } from '@/services/route-api';

const DESTINATION_ROUTE = '/destination' as Href;
const HELPER_MODE_ANNOUNCEMENT_INTERVAL_MS = 20000;
const GPS_APPROACH_ANNOUNCEMENT_THRESHOLDS_M = [5, 10, 50, 100] as const;
const GPS_APPROACH_ANNOUNCEMENT_LEAD_M = 10;
const HEADING_SAFE_ANGLE_DEG = 45;
const HEADING_WARNING_COOLDOWN_MS = 9000;
const HEADING_WARNING_HAPTIC_INTERVAL_MS = 1200;
const MOVING_SPEED_THRESHOLD_MPS = 0.4;
const MOVING_PROGRESS_THRESHOLD_M = 2;
const MOVING_PROGRESS_SAMPLE_MS = 5000;
const MOVEMENT_HEADING_MIN_DISTANCE_M = 2;
const MOVEMENT_HEADING_MAX_AGE_MS = 6000;
const HELPER_MODE_ANNOUNCEMENT =
  '주변 도움 모드입니다. 지도를 직접 확인할 수 있습니다. 화면을 세 번 터치하면 자동 안내로 돌아갑니다.';
const HELPER_MODE_EXIT_ANNOUNCEMENT = '주변 도움 모드가 비활성화되었습니다. 자동 안내로 돌아갑니다.';
const REQUEST_PANEL_ANNOUNCEMENT =
  '경로 안내 취소를 원하시면 두 번, 주변 도움 모드가 필요하면 세 번 터치해주세요. 다시 돌아가려면 네 번 터치해주세요.';
const HELPER_MODE_UNAVAILABLE_ANNOUNCEMENT = '현재 구간에서는 주변 도움 모드를 사용할 수 없습니다.';
const WRONG_HEADING_ANNOUNCEMENT = '현재 진행 방향과 경로 방향이 맞지 않습니다. 경로 방향을 다시 확인해주세요.';

function headingDifferenceDegrees(left: number, right: number) {
  return Math.abs(((left - right + 540) % 360) - 180);
}

function isValidHeading(heading?: number | null): heading is number {
  return typeof heading === 'number' && Number.isFinite(heading) && heading >= 0;
}

function turnDirectionLabel(instruction?: RouteInstruction) {
  const text = `${instruction?.direction ?? ''} ${instruction?.text ?? ''}`.toLowerCase();
  if (text.includes('좌') || text.includes('왼쪽') || text.includes('left')) {
    return '좌회전';
  }
  if (text.includes('우') || text.includes('오른쪽') || text.includes('right')) {
    return '우회전';
  }
  return null;
}

function approachAnnouncement(thresholdM: number, nextInstruction?: RouteInstruction) {
  if (thresholdM === 5) {
    const turn = turnDirectionLabel(nextInstruction);
    return turn ? `잠시 후 ${turn}입니다.` : '잠시 후 다음 안내입니다.';
  }
  return `다음 안내까지 약 ${thresholdM}미터 남았습니다.`;
}

function repeatAnnouncementWhenIdle(text: string, isStillValid?: () => boolean, retries = 8) {
  void Speech.isSpeakingAsync().then((isSpeaking) => {
    if (!isSpeaking && (isStillValid?.() ?? true)) {
      repeatAnnouncement(text);
      return;
    }
    if (retries > 0 && (isStillValid?.() ?? true)) {
      setTimeout(() => {
        repeatAnnouncementWhenIdle(text, isStillValid, retries - 1);
      }, 700);
    }
  });
}

function useMovementHeading(location: NavigationFix | null) {
  const previousLocationRef = useRef<NavigationFix | null>(null);
  const [movementHeading, setMovementHeading] = useState<{ heading: number; updatedAt: number } | null>(null);

  useEffect(() => {
    if (!location) {
      previousLocationRef.current = null;
      setMovementHeading(null);
      return;
    }

    const now = Date.now();
    const speed = location.speed ?? 0;
    const gpsHeading = location.heading;
    const previousLocation = previousLocationRef.current;

    if (speed >= MOVING_SPEED_THRESHOLD_MPS && isValidHeading(gpsHeading)) {
      previousLocationRef.current = location;
      setMovementHeading({ heading: gpsHeading, updatedAt: now });
      return;
    }

    if (previousLocation) {
      const movedM = distanceMeters(previousLocation, location);
      if (movedM >= MOVEMENT_HEADING_MIN_DISTANCE_M) {
        previousLocationRef.current = location;
        setMovementHeading({ heading: bearingDegrees(previousLocation, location), updatedAt: now });
        return;
      }
    } else {
      previousLocationRef.current = location;
    }
  }, [location]);

  if (!movementHeading || Date.now() - movementHeading.updatedAt > MOVEMENT_HEADING_MAX_AGE_MS) {
    return null;
  }

  return movementHeading.heading;
}

export function GuidanceScreen() {
  const router = useRouter();
  const { debug } = useLocalSearchParams<{ debug?: string | string[] }>();
  const debugRoute = useMemo(() => getDebugRoute(debug), [debug]);
  const { route: sessionRoute, clearRoute } = useRouteSession();
  const route = debugRoute ?? sessionRoute;
  const controller = useGuidanceController(route);
  const gps = useCurrentLocation(Boolean(route));
  const movementHeading = useMovementHeading(gps.currentLocation);
  const gpsGuidance = useGpsGuidance({
    route,
    instructions: controller.instructions,
    stepIndex: controller.stepIndex,
    currentLocation: gps.currentLocation,
    onStepChange: controller.goToStep,
  });
  const [helperMode, setHelperMode] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [showRequestPanel, setShowRequestPanel] = useState(false);
  const [suppressReturnedStepAnnouncement, setSuppressReturnedStepAnnouncement] = useState(false);
  const lastGpsPromptRef = useRef<{ stepIndex: number; keys: string[]; previousRemainingM?: number } | null>(null);
  const lastHeadingWarningAtRef = useRef(0);
  const lastHeadingWarningHapticAtRef = useRef(0);
  const progressSampleRef = useRef<{ progressM: number; sampledAt: number; isMoving: boolean } | null>(null);
  const stepIndexRef = useRef(controller.stepIndex);
  const skipMissingRouteRedirectRef = useRef(false);
  const canUseHelperMode = Boolean(controller.presentation?.visual === 'map' && controller.isGpsGuided);
  const hasCurrentGpsMatch = gpsGuidance.matchStepIndex === controller.stepIndex;
  stepIndexRef.current = controller.stepIndex;

  useEffect(() => {
    if (!route && !skipMissingRouteRedirectRef.current) {
      router.replace(DESTINATION_ROUTE);
    }
  }, [route, router]);

  useEffect(() => {
    if (!controller.isGpsGuided) {
      setHelperMode(false);
      setMapFullscreen(false);
    }
  }, [controller.isGpsGuided]);

  useEffect(() => {
    setSuppressReturnedStepAnnouncement(false);
    lastGpsPromptRef.current = { stepIndex: controller.stepIndex, keys: [] };
    progressSampleRef.current = null;
  }, [controller.stepIndex]);

  useEffect(() => {
    if (helperMode || !controller.isGpsGuided || !hasCurrentGpsMatch) {
      return;
    }

    const remainingM = gpsGuidance.match?.remainingInstructionM;
    const currentPromptState =
      lastGpsPromptRef.current?.stepIndex === controller.stepIndex
        ? lastGpsPromptRef.current
        : { stepIndex: controller.stepIndex, keys: [] };
    const updatePromptState = (keys: string[], previousRemainingM?: number) => {
      lastGpsPromptRef.current = {
        stepIndex: controller.stepIndex,
        keys,
        previousRemainingM,
      };
    };
    const markPrompt = (key: string, previousRemainingM?: number) => {
      updatePromptState([...currentPromptState.keys, key], previousRemainingM);
    };

    if (gpsGuidance.offRoute && !currentPromptState.keys.includes('off_route')) {
      markPrompt('off_route');
      repeatAnnouncement(gps.error ?? gpsGuidance.message);
      return;
    }

    if (remainingM !== null && remainingM !== undefined) {
      const previousRemainingM = currentPromptState.previousRemainingM;
      if (previousRemainingM === undefined) {
        updatePromptState(currentPromptState.keys, remainingM);
        return;
      }

      const crossedThresholds = GPS_APPROACH_ANNOUNCEMENT_THRESHOLDS_M.filter(
        (value) =>
          previousRemainingM > value + GPS_APPROACH_ANNOUNCEMENT_LEAD_M &&
          remainingM <= value + GPS_APPROACH_ANNOUNCEMENT_LEAD_M &&
          !currentPromptState.keys.includes(`approach_${value}`)
      );
      const threshold = crossedThresholds.length > 0 ? Math.max(...crossedThresholds) : undefined;
      updatePromptState(currentPromptState.keys, remainingM);

      if (threshold !== undefined) {
        markPrompt(`approach_${threshold}`, remainingM);
        const expectedStepIndex = controller.stepIndex;
        repeatAnnouncementWhenIdle(
          approachAnnouncement(threshold, controller.instructions[controller.stepIndex + 1]),
          () => stepIndexRef.current === expectedStepIndex && gpsGuidance.matchStepIndex === expectedStepIndex
        );
      }
    }
  }, [
    controller.isGpsGuided,
    controller.instructions,
    controller.stepIndex,
    gps.error,
    gpsGuidance.match?.remainingInstructionM,
    gpsGuidance.matchStepIndex,
    gpsGuidance.message,
    gpsGuidance.offRoute,
    hasCurrentGpsMatch,
    helperMode,
  ]);

  useEffect(() => {
    if (
      helperMode ||
      !controller.isGpsGuided ||
      !hasCurrentGpsMatch ||
      gpsGuidance.offRoute ||
      movementHeading === null ||
      gpsGuidance.routeHeading === null
    ) {
      return;
    }

    const now = Date.now();
    const progressM = gpsGuidance.match?.progressM;
    let isMoving = typeof gps.currentLocation?.speed === 'number' && gps.currentLocation.speed >= MOVING_SPEED_THRESHOLD_MPS;

    if (!isMoving && typeof progressM === 'number') {
      const previous = progressSampleRef.current;
      if (!previous || now - previous.sampledAt > MOVING_PROGRESS_SAMPLE_MS) {
        progressSampleRef.current = { progressM, sampledAt: now, isMoving: false };
      } else {
        const movedM = Math.abs(progressM - previous.progressM);
        isMoving = movedM >= MOVING_PROGRESS_THRESHOLD_M;
        progressSampleRef.current = { progressM, sampledAt: previous.sampledAt, isMoving };
      }
    }

    if (!isMoving) {
      return;
    }

    const headingDiff = headingDifferenceDegrees(movementHeading, gpsGuidance.routeHeading);
    if (headingDiff <= HEADING_SAFE_ANGLE_DEG) {
      return;
    }

    if (now - lastHeadingWarningHapticAtRef.current >= HEADING_WARNING_HAPTIC_INTERVAL_MS) {
      lastHeadingWarningHapticAtRef.current = now;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    if (now - lastHeadingWarningAtRef.current < HEADING_WARNING_COOLDOWN_MS) {
      return;
    }

    lastHeadingWarningAtRef.current = now;
    const expectedStepIndex = controller.stepIndex;
    void Speech.isSpeakingAsync().then((isSpeaking) => {
      if (isSpeaking || stepIndexRef.current !== expectedStepIndex || gpsGuidance.matchStepIndex !== expectedStepIndex) {
        return;
      }
      repeatAnnouncement(WRONG_HEADING_ANNOUNCEMENT);
    });
  }, [
    controller.isGpsGuided,
    controller.stepIndex,
    gps.currentLocation?.speed,
    gpsGuidance.match?.progressM,
    gpsGuidance.matchStepIndex,
    gpsGuidance.offRoute,
    gpsGuidance.routeHeading,
    hasCurrentGpsMatch,
    helperMode,
    movementHeading,
  ]);

  useAnnouncement(
    controller.presentation?.tts ?? '',
    Boolean(controller.presentation && !helperMode && !suppressReturnedStepAnnouncement)
  );
  useEffect(() => {
    if (!helperMode) {
      return;
    }

    repeatAnnouncement(HELPER_MODE_ANNOUNCEMENT);
    const interval = setInterval(() => {
      repeatAnnouncement(HELPER_MODE_ANNOUNCEMENT);
    }, HELPER_MODE_ANNOUNCEMENT_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [helperMode]);

  const exitHelperMode = () => {
    setSuppressReturnedStepAnnouncement(true);
    setHelperMode(false);
    setMapFullscreen(false);
    repeatAnnouncement(HELPER_MODE_EXIT_ANNOUNCEMENT);
  };

  const cancelGuidance = () => {
    skipMissingRouteRedirectRef.current = true;
    if (!debugRoute) {
      clearRoute();
    }
    router.replace('/');
  };

  const enterHelperMode = () => {
    if (!canUseHelperMode) {
      repeatAnnouncement(HELPER_MODE_UNAVAILABLE_ANNOUNCEMENT);
      return;
    }
    setSuppressReturnedStepAnnouncement(false);
    setShowRequestPanel(false);
    setHelperMode(true);
  };

  const handleRequestPanelTap = (count: number) => {
    if (count === 2) {
      cancelGuidance();
      return;
    }
    if (count === 3) {
      enterHelperMode();
      return;
    }
    if (count === 4) {
      setShowRequestPanel(false);
    }
  };
  const { registerTap: registerRequestPanelTap } = useTapSequence(handleRequestPanelTap);

  const handleTap = (count: number) => {
    if (helperMode && count === 3) {
      exitHelperMode();
      return;
    }
    if (controller.isArrived && count === 2) {
      cancelGuidance();
      return;
    }
    if (controller.isArrived && count === 3) {
      skipMissingRouteRedirectRef.current = true;
      if (!debugRoute) {
        clearRoute();
      }
      router.replace('/');
      return;
    }
    if (controller.requiresConfirmation && count === 4) {
      controller.advance();
      return;
    }
    if (count === 2) {
      repeatAnnouncement(controller.presentation?.tts ?? '');
      return;
    }
    if (count === 3) {
      setShowRequestPanel(true);
      repeatAnnouncement(REQUEST_PANEL_ANNOUNCEMENT);
    }
  };
  const { registerTap, cancelPendingSequence } = useTapSequence(handleTap);

  if (!route || !controller.activeInstruction || !controller.presentation) {
    return null;
  }

  const fallbackLocation = { latitude: route.summary.start.lat, longitude: route.summary.start.lon };
  const currentLocation = gps.currentLocation ?? fallbackLocation;
  const currentHeading = movementHeading;
  const routeHeading = hasCurrentGpsMatch ? gpsGuidance.routeHeading : null;
  const gpsMessage = gps.error ?? gpsGuidance.message;

  return (
    <ScreenFrame phase={controller.presentation.phase} accent={controller.presentation.accent} onPress={registerTap}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressValue, { width: controller.progress }]} />
      </View>
      {debugRoute && (
        <View style={styles.debugPanel}>
          <Text style={styles.debugLabel}>DEBUG {controller.stepIndex + 1}/{controller.instructions.length}</Text>
          <Pressable
            style={styles.debugButton}
            onPress={(event) => {
              event.stopPropagation();
              controller.previous();
            }}>
            <Text style={styles.debugButtonText}>이전</Text>
          </Pressable>
          <Pressable
            style={styles.debugButton}
            onPress={(event) => {
              event.stopPropagation();
              controller.advance();
            }}>
            <Text style={styles.debugButtonText}>다음</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.body}>
        <GuidanceVisual
          state={controller.presentation}
          helperMode={helperMode}
          currentLocation={currentLocation}
          currentHeading={currentHeading}
          cameraHeading={routeHeading}
          navigationMessage={gpsMessage}
          route={route}
          instruction={controller.activeInstruction}
          instructions={controller.instructions}
          stepIndex={controller.stepIndex}
          onMapTripleTap={() => {
            cancelPendingSequence();
            handleTap(3);
          }}
          onOpenFullscreen={() => setMapFullscreen(true)}
        />
        <View style={styles.titleBlock}>
          <Pill>{controller.presentation.chip}</Pill>
          <Text style={styles.title}>{controller.presentation.title}</Text>
        </View>
        <View style={styles.ttsCard}>
          <Text style={styles.ttsHeading}>현재 음성 안내</Text>
          <Text style={styles.ttsText}>{controller.presentation.tts}</Text>
          {controller.isGpsGuided && <Text style={styles.gpsMessage}>{gpsMessage}</Text>}
        </View>
      </View>
      <View style={styles.actions}>
        {controller.isArrived ? (
          <>
            <ActionLine count={2} label="새 목적지 입력" />
            <ActionLine count={3} label="이음앱을 시작합니다" />
          </>
        ) : controller.requiresConfirmation ? (
          <>
            <ActionLine count={2} label="현재 안내 다시 듣기" />
            <ActionLine count={3} label="음성 명령 / 주변 도움 모드" />
            <ActionLine count={4} label="이동 완료 확인 / 다음 안내" />
          </>
        ) : (
          <>
            <ActionLine count={2} label="현재 안내 다시 듣기" />
            <ActionLine count={3} label="음성 명령 / 주변 도움 모드" />
            <Text style={styles.hint}>실외 구간은 현재 위치에 맞춰 자동으로 다음 안내로 넘어갑니다.</Text>
          </>
        )}
      </View>

      <Modal transparent visible={showRequestPanel} animationType="slide" onRequestClose={() => setShowRequestPanel(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={registerRequestPanelTap} />
          <View style={styles.requestCard}>
            <Pressable onPress={registerRequestPanelTap}>
              <Text style={styles.requestHeading}>경로 안내 옵션</Text>
              <Text style={styles.requestDescription}>
                경로 안내 취소를 원하시면 두 번, 주변 도움 모드가 필요하면 세 번 터치해주세요. 다시 돌아가려면 네 번 터치해주세요.
              </Text>
              <View style={styles.commandGrid}>
                <View style={styles.command}>
                  <Text style={styles.commandText}>두 번 터치 · 경로 안내 취소</Text>
                </View>
                <View style={[styles.command, !canUseHelperMode && styles.commandDisabled]}>
                  <Text style={[styles.commandText, !canUseHelperMode && styles.commandTextDisabled]}>
                    세 번 터치 · 주변 도움 모드{canUseHelperMode ? '' : ' 비활성화'}
                  </Text>
                </View>
                <View style={styles.returnCommand}>
                  <Text style={styles.returnCommandText}>네 번 터치 · 안내 화면으로 돌아가기</Text>
                </View>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={mapFullscreen && helperMode} animationType="fade" onRequestClose={() => setMapFullscreen(false)}>
        <SafeAreaView style={styles.fullscreen}>
          <MapVisual
            title="주변 도움 지도"
            fullscreen
            helperMode
            currentLocation={currentLocation}
            currentHeading={currentHeading}
            cameraHeading={null}
            followUser={false}
            navigationMessage={gpsMessage}
            route={route}
            onTripleTap={() => {
              exitHelperMode();
            }}
            onCloseFullscreen={() => setMapFullscreen(false)}
          />
        </SafeAreaView>
      </Modal>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  progressTrack: { height: 5, backgroundColor: '#273141', borderRadius: 10, marginTop: 10, overflow: 'hidden' },
  progressValue: { height: 6, backgroundColor: '#EEF2F7', borderRadius: 10 },
  debugPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#564627',
    marginTop: 9,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  debugLabel: { color: IeumColors.amber, fontWeight: '700', fontSize: 11, flex: 1 },
  debugButton: { borderRadius: 9, backgroundColor: '#302818', paddingHorizontal: 12, paddingVertical: 5 },
  debugButtonText: { color: IeumColors.amber, fontWeight: '700', fontSize: 11 },
  body: { flex: 1, justifyContent: 'center' },
  titleBlock: { alignItems: 'center', marginTop: 12 },
  title: { marginTop: 8, color: IeumColors.text, fontSize: 25, fontWeight: '800', textAlign: 'center' },
  ttsCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: IeumColors.border,
    backgroundColor: IeumColors.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  ttsHeading: { color: '#E1E5EB', fontWeight: '700', fontSize: 12 },
  ttsText: { color: '#B7C0CE', fontSize: 12, lineHeight: 18, marginTop: 6 },
  actions: { gap: 6, paddingBottom: 4 },
  hint: { color: IeumColors.textMuted, textAlign: 'center', fontSize: 10, marginTop: 4 },
  gpsMessage: { color: IeumColors.cyan, fontSize: 11, lineHeight: 16, marginTop: 8 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3, 7, 13, 0.68)' },
  requestCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#205162',
    backgroundColor: '#10313E',
    padding: 16,
    paddingBottom: 24,
  },
  requestHeading: { color: '#ADF0F5', fontWeight: '700', fontSize: 13 },
  requestDescription: { color: '#C8D3DF', fontSize: 12, lineHeight: 18, marginTop: 8 },
  commandGrid: { gap: 8, marginTop: 12 },
  command: { borderRadius: 13, backgroundColor: '#203F4B', padding: 12 },
  commandDisabled: { backgroundColor: '#182532', borderWidth: 1, borderColor: '#243244' },
  commandText: { color: '#D3DCE5', fontSize: 12, fontWeight: '600' },
  commandTextDisabled: { color: '#6C7888' },
  returnCommand: { borderRadius: 13, borderWidth: 1, borderColor: '#315064', padding: 12 },
  returnCommandText: { color: '#AFC0CF', fontSize: 12, fontWeight: '600' },
  fullscreen: { flex: 1, backgroundColor: IeumColors.cardStrong },
});
