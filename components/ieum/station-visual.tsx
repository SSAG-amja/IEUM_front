import { StyleSheet, Text, View } from 'react-native';

import { Pill } from '@/components/ieum/ieum-ui';
import { IeumColors } from '@/constants/theme';
import { RouteInstruction } from '@/services/route-api';

const STATION_INSTRUCTION_TYPES = new Set(['subway_entry', 'subway_internal', 'transfer', 'subway_exit', 'station_passage']);

function actionLabel(instruction?: RouteInstruction) {
  const text = `${instruction?.type ?? ''} ${instruction?.text ?? ''}`.toLowerCase();
  if (text.includes('출구') || text.includes('입구') || text.includes('나가')) {
    return '출입구 이동';
  }
  if (text.includes('엘리베이터') || text.includes('계단') || text.includes('에스컬레이터') || text.includes('층') || text.includes('지하')) {
    return '층 이동';
  }
  if (text.includes('개찰구') || text.includes('게이트') || text.includes('교통카드') || text.includes('태그')) {
    return '개찰구 통과';
  }
  if (text.includes('승강장') || text.includes('플랫폼') || text.includes('타는 곳')) {
    return '승강장 이동';
  }
  if (text.includes('환승') || text.includes('갈아타') || instruction?.type === 'transfer') {
    return '환승 이동';
  }
  return '역 내부 이동';
}

function stationSegment(instructions: RouteInstruction[], stepIndex: number) {
  let start = stepIndex;
  let end = stepIndex;

  while (start > 0 && STATION_INSTRUCTION_TYPES.has(instructions[start - 1]?.type)) {
    start -= 1;
  }
  while (end < instructions.length - 1 && STATION_INSTRUCTION_TYPES.has(instructions[end + 1]?.type)) {
    end += 1;
  }

  return {
    currentLocalIndex: stepIndex - start,
    steps: instructions.slice(start, end + 1).map((item, index) => ({
      label: actionLabel(item),
      number: index + 1,
    })),
  };
}

function visibleSegmentSteps<T>(steps: T[], currentIndex: number) {
  const start = Math.floor(currentIndex / 4) * 4;
  return steps.slice(start, start + 4);
}

export function StationVisual({
  helperMode,
  instructions,
  stepIndex,
}: {
  helperMode: boolean;
  instructions: RouteInstruction[];
  stepIndex: number;
}) {
  const instruction = instructions[stepIndex];
  const stationName = instruction?.station_name
    ? instruction.station_name.endsWith('역')
      ? instruction.station_name
      : `${instruction.station_name}역`
    : '역사';
  const segment = stationSegment(instructions, stepIndex);
  const visibleSteps = visibleSegmentSteps(segment.steps, segment.currentLocalIndex);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.heading}>{stationName} 안내</Text>
        <Pill>{helperMode ? '주변 도움 모드' : '단계형 안내'}</Pill>
      </View>
      <View style={styles.stepList}>
        {visibleSteps.map((step) => (
          <View
            key={`${step.number}-${step.label}`}
            style={[styles.stepItem, step.number === segment.currentLocalIndex + 1 && styles.currentStepItem]}>
            <Text
              style={[styles.stepText, step.number === segment.currentLocalIndex + 1 && styles.currentStepText]}>
              {step.number}. {step.label}
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
  stepList: { gap: 7 },
  stepItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#293446',
    backgroundColor: '#151F2E',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  currentStepItem: {
    borderColor: '#C994F1',
    backgroundColor: '#C994F1',
  },
  stepText: { color: '#BFC8D6', fontSize: 13, fontWeight: '800' },
  currentStepText: { color: '#141C2A' },
});
