import { useEffect, useMemo, useRef } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { type Camera, Marker, Polyline } from 'react-native-maps';

import { Pill } from '@/components/ieum/ieum-ui';
import { IeumColors } from '@/constants/theme';
import { useTapSequence } from '@/hooks/use-tap-sequence';
import { Coordinate, RouteFeature, RouteResponse } from '@/services/route-api';

type MapVisualProps = {
  title?: string;
  helperMode: boolean;
  fullscreen?: boolean;
  currentLocation?: Coordinate | null;
  route?: RouteResponse | null;
  onTripleTap?: () => void;
  onOpenFullscreen?: () => void;
  onCloseFullscreen?: () => void;
};

const SEOUL_REGION = {
  latitude: 37.554,
  longitude: 126.99,
  latitudeDelta: 0.16,
  longitudeDelta: 0.16,
};
const MAP_TAP_SEQUENCE_DELAY_MS = 700;
const DOUBLE_TAP_ZOOM_BLOCK_MS = 1000;

function coordinatesOf(feature: RouteFeature) {
  return feature.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude }));
}

function colorFor(feature: RouteFeature) {
  const properties = feature.properties;
  if (properties.edge_type === 'subway_ride') {
    return properties.line_color || '#2563EB';
  }
  if (properties.edge_type === 'crosswalk') {
    return properties.has_audible_signal ? '#F59E0B' : '#E11D48';
  }
  if (properties.has_braille || Number(properties.near_braille_count || 0) > 0) {
    return '#D97706';
  }
  if (properties.edge_type === 'subway_connector' || properties.has_elevator) {
    return '#8B5CF6';
  }
  return '#16A36A';
}

export function MapVisual({
  title,
  helperMode,
  fullscreen = false,
  currentLocation,
  route,
  onTripleTap,
  onOpenFullscreen,
  onCloseFullscreen,
}: MapVisualProps) {
  const mapRef = useRef<MapView>(null);
  const isMapReadyRef = useRef(false);
  const stableCameraRef = useRef<Camera | null>(null);
  const blockDoubleTapZoomUntilRef = useRef(0);
  const { registerTap } = useTapSequence(
    (count) => {
      if (count === 3) {
        onTripleTap?.();
      }
    },
    MAP_TAP_SEQUENCE_DELAY_MS
  );
  const routeCoordinates = useMemo(
    () => route?.geometry.features.flatMap((feature) => coordinatesOf(feature)) ?? [],
    [route]
  );

  useEffect(() => {
    if (routeCoordinates.length > 1) {
      mapRef.current?.fitToCoordinates(routeCoordinates, {
        edgePadding: { top: 60, right: 40, bottom: 60, left: 40 },
        animated: true,
      });
      return;
    }
    if (currentLocation) {
      mapRef.current?.animateToRegion(
        {
          ...currentLocation,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        },
        300
      );
    }
  }, [currentLocation, routeCoordinates]);

  const rememberCurrentCamera = () => {
    const map = mapRef.current;
    if (!isMapReadyRef.current || !map) {
      return;
    }
    void map
      .getCamera()
      .then((camera) => {
        stableCameraRef.current = camera;
      })
      .catch(() => {
        // The native map can be replaced while transitioning to/from fullscreen.
      });
  };

  const handleRegionChangeComplete = () => {
    const map = mapRef.current;
    if (!isMapReadyRef.current || !map) {
      return;
    }
    if (helperMode && Date.now() < blockDoubleTapZoomUntilRef.current && stableCameraRef.current) {
      map.setCamera(stableCameraRef.current);
      return;
    }
    rememberCurrentCamera();
  };

  const handleDoublePress = () => {
    if (!helperMode) {
      return;
    }
    blockDoubleTapZoomUntilRef.current = Date.now() + DOUBLE_TAP_ZOOM_BLOCK_MS;
    if (stableCameraRef.current) {
      mapRef.current?.setCamera(stableCameraRef.current);
    }
    registerTap();
    registerTap();
  };

  const destination = route?.summary.end;

  return (
    <View style={[styles.visualCard, fullscreen && styles.fullscreenCard]}>
      <View style={styles.header}>
        <Text style={styles.heading}>지도  {title ?? '실제 경로'}</Text>
        <View style={styles.headerActions}>
          <Pill emphasis={helperMode}>{helperMode ? '주변 도움 모드' : '경로 지도'}</Pill>
          {helperMode && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={fullscreen ? '지도 전체화면 나가기' : '지도 전체화면 보기'}
              style={styles.fullscreenButton}
              onPress={fullscreen ? onCloseFullscreen : onOpenFullscreen}>
              <Text style={styles.fullscreenText}>{fullscreen ? '축소' : '전체'}</Text>
            </Pressable>
          )}
        </View>
      </View>
      <View style={[styles.mapWrap, fullscreen && styles.fullscreenMap]}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={SEOUL_REGION}
          scrollEnabled={helperMode}
          pitchEnabled={helperMode}
          rotateEnabled={helperMode}
          zoomEnabled={helperMode}
          toolbarEnabled={false}
          onMapReady={() => {
            isMapReadyRef.current = true;
            rememberCurrentCamera();
          }}
          onDoublePress={handleDoublePress}
          onRegionChangeComplete={handleRegionChangeComplete}
          onPress={() => {
            Keyboard.dismiss();
            if (helperMode) {
              registerTap();
            }
          }}>
          {route?.geometry.features.map((feature, index) => (
            <Polyline
              key={`${feature.properties.edge_type ?? 'edge'}-${index}`}
              coordinates={coordinatesOf(feature)}
              strokeColor={colorFor(feature)}
              strokeWidth={feature.properties.edge_type === 'subway_ride' ? 6 : 5}
            />
          ))}
          {currentLocation && <Marker coordinate={currentLocation} title="출발 위치" pinColor="#0EA5E9" />}
          {destination && (
            <Marker
              coordinate={{ latitude: destination.lat, longitude: destination.lon }}
              title={destination.label}
              pinColor="#22A267"
            />
          )}
        </MapView>
        <View pointerEvents="none" style={[styles.message, helperMode ? styles.helperMessage : styles.trackingMessage]}>
          <Text style={helperMode ? styles.helperText : styles.trackingText}>
            {helperMode ? '지도 이동/확대 가능 · 3번 터치로 안내 화면 복귀' : '경로와 입력한 출발 위치를 표시 중'}
          </Text>
        </View>
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
    borderColor: IeumColors.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  fullscreenText: { color: '#DDE3EC', fontSize: 11, fontWeight: '700' },
  mapWrap: {
    height: 198,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#DDE6E8',
  },
  fullscreenMap: { flex: 1, height: undefined },
  map: { flex: 1 },
  message: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  trackingMessage: { backgroundColor: 'rgba(10, 25, 39, 0.78)' },
  helperMessage: { backgroundColor: 'rgba(65, 47, 13, 0.9)' },
  trackingText: { color: '#E2E6ED', fontSize: 11, fontWeight: '600' },
  helperText: { color: IeumColors.amber, fontSize: 11, fontWeight: '600' },
});
