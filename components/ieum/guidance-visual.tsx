import { StyleSheet, Text, View } from 'react-native';

import { MapVisual } from '@/components/ieum/map-visual';
import { StationVisual } from '@/components/ieum/station-visual';
import { TrainLineVisual } from '@/components/ieum/train-line-visual';
import { IeumState } from '@/constants/ieum-prototype';
import { Coordinate, RouteInstruction, RouteResponse } from '@/services/route-api';

type GuidanceVisualProps = {
  state: IeumState;
  helperMode: boolean;
  currentLocation?: Coordinate | null;
  route?: RouteResponse | null;
  instruction?: RouteInstruction;
  onMapTripleTap: () => void;
  onOpenFullscreen: () => void;
};

export function GuidanceVisual({
  state,
  helperMode,
  currentLocation,
  route,
  instruction,
  onMapTripleTap,
  onOpenFullscreen,
}: GuidanceVisualProps) {
  if (state.visual === 'map') {
    return (
      <MapVisual
        title={state.mapTitle}
        helperMode={helperMode}
        currentLocation={currentLocation}
        route={route}
        onTripleTap={onMapTripleTap}
        onOpenFullscreen={onOpenFullscreen}
      />
    );
  }

  if (state.visual === 'station') {
    return <StationVisual helperMode={helperMode} instruction={instruction} />;
  }

  if (state.visual === 'trainLine') {
    return <TrainLineVisual instruction={instruction} />;
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
