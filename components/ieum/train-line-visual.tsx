import { StyleSheet, Text, View } from 'react-native';

import { IeumColors } from '@/constants/theme';
import { RouteInstruction } from '@/services/route-api';

export function TrainLineVisual({ instruction }: { instruction?: RouteInstruction }) {
  const from = instruction?.from_station ?? '출발역';
  const to = instruction?.to_station ?? '도착역';
  const lineName = instruction?.line_code
    ? instruction.line_code.endsWith('선')
      ? instruction.line_code
      : `${instruction.line_code}호선`
    : '지하철';

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>{lineName} 탑승</Text>
      <View style={styles.track}>
        <View style={styles.trackBackground} />
        <View style={styles.trackProgress} />
        {[from, to].map((stop, index) => (
          <View key={`${stop}-${index}`} style={styles.stop}>
            <View style={[styles.dot, index === 1 && styles.destinationDot]} />
            <Text style={[styles.stopName, index === 1 && styles.destinationName]}>{stop}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.instructionText}>{instruction?.text ?? '열차 이동 안내를 확인합니다.'}</Text>
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
    right: 16,
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
  instructionText: { color: '#C7D0DE', fontSize: 12, lineHeight: 18, marginTop: 13 },
});
