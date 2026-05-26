import { StyleSheet, Text, View } from 'react-native';

import { Pill } from '@/components/ieum/ieum-ui';
import { IeumColors } from '@/constants/theme';
import { RouteInstruction } from '@/services/route-api';

export function StationVisual({
  helperMode,
  instruction,
}: {
  helperMode: boolean;
  instruction?: RouteInstruction;
}) {
  const stationName = instruction?.station_name
    ? instruction.station_name.endsWith('역')
      ? instruction.station_name
      : `${instruction.station_name}역`
    : '역사';
  const phase =
    instruction?.type === 'transfer'
      ? '환승 이동'
      : instruction?.type === 'subway_entry'
        ? '역 안으로 진입'
        : instruction?.type === 'subway_exit'
          ? '역 밖으로 이동'
          : instruction?.type === 'station_passage'
            ? '역사 통과 이동'
            : '내부 이동';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.heading}>{stationName} 안내</Text>
        <Pill>{helperMode ? '주변 도움 모드' : '단계형 안내'}</Pill>
      </View>
      <View style={styles.stepRow}>
        <View style={styles.currentNumber}>
          <Text style={styles.currentNumberText}>1</Text>
        </View>
        <Text style={styles.phase}>{phase}</Text>
      </View>
      <View style={styles.instruction}>
        <Text style={styles.instructionText}>{instruction?.text ?? '역사 내부 이동 안내를 확인합니다.'}</Text>
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
    padding: 10,
    backgroundColor: IeumColors.cardStrong,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 7,
  },
  heading: { color: '#E2E6ED', fontSize: 14, fontWeight: '700' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 8 },
  currentNumber: {
    width: 29,
    height: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#C994F1',
  },
  currentNumberText: { color: '#141C2A' },
  phase: { color: '#C994F1', fontSize: 12, fontWeight: '700' },
  instruction: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#293446',
    backgroundColor: '#151F2E',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  instructionText: { color: '#E0E4EA', fontWeight: '700', fontSize: 12, lineHeight: 18 },
});
