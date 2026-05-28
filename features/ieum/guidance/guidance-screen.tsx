import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
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
import { useRouteSession } from '@/features/ieum/session/route-session-provider';
import { ScreenFrame } from '@/features/ieum/shared/screen-frame';
import { repeatAnnouncement, useAnnouncement } from '@/features/ieum/shared/use-announcement';
import { useTapSequence } from '@/hooks/use-tap-sequence';

const COMMANDS = ['현재 안내', '주변 도움 모드', '엘리베이터', '화장실'] as const;
const DESTINATION_ROUTE = '/destination' as Href;
const HELPER_MODE_ANNOUNCEMENT_INTERVAL_MS = 20000;
const GPS_APPROACH_ANNOUNCEMENT_M = 30;
const HELPER_MODE_ANNOUNCEMENT =
  '주변 도움 모드입니다. 지도를 직접 확인할 수 있습니다. 화면을 세 번 터치하면 자동 안내로 돌아갑니다.';
const HELPER_MODE_EXIT_ANNOUNCEMENT = '주변 도움 모드가 비활성화되었습니다. 자동 안내로 돌아갑니다.';

export function GuidanceScreen() {
  const router = useRouter();
  const { debug } = useLocalSearchParams<{ debug?: string | string[] }>();
  const debugRoute = useMemo(() => getDebugRoute(debug), [debug]);
  const { route: sessionRoute, clearRoute } = useRouteSession();
  const route = debugRoute ?? sessionRoute;
  const controller = useGuidanceController(route);
  const gps = useCurrentLocation(Boolean(route));
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
  const lastGpsPromptRef = useRef<{ stepIndex: number; kind: string } | null>(null);

  useEffect(() => {
    if (!route) {
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
    lastGpsPromptRef.current = null;
  }, [controller.stepIndex]);

  useEffect(() => {
    if (helperMode || !controller.isGpsGuided) {
      return;
    }

    const remainingM = gpsGuidance.match?.remainingInstructionM;
    const previous = lastGpsPromptRef.current;
    if (gpsGuidance.offRoute && previous?.kind !== 'off_route') {
      lastGpsPromptRef.current = { stepIndex: controller.stepIndex, kind: 'off_route' };
      repeatAnnouncement(gps.error ?? gpsGuidance.message);
      return;
    }

    if (
      remainingM !== null &&
      remainingM !== undefined &&
      remainingM <= GPS_APPROACH_ANNOUNCEMENT_M &&
      remainingM > 14 &&
      previous?.kind !== 'approach'
    ) {
      lastGpsPromptRef.current = { stepIndex: controller.stepIndex, kind: 'approach' };
      repeatAnnouncement(gpsGuidance.message);
    }
  }, [
    controller.isGpsGuided,
    controller.stepIndex,
    gps.error,
    gpsGuidance.match?.remainingInstructionM,
    gpsGuidance.message,
    gpsGuidance.offRoute,
    helperMode,
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

  const handleTap = (count: number) => {
    if (helperMode && count === 3) {
      exitHelperMode();
      return;
    }
    if (controller.isArrived && count === 2) {
      if (!debugRoute) {
        clearRoute();
      }
      router.replace(DESTINATION_ROUTE);
      return;
    }
    if (controller.isArrived && count === 3) {
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
    if (count === 3 && controller.isGpsGuided) {
      setShowRequestPanel(true);
    }
  };
  const { registerTap, cancelPendingSequence } = useTapSequence(handleTap);

  if (!route || !controller.activeInstruction || !controller.presentation) {
    return null;
  }

  const fallbackLocation = { latitude: route.summary.start.lat, longitude: route.summary.start.lon };
  const currentLocation = gps.currentLocation ?? fallbackLocation;
  const gpsMessage = gps.error ?? gpsGuidance.message;
  const rightAction = controller.isGpsGuided ? (
    <View style={[styles.gpsStatus, gpsGuidance.offRoute && styles.gpsStatusWarning]}>
      <Text style={styles.gpsStatusText}>{gps.isTracking ? 'GPS 추적' : 'GPS 확인'}</Text>
    </View>
  ) : undefined;

  return (
    <ScreenFrame phase={controller.presentation.phase} accent={controller.presentation.accent} onPress={registerTap} rightAction={rightAction}>
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
          currentHeading={gps.currentLocation?.heading}
          navigationMessage={gpsMessage}
          route={route}
          instruction={controller.activeInstruction}
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
            <ActionLine count={3} label="안내 종료" />
          </>
        ) : controller.requiresConfirmation ? (
          <>
            <ActionLine count={2} label="현재 안내 다시 듣기" />
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
          <Pressable style={styles.modalBackdrop} onPress={() => setShowRequestPanel(false)} />
          <View style={styles.requestCard}>
            <Text style={styles.requestHeading}>다른 선택 / 요청</Text>
            <View style={styles.commandGrid}>
              {COMMANDS.map((command) => (
                <Pressable
                  key={command}
                  style={styles.command}
                  onPress={() => {
                    if (command === '주변 도움 모드') {
                      setSuppressReturnedStepAnnouncement(false);
                      setHelperMode(true);
                      setShowRequestPanel(false);
                    }
                  }}>
                  <Text style={styles.commandText}>{command}</Text>
                </Pressable>
              ))}
            </View>
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
            currentHeading={gps.currentLocation?.heading}
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
  gpsStatus: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#276C86',
    backgroundColor: '#153743',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  gpsStatusWarning: {
    borderColor: '#995D19',
    backgroundColor: '#35230E',
  },
  gpsStatusText: { color: IeumColors.cyan, fontSize: 11, fontWeight: '800' },
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
  commandGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  command: { width: '48%', borderRadius: 13, backgroundColor: '#203F4B', padding: 12 },
  commandText: { color: '#D3DCE5', fontSize: 12, fontWeight: '600' },
  fullscreen: { flex: 1, backgroundColor: IeumColors.cardStrong },
});
