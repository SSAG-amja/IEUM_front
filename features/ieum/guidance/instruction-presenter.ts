import { RouteInstruction } from '@/services/route-api';

export type GuidanceVisualType = 'map' | 'station' | 'trainLine';

export type GuidancePresentation = {
  phase: string;
  title: string;
  tts: string;
  chip: string;
  accent: string;
  visual: GuidanceVisualType;
  mapTitle?: string;
};

function stationLabel(instruction: RouteInstruction) {
  if (!instruction.station_name) {
    return '역사';
  }
  return instruction.station_name.endsWith('역') ? instruction.station_name : `${instruction.station_name}역`;
}

function lineLabel(instruction: RouteInstruction) {
  if (!instruction.line_code) {
    return '지하철';
  }
  return instruction.line_code.endsWith('선') ? instruction.line_code : `${instruction.line_code}호선`;
}

export function isGpsGuidedInstruction(instruction?: RouteInstruction) {
  return Boolean(
    instruction &&
      ['walk', 'walk_with_braille', 'crosswalk', 'move', 'facility_connector'].includes(instruction.type)
  );
}

export function requiresGuidanceConfirmation(instruction?: RouteInstruction) {
  return Boolean(instruction && instruction.type !== 'destination' && !isGpsGuidedInstruction(instruction));
}

export function presentInstruction(
  instruction: RouteInstruction,
  stepIndex: number,
  stepCount: number,
  previousInstruction?: RouteInstruction
): GuidancePresentation {
  const position = `${stepIndex + 1}/${stepCount}`;
  const station = stationLabel(instruction);
  const line = lineLabel(instruction);
  const gpsResumes =
    isGpsGuidedInstruction(instruction) &&
    (!previousInstruction || ['subway_exit', 'station_passage'].includes(previousInstruction.type));
  const baseTts = gpsResumes
    ? `GPS 안내를 시작합니다. 위치에 따라 다음 안내로 자동 전환합니다. ${instruction.text}`
    : instruction.text;
  const tts = stepIndex === 0 ? `${baseTts} 안내를 다시 들으려면 2번, 도움이 필요하시면 3번 터치해주세요.` : baseTts;
  const common = {
    tts,
    chip: `안내 ${position}`,
    mapTitle: '실제 경로',
  };

  switch (instruction.type) {
    case 'walk':
      return { ...common, phase: `보행 안내 ${position}`, title: '보행로 이동', accent: '#25A368', visual: 'map' };
    case 'walk_with_braille':
      return { ...common, phase: `보행 안내 ${position}`, title: '점자블록 안내', accent: '#25A368', visual: 'map' };
    case 'crosswalk':
      return { ...common, phase: `횡단 안내 ${position}`, title: '횡단보도 이동', accent: '#D78126', visual: 'map' };
    case 'subway_entry':
      return { ...common, phase: `역 진입 ${position}`, title: `${station} 진입`, accent: '#8C49CA', visual: 'station' };
    case 'subway_internal':
      return { ...common, phase: `역 내부 ${position}`, title: `${station} 내부 이동`, accent: '#356CD2', visual: 'station' };
    case 'transfer':
      return { ...common, phase: `환승 ${position}`, title: `${station} 환승`, accent: '#356CD2', visual: 'station' };
    case 'subway_ride':
      return { ...common, phase: `열차 이동 ${position}`, title: `${line} 이용`, accent: '#248BC8', visual: 'trainLine' };
    case 'subway_exit':
      return { ...common, phase: `역 이탈 ${position}`, title: `${station} 밖으로 이동`, accent: '#8C49CA', visual: 'station' };
    case 'station_passage':
      return { ...common, phase: `역사 통과 ${position}`, title: `${station} 통과 이동`, accent: '#8C49CA', visual: 'station' };
    case 'destination':
      return {
        ...common,
        phase: '도착 완료',
        title: '목적지에 도착했습니다',
        chip: '도착',
        accent: '#22A267',
        visual: 'map',
        mapTitle: '도착 위치 확인',
      };
    default:
      return { ...common, phase: `이동 안내 ${position}`, title: '경로 이동', accent: '#25A368', visual: 'map' };
  }
}
