import { StyleSheet, Text, View } from 'react-native';

import { MapPosition, MapVisual } from '@/components/ieum/map-visual';
import { StationVisual } from '@/components/ieum/station-visual';
import { TrainLineVisual } from '@/components/ieum/train-line-visual';
import { IeumState } from '@/constants/ieum-prototype';

type GuidanceVisualProps = {
  state: IeumState;
  candidatePreviewIndex?: number;
  helperMode: boolean;
  mapPan: MapPosition;
  mapZoom: number;
  onPan: (dx: number, dy: number) => void;
  onPinch: (scaleChange: number) => void;
  onMapTripleTap: () => void;
  onOpenFullscreen: () => void;
};

export function GuidanceVisual({
  state,
  candidatePreviewIndex,
  helperMode,
  mapPan,
  mapZoom,
  onPan,
  onPinch,
  onMapTripleTap,
  onOpenFullscreen,
}: GuidanceVisualProps) {
  if (state.visual === 'map') {
    return (
      <MapVisual
        title={state.mapTitle}
        candidatePreviewIndex={candidatePreviewIndex}
        helperMode={helperMode}
        pan={mapPan}
        zoom={mapZoom}
        onPan={onPan}
        onPinch={onPinch}
        onTripleTap={onMapTripleTap}
        onOpenFullscreen={onOpenFullscreen}
      />
    );
  }

  if (state.visual === 'station') {
    return <StationVisual helperMode={helperMode} />;
  }

  if (state.visual === 'trainLine') {
    return <TrainLineVisual />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.circle}>
        <Text style={styles.icon}>{state.icon}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 18 },
  circle: {
    height: 96,
    width: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: '#344052',
    backgroundColor: '#1B2534',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 42 },
});
