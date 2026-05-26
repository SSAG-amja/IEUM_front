import { StyleSheet, Text, View } from 'react-native';

import { Pill } from '@/components/ieum/ieum-ui';
import { IeumColors } from '@/constants/theme';

const STATION_NODES = ['3번 출입구', '엘리베이터', '개찰구', '2호선 승강장'];

export function StationVisual({ helperMode }: { helperMode: boolean }) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.heading}>🚇  역 내부 동선도</Text>
        <Pill>{helperMode ? '주변 도움 모드' : '단계형 안내'}</Pill>
      </View>
      {STATION_NODES.map((node, index) => (
        <View key={node} style={styles.row}>
          <View style={[styles.number, index === 1 && styles.currentNumber]}>
            <Text style={[styles.numberText, index === 1 && styles.currentNumberText]}>{index + 1}</Text>
          </View>
          <View style={styles.node}>
            <Text style={styles.nodeText}>{node}</Text>
          </View>
        </View>
      ))}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 6 },
  number: {
    width: 29,
    height: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#1D2839',
  },
  currentNumber: { backgroundColor: '#C994F1' },
  numberText: { color: '#FFFFFF', fontWeight: '800' },
  currentNumberText: { color: '#141C2A' },
  node: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#293446',
    backgroundColor: '#151F2E',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  nodeText: { color: '#E0E4EA', fontWeight: '700', fontSize: 12 },
});
