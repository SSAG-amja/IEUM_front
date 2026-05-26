import { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Pill } from '@/components/ieum/ieum-ui';
import { IeumColors } from '@/constants/theme';

export type MapPosition = { x: number; y: number };

type RoutePoint = { x: number; y: number };

const OVERVIEW_ROUTE_POINTS: RoutePoint[] = [
  { x: 0.13, y: 0.78 },
  { x: 0.26, y: 0.78 },
  { x: 0.32, y: 0.61 },
  { x: 0.32, y: 0.43 },
  { x: 0.51, y: 0.43 },
  { x: 0.57, y: 0.28 },
  { x: 0.57, y: 0.12 },
  { x: 0.81, y: 0.12 },
];
const OVERVIEW_CURRENT_POINT_INDEX = 2;
const DETAIL_ROUTE_POINTS: RoutePoint[] = [
  { x: 0.16, y: 0.74 },
  { x: 0.34, y: 0.74 },
  { x: 0.42, y: 0.47 },
  { x: 0.42, y: 0.22 },
  { x: 0.78, y: 0.22 },
];
const CANDIDATE_MAP_PREVIEWS = [
  {
    points: [
      { x: 0.16, y: 0.76 },
      { x: 0.31, y: 0.76 },
      { x: 0.39, y: 0.49 },
      { x: 0.39, y: 0.2 },
      { x: 0.77, y: 0.2 },
    ],
    destination: '2호선',
    summary: '4분 · 270m',
  },
  {
    points: [
      { x: 0.17, y: 0.74 },
      { x: 0.31, y: 0.58 },
      { x: 0.54, y: 0.58 },
      { x: 0.6, y: 0.32 },
      { x: 0.8, y: 0.32 },
    ],
    destination: '신분당선',
    summary: '6분 · 390m',
  },
  {
    points: [
      { x: 0.16, y: 0.7 },
      { x: 0.37, y: 0.7 },
      { x: 0.46, y: 0.46 },
      { x: 0.7, y: 0.46 },
      { x: 0.78, y: 0.17 },
    ],
    destination: '10번 출구',
    summary: '5분 · 320m',
  },
] as const;

type MapVisualProps = {
  title?: string;
  candidatePreviewIndex?: number;
  helperMode: boolean;
  fullscreen?: boolean;
  pan: MapPosition;
  zoom: number;
  onPan: (dx: number, dy: number) => void;
  onPinch: (scaleChange: number) => void;
  onTripleTap?: () => void;
  onOpenFullscreen?: () => void;
  onCloseFullscreen?: () => void;
};

export function MapVisual({
  title,
  candidatePreviewIndex,
  helperMode,
  fullscreen = false,
  pan,
  zoom,
  onPan,
  onPinch,
  onTripleTap,
  onOpenFullscreen,
  onCloseFullscreen,
}: MapVisualProps) {
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const panGesture = Gesture.Pan()
    .enabled(helperMode)
    .maxPointers(1)
    .runOnJS(true)
    .onChange((event) => onPan(event.changeX, event.changeY));
  const pinchGesture = Gesture.Pinch()
    .enabled(helperMode)
    .runOnJS(true)
    .onChange((event) => onPinch(event.scaleChange));
  const tripleTapGesture = Gesture.Tap()
    .enabled(helperMode)
    .numberOfTaps(3)
    .runOnJS(true)
    .onEnd((_event, success) => {
      if (success) {
        onTripleTap?.();
      }
    });
  const mapGesture = Gesture.Simultaneous(panGesture, pinchGesture, tripleTapGesture);
  const candidatePreview =
    candidatePreviewIndex === undefined ? undefined : CANDIDATE_MAP_PREVIEWS[candidatePreviewIndex];
  const routeDefinition = fullscreen
    ? OVERVIEW_ROUTE_POINTS
    : candidatePreview?.points ?? DETAIL_ROUTE_POINTS;
  const currentPointIndex = fullscreen ? OVERVIEW_CURRENT_POINT_INDEX : 0;
  const routeTop = fullscreen ? 60 : 35;
  const routeBottom = fullscreen ? 64 : 43;
  const routeHeight = Math.max(mapSize.height - routeTop - routeBottom, 1);
  const points = routeDefinition.map((point) => ({
    x: point.x * mapSize.width,
    y: routeTop + point.y * routeHeight,
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setMapSize((previous) =>
      previous.width === width && previous.height === height ? previous : { width, height }
    );
  };

  return (
    <View style={[styles.visualCard, fullscreen && styles.fullscreenCard]}>
      <View style={styles.header}>
        <Text style={styles.heading}>🗺️  {title ?? '지도'}</Text>
        <View style={styles.headerActions}>
          <Pill emphasis={helperMode}>{helperMode ? '주변 도움 모드' : '자동 추적 지도'}</Pill>
          {helperMode && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={fullscreen ? '지도 전체화면 나가기' : '지도 전체화면 보기'}
              style={styles.fullscreenButton}
              onPress={(event) => {
                event.stopPropagation();
                if (fullscreen) {
                  onCloseFullscreen?.();
                } else {
                  onOpenFullscreen?.();
                }
              }}>
              <Text style={styles.fullscreenText}>{fullscreen ? '축소' : '전체'}</Text>
            </Pressable>
          )}
        </View>
      </View>
      <GestureDetector gesture={mapGesture}>
        <View style={[styles.map, fullscreen && styles.fullscreenMap]} onLayout={handleLayout}>
          <View style={styles.mapTopRow}>
            <Text style={styles.mapCaption}>
              {fullscreen ? '전체 경로' : candidatePreview ? '후보 경로' : '현재 구간'}
            </Text>
            <Text style={styles.eta}>
              {fullscreen ? '4분 · 270m' : candidatePreview?.summary ?? '다음 회전 35m'}
            </Text>
          </View>
          <View
            style={[
              styles.routeLayer,
              { transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale: zoom }] },
            ]}>
            {points.slice(0, -1).map((point, segmentIndex) => (
              <RouteSegment
                key={`route-${segmentIndex}`}
                from={point}
                to={points[segmentIndex + 1]}
                completed={fullscreen && segmentIndex < currentPointIndex}
              />
            ))}
            {points.length > 0 && (
              <>
                {fullscreen && (
                  <>
                    <MapMarker point={points[0]} type="start" label="출발" />
                    <MapMarker point={points[points.length - 1]} type="destination" label="시청역 2번 출구" />
                  </>
                )}
                {candidatePreview && (
                  <MapMarker
                    point={points[points.length - 1]}
                    type="destination"
                    label={candidatePreview.destination}
                  />
                )}
                <CurrentLocation point={points[currentPointIndex]} />
                <View
                  style={[
                    styles.turnCard,
                    {
                      left: points[currentPointIndex].x + 16,
                      top: points[currentPointIndex].y - (fullscreen ? 40 : 31),
                    },
                  ]}>
                  <Text style={styles.turnText}>
                    {fullscreen ? '↱  35m 뒤 우회전' : candidatePreview ? '출발 위치' : '현재 위치'}
                  </Text>
                </View>
              </>
            )}
          </View>
          <View style={[styles.message, helperMode ? styles.helperMessage : styles.trackingMessage]}>
            <Text style={helperMode ? styles.helperText : styles.trackingText}>
              {helperMode
                ? '드래그 이동 · 핀치 확대 · 3번 터치로 자동 안내 복귀'
                : '현재 위치 중심으로 자동 추적 중'}
            </Text>
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}

function RouteSegment({
  from,
  to,
  completed,
}: {
  from: RoutePoint;
  to: RoutePoint;
  completed: boolean;
}) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const angle = `${Math.atan2(to.y - from.y, to.x - from.x)}rad`;
  const position = {
    left: (from.x + to.x) / 2 - length / 2,
    top: (from.y + to.y) / 2 - 5,
    width: length,
    transform: [{ rotate: angle }],
  };

  return (
    <>
      <View style={[styles.routeBorder, position]} />
      <View style={[styles.routeLine, completed && styles.completedRoute, position]} />
    </>
  );
}

function MapMarker({
  point,
  type,
  label,
}: {
  point: RoutePoint;
  type: 'start' | 'destination';
  label: string;
}) {
  return (
    <>
      <View
        style={[
          styles.marker,
          type === 'destination' ? styles.destinationMarker : styles.startMarker,
          { left: point.x - 9, top: point.y - 9 },
        ]}>
        <View style={type === 'destination' ? styles.destinationCenter : styles.startCenter} />
      </View>
      <Text
        style={[
          styles.markerLabel,
          type === 'destination' ? styles.destinationLabel : styles.startLabel,
          { left: point.x - (type === 'destination' ? 33 : 19), top: point.y + 14 },
        ]}>
        {label}
      </Text>
    </>
  );
}

function CurrentLocation({ point }: { point: RoutePoint }) {
  return (
    <View style={[styles.currentHalo, { left: point.x - 20, top: point.y - 20 }]}>
      <View style={styles.currentPosition}>
        <View style={styles.currentDirection} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  visualCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#283344',
    borderRadius: 20,
    padding: 10,
    backgroundColor: IeumColors.cardStrong,
  },
  fullscreenCard: {
    flex: 1,
    marginTop: 0,
    borderRadius: 0,
    borderWidth: 0,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  heading: { color: '#E2E6ED', fontSize: 14, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  fullscreenButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#405064',
    backgroundColor: '#253349',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fullscreenText: { color: '#DDE3EC', fontSize: 11, fontWeight: '700' },
  map: {
    height: 156,
    borderWidth: 1,
    borderColor: '#273447',
    borderRadius: 15,
    backgroundColor: '#111C2D',
    overflow: 'hidden',
  },
  fullscreenMap: { flex: 1, height: undefined },
  mapTopRow: {
    position: 'absolute',
    top: 9,
    left: 9,
    right: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapCaption: {
    color: '#95A2B5',
    backgroundColor: '#1D2B3F',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 10,
    fontWeight: '700',
  },
  eta: {
    color: '#DFE8F2',
    backgroundColor: '#1A293E',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 9,
    fontSize: 10,
    fontWeight: '700',
  },
  routeLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  routeBorder: {
    position: 'absolute',
    height: 10,
    borderRadius: 7,
    backgroundColor: '#08121E',
  },
  routeLine: {
    position: 'absolute',
    height: 6,
    marginTop: 2,
    borderRadius: 7,
    backgroundColor: '#69DDEB',
  },
  completedRoute: { backgroundColor: '#3C8290' },
  marker: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startMarker: { backgroundColor: '#243B51', borderWidth: 2, borderColor: '#7A97AC' },
  startCenter: { width: 6, height: 6, borderRadius: 4, backgroundColor: '#D7E1EB' },
  destinationMarker: { backgroundColor: IeumColors.mint, borderWidth: 2, borderColor: '#E9FFF1' },
  destinationCenter: { width: 6, height: 6, borderRadius: 4, backgroundColor: '#153B2B' },
  markerLabel: {
    position: 'absolute',
    fontSize: 9,
    fontWeight: '700',
    borderRadius: 9,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  startLabel: { color: '#B5C5D5', backgroundColor: '#182739' },
  destinationLabel: { color: '#A9F1C4', backgroundColor: '#173329' },
  currentHalo: {
    position: 'absolute',
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(105, 221, 235, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentPosition: {
    height: 22,
    width: 22,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: IeumColors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentDirection: {
    marginTop: -13,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: IeumColors.cyan,
  },
  turnCard: {
    position: 'absolute',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#405064',
    backgroundColor: '#19283C',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  turnText: { color: '#E4EAF1', fontSize: 9, fontWeight: '700' },
  message: {
    position: 'absolute',
    left: 7,
    right: 7,
    bottom: 7,
    borderWidth: 1,
    borderRadius: 13,
    paddingVertical: 7,
    paddingHorizontal: 9,
  },
  trackingMessage: { borderColor: '#235160', backgroundColor: '#153743' },
  helperMessage: { borderColor: '#705826', backgroundColor: '#382F1D' },
  trackingText: { color: '#9FE9F0', fontSize: 11, fontWeight: '600' },
  helperText: { color: IeumColors.amber, fontSize: 11, fontWeight: '600' },
});
