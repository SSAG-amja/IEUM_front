import { StyleSheet, Text, View } from 'react-native';

import { IeumColors } from '@/constants/theme';

const STOPS = ['강남', '역삼', '선릉', '교대'];

export function TrainLineVisual() {
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>🚇  열차 진행도</Text>
      <View style={styles.track}>
        <View style={styles.trackBackground} />
        <View style={styles.trackProgress} />
        {STOPS.map((stop, index) => (
          <View key={stop} style={styles.stop}>
            <View style={[styles.dot, index === STOPS.length - 1 && styles.destinationDot]} />
            <Text style={[styles.stopName, index === STOPS.length - 1 && styles.destinationName]}>
              {stop}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#283344',
    borderRadius: 20,
    padding: 12,
    backgroundColor: IeumColors.cardStrong,
  },
  heading: { color: '#E2E6ED', fontSize: 14, fontWeight: '700' },
  track: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 13, marginHorizontal: 8 },
  trackBackground: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 12,
    height: 4,
    borderRadius: 4,
    backgroundColor: '#344052',
  },
  trackProgress: {
    position: 'absolute',
    left: 16,
    right: 56,
    top: 12,
    height: 4,
    borderRadius: 4,
    backgroundColor: IeumColors.cyan,
  },
  stop: { alignItems: 'center', gap: 5 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 4,
    borderColor: IeumColors.surface,
    backgroundColor: IeumColors.cyan,
  },
  destinationDot: { backgroundColor: IeumColors.mint },
  stopName: { fontSize: 10, fontWeight: '700', color: '#9CA7B7' },
  destinationName: { color: '#B8F1CE' },
});
