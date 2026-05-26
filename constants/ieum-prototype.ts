export type IeumStateKey =
  | 'APP_LAUNCH'
  | 'WAIT_DESTINATION_INPUT'
  | 'LISTENING_DESTINATION'
  | 'CANDIDATE_CONFIRMATION'
  | 'BUILDING_ROUTE'
  | 'WALK_GUIDANCE'
  | 'ENTERING_STATION'
  | 'STATION_INDOOR_GUIDANCE'
  | 'ON_TRAIN_GUIDANCE'
  | 'ALIGHTING_CONFIRMATION'
  | 'EXITING_STATION'
  | 'ARRIVED';

export type IeumVisual = 'icon' | 'map' | 'station' | 'trainLine';

export type IeumState = {
  key: IeumStateKey;
  phase: string;
  icon: string;
  main: string;
  sub: string;
  tts: string;
  chip: string;
  accent: string;
  visual: IeumVisual;
  mapTitle?: string;
};

export type TouchActions = {
  two: string;
  three: string;
  four: string | null;
};

export const DESTINATION_CANDIDATES = [
  { name: '강남역 2호선', desc: '서울 강남구 강남대로 지하 396', hint: '지하철역 기준 후보' },
  { name: '강남역 신분당선', desc: '신분당선 강남역 지하 연결 구간', hint: '노선 구분 후보' },
  { name: '강남역 10번 출구', desc: '목적지 근처 출구 기준 후보', hint: '출구 기준 후보' },
] as const;

export const COMMANDS = [
  { label: '현재 위치', icon: '📍' },
  { label: '다음 행동', icon: '🧭' },
  { label: '주변 도움 모드', icon: '🧑‍🦯' },
  { label: '엘리베이터', icon: '🛗' },
  { label: '화장실', icon: '🚻' },
  { label: '비상콜폰', icon: '☎️' },
] as const;

export const IEUM_STATES: IeumState[] = [
  {
    key: 'APP_LAUNCH',
    phase: '앱 실행',
    icon: '📱',
    main: '이음 앱을 시작합니다',
    sub: '위치, 마이크, 음성 안내 권한을 확인합니다.',
    tts: '이음 앱을 시작합니다. 안내를 시작하려면 화면을 두 번 터치해주세요.',
    chip: 'Native App',
    accent: '#6B89A4',
    visual: 'icon',
  },
  {
    key: 'WAIT_DESTINATION_INPUT',
    phase: '목적지 입력 대기',
    icon: '🎙️',
    main: '어디로 안내할까요?',
    sub: '도착지를 말하면 안전한 경로를 찾아드립니다.',
    tts: '도착지를 말씀하시고 싶으시면 화면을 두 번 터치 후 말씀해주세요. 도움이 필요하면 세 번 터치해주세요.',
    chip: '음성 입력 대기',
    accent: '#129FC4',
    visual: 'icon',
  },
  {
    key: 'LISTENING_DESTINATION',
    phase: '목적지 듣는 중',
    icon: '〰️',
    main: '말씀해주세요',
    sub: '예: 강남역으로 가고 싶어',
    tts: '목적지를 말씀해주세요. 입력을 마치려면 화면을 두 번, 취소하려면 세 번 터치해주세요.',
    chip: 'STT 녹음 중',
    accent: '#4D69CF',
    visual: 'icon',
  },
  {
    key: 'CANDIDATE_CONFIRMATION',
    phase: '목적지 후보 확인',
    icon: '✓',
    main: '목적지 후보',
    sub: '맞으면 2번, 다음 후보는 3번입니다.',
    tts: '목적지 후보를 찾았습니다. 맞으면 화면을 두 번, 다음 후보를 들으려면 화면을 세 번 터치해주세요.',
    chip: '후보 확인',
    accent: '#17A37A',
    visual: 'map',
    mapTitle: '후보 위치 미리보기',
  },
  {
    key: 'BUILDING_ROUTE',
    phase: '경로 탐색 중',
    icon: '🧭',
    main: '안전 경로를 탐색 중입니다',
    sub: '점자블록, 음향신호기, 엘리베이터 정보를 우선해 계산하고 있습니다.',
    tts: '안전 경로를 탐색 중입니다. 잠시 기다려주세요.',
    chip: '탐색 중',
    accent: '#D78126',
    visual: 'map',
    mapTitle: '전체 경로 요약',
  },
  {
    key: 'WALK_GUIDANCE',
    phase: '도보 안내 중',
    icon: '🚶',
    main: '전방 80m 직진',
    sub: '이후 음향신호기 횡단보도에서 왼쪽으로 이동하세요.',
    tts: '전방 80미터 직진하세요. 다시 들으려면 화면을 두 번, 음성 명령은 세 번 터치해주세요.',
    chip: '점자블록 우선',
    accent: '#25A368',
    visual: 'map',
    mapTitle: '자동 추적 지도',
  },
  {
    key: 'ENTERING_STATION',
    phase: '역 진입 안내',
    icon: '🛗',
    main: '3번 출입구 엘리베이터',
    sub: '전방 30m 후 오른쪽입니다. 역 입구에 도착하면 4번 터치하세요.',
    tts: '전방 30미터 후 오른쪽으로 이동하세요. 엘리베이터가 있는 3번 출입구를 이용합니다. 다시 듣기는 두 번, 시설 문의는 세 번, 역 진입을 완료했다면 네 번 터치해주세요.',
    chip: '역 진입',
    accent: '#8C49CA',
    visual: 'map',
    mapTitle: '엘리베이터 출입구 강조',
  },
  {
    key: 'STATION_INDOOR_GUIDANCE',
    phase: '역 내부 안내',
    icon: '🚇',
    main: '2호선 잠실 방면 승강장',
    sub: '엘리베이터를 이용해 승강장으로 이동하세요.',
    tts: '지하철역 내부에서는 GPS를 사용하지 않습니다. 2호선 잠실 방면 승강장으로 이동합니다. 다시 듣기는 두 번, 시설 문의는 세 번, 승강장 도착 후 네 번 터치해주세요.',
    chip: 'KRIC 동선 기반',
    accent: '#356CD2',
    visual: 'station',
  },
  {
    key: 'ON_TRAIN_GUIDANCE',
    phase: '열차 탑승 중',
    icon: '🚇',
    main: '교대역에서 하차 예정',
    sub: '하차역에 도착하면 4번 터치 후 하차 여부를 다시 확인합니다.',
    tts: '이번 열차는 2호선 잠실 방면입니다. 다음에 내려야 할 역은 교대역입니다. 다시 듣기는 두 번, 음성 명령은 세 번, 교대역에서 내리셨다면 네 번 터치해주세요.',
    chip: 'GPS-free',
    accent: '#248BC8',
    visual: 'trainLine',
  },
  {
    key: 'ALIGHTING_CONFIRMATION',
    phase: '하차 여부 확인',
    icon: '?',
    main: '교대역에서 내리셨나요?',
    sub: '하차했다면 2번, 아직 열차 안이면 3번 터치하세요.',
    tts: '교대역에서 내리셨나요? 내리셨다면 화면을 두 번, 아직 열차 안이라면 화면을 세 번 터치해주세요.',
    chip: '하차 재확인',
    accent: '#DD5B49',
    visual: 'trainLine',
  },
  {
    key: 'EXITING_STATION',
    phase: '역 이탈 안내',
    icon: '🛗',
    main: '지상 이동 후 4번 터치',
    sub: '역 밖으로 나오면 GPS를 다시 연결합니다.',
    tts: '엘리베이터를 이용해 지상으로 이동하세요. 다시 듣기는 두 번, 시설 문의는 세 번, 역 밖으로 나왔다면 네 번 터치해주세요.',
    chip: 'GPS 재연결 대기',
    accent: '#7150CE',
    visual: 'station',
  },
  {
    key: 'ARRIVED',
    phase: '도착 완료',
    icon: '✅',
    main: '목적지에 도착했습니다',
    sub: '다른 목적지로 안내할까요?',
    tts: '목적지에 도착했습니다. 다른 목적지로 안내하려면 화면을 두 번, 안내를 종료하려면 화면을 세 번 터치해주세요.',
    chip: '도착',
    accent: '#22A267',
    visual: 'map',
    mapTitle: '도착 위치 확인',
  },
];

export const TOUCH_ACTIONS: Record<IeumStateKey, TouchActions> = {
  APP_LAUNCH: { two: '안내 시작', three: '도움말 듣기', four: null },
  WAIT_DESTINATION_INPUT: { two: '목적지 말하기', three: '도움말 듣기', four: null },
  LISTENING_DESTINATION: { two: '입력 완료', three: '입력 취소', four: null },
  CANDIDATE_CONFIRMATION: { two: '현재 후보 확정', three: '다음 후보 듣기', four: null },
  BUILDING_ROUTE: { two: '경로 탐색 중', three: '목적지 변경', four: null },
  WALK_GUIDANCE: { two: '다시 듣기 / 내 위치 중심', three: '음성 명령 / 주변 도움 모드', four: null },
  ENTERING_STATION: { two: '다시 듣기 / 내 위치 중심', three: '시설 문의 / 주변 도움 모드', four: '역 진입 완료' },
  STATION_INDOOR_GUIDANCE: { two: '다시 듣기', three: '시설 문의', four: '승강장 도착' },
  ON_TRAIN_GUIDANCE: { two: '다시 듣기', three: '음성 명령', four: '하차했다고 알림' },
  ALIGHTING_CONFIRMATION: { two: '하차 완료', three: '아직 열차 안', four: null },
  EXITING_STATION: { two: '다시 듣기 / 내 위치 중심', three: '시설 문의 / 주변 도움 모드', four: '역 밖 이동 완료' },
  ARRIVED: { two: '새 목적지 입력', three: '안내 종료', four: null },
};

export function getViewState(
  state: IeumState,
  candidateIndex: number,
  originQuery?: string,
  destinationQuery?: string
): IeumState {
  const origin = originQuery?.trim() || '현재 위치';
  const destination = destinationQuery?.trim();
  const candidate = destination
    ? { name: destination, desc: '입력한 목적지', hint: '서버 검색 대상' }
    : DESTINATION_CANDIDATES[candidateIndex];

  if (state.key === 'CANDIDATE_CONFIRMATION') {
    return {
      ...state,
      main: candidate.name,
      sub: `${origin}에서 출발 · ${candidate.desc} · ${candidate.hint}`,
      tts: `${origin}에서 ${candidate.name}으로 안내할까요? 맞으면 화면을 두 번, 목적지를 고치려면 화면을 세 번 터치해주세요.`,
      chip: destination ? '입력 확인' : `후보 ${candidateIndex + 1}/${DESTINATION_CANDIDATES.length}`,
    };
  }

  if (state.key === 'BUILDING_ROUTE') {
    return {
      ...state,
      phase: '경로 탐색 중',
      main: '안전 경로를 탐색 중입니다',
      sub: `${origin}에서 ${candidate.name}까지 접근성 경로를 계산하고 있습니다.`,
      tts: '안전 경로를 탐색 중입니다. 잠시 기다려주세요.',
      chip: '탐색 중',
    };
  }

  return state;
}

export function getRouteInstructionViewState(
  instruction: RouteInstruction,
  stepIndex: number,
  stepCount: number,
  previousInstruction?: RouteInstruction
): IeumState {
  const position = `${stepIndex + 1}/${stepCount}`;
  const stationName = instruction.station_name
    ? instruction.station_name.endsWith('역')
      ? instruction.station_name
      : `${instruction.station_name}역`
    : '역사';
  const lineName = instruction.line_code
    ? instruction.line_code.endsWith('선')
      ? instruction.line_code
      : `${instruction.line_code}호선`
    : '지하철';
  const gpsResumes =
    isGpsGuidedInstruction(instruction) &&
    (!previousInstruction || ['subway_exit', 'station_passage'].includes(previousInstruction.type));
  const text = gpsResumes
    ? `GPS 안내를 시작합니다. 위치에 따라 다음 안내로 자동 전환합니다. ${instruction.text}`
    : instruction.text;
  const shared = {
    key: 'WALK_GUIDANCE' as const,
    icon: '🧭',
    sub: text,
    tts: text,
    chip: `안내 ${position}`,
    mapTitle: '실제 경로',
  };

  switch (instruction.type) {
    case 'walk':
      return { ...shared, phase: `보행 안내 ${position}`, main: '보행로 이동', accent: '#25A368', visual: 'map' };
    case 'walk_with_braille':
      return { ...shared, phase: `보행 안내 ${position}`, main: '점자블록 안내', accent: '#25A368', visual: 'map' };
    case 'crosswalk':
      return { ...shared, phase: `횡단 안내 ${position}`, main: '횡단보도 이동', accent: '#D78126', visual: 'map' };
    case 'subway_entry':
      return { ...shared, phase: `역 진입 ${position}`, main: `${stationName} 진입`, accent: '#8C49CA', visual: 'station' };
    case 'subway_internal':
      return { ...shared, phase: `역 내부 ${position}`, main: `${stationName} 내부 이동`, accent: '#356CD2', visual: 'station' };
    case 'transfer':
      return { ...shared, phase: `환승 ${position}`, main: `${stationName} 환승`, accent: '#356CD2', visual: 'station' };
    case 'subway_ride':
      return { ...shared, phase: `열차 이동 ${position}`, main: `${lineName} 이용`, accent: '#248BC8', visual: 'trainLine' };
    case 'subway_exit':
      return { ...shared, phase: `역 이탈 ${position}`, main: `${stationName} 밖으로 이동`, accent: '#8C49CA', visual: 'station' };
    case 'station_passage':
      return { ...shared, phase: `역사 통과 ${position}`, main: `${stationName} 통과 이동`, accent: '#8C49CA', visual: 'station' };
    case 'destination':
      return {
        ...shared,
        key: 'ARRIVED',
        phase: '도착 완료',
        icon: '✅',
        main: '목적지에 도착했습니다',
        chip: '도착',
        accent: '#22A267',
        visual: 'map',
        mapTitle: '도착 위치 확인',
      };
    default:
      return { ...shared, phase: `이동 안내 ${position}`, main: '경로 이동', accent: '#25A368', visual: 'map' };
  }
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

function findStateIndex(key: IeumStateKey) {
  return IEUM_STATES.findIndex((state) => state.key === key);
}

export function getNextIndex(currentIndex: number, tapCount: number) {
  const key = IEUM_STATES[currentIndex].key;
  const flow: Partial<Record<IeumStateKey, IeumStateKey>> =
    tapCount === 2
      ? {
          APP_LAUNCH: 'WAIT_DESTINATION_INPUT',
          WAIT_DESTINATION_INPUT: 'LISTENING_DESTINATION',
          LISTENING_DESTINATION: 'CANDIDATE_CONFIRMATION',
          CANDIDATE_CONFIRMATION: 'BUILDING_ROUTE',
          BUILDING_ROUTE: 'WALK_GUIDANCE',
          ALIGHTING_CONFIRMATION: 'EXITING_STATION',
          ARRIVED: 'WAIT_DESTINATION_INPUT',
        }
      : tapCount === 3
        ? {
            LISTENING_DESTINATION: 'WAIT_DESTINATION_INPUT',
            BUILDING_ROUTE: 'WAIT_DESTINATION_INPUT',
            ALIGHTING_CONFIRMATION: 'ON_TRAIN_GUIDANCE',
          }
        : tapCount === 4
          ? {
              ENTERING_STATION: 'STATION_INDOOR_GUIDANCE',
              STATION_INDOOR_GUIDANCE: 'ON_TRAIN_GUIDANCE',
              ON_TRAIN_GUIDANCE: 'ALIGHTING_CONFIRMATION',
              EXITING_STATION: 'ARRIVED',
            }
          : {};

  const nextKey = flow[key];
  return nextKey ? findStateIndex(nextKey) : currentIndex;
}

export function shouldOpenRequestPanel(key: IeumStateKey, tapCount: number) {
  return (
    tapCount === 3 &&
    [
      'APP_LAUNCH',
      'WAIT_DESTINATION_INPUT',
      'WALK_GUIDANCE',
      'ENTERING_STATION',
      'STATION_INDOOR_GUIDANCE',
      'ON_TRAIN_GUIDANCE',
      'EXITING_STATION',
      'ARRIVED',
    ].includes(key)
  );
}

export function allowsHelperMapMode(key: IeumStateKey) {
  return ['WALK_GUIDANCE', 'ENTERING_STATION', 'EXITING_STATION'].includes(key);
}
import { RouteInstruction } from '@/services/route-api';
