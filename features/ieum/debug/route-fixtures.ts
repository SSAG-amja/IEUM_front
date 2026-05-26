import { RouteInstruction, RouteResponse } from '@/services/route-api';

function buildFixture(name: string, instructions: RouteInstruction[]): RouteResponse {
  return {
    route_id: `debug_${name}`,
    profile: 'visual_impairment_default',
    summary: {
      start: { label: '시청역', lon: 126.977, lat: 37.5657, source: 'debug' },
      end: { label: '강남역', lon: 127.0276, lat: 37.4979, source: 'debug' },
      total_length_m: 1200,
      total_visual_impairment_cost: 900,
      uses_subway: true,
      transfer_count: 0,
      subway_lines: ['2'],
    },
    geometry: { type: 'FeatureCollection', features: [] },
    instructions: [{ type: 'route_start', text: '안내를 시작합니다.' }, ...instructions],
    legs: [],
  };
}

const fixtures: Record<string, RouteResponse> = {
  walk: buildFixture('walk', [
    { type: 'walk_with_braille', text: 'GPS 안내를 따라 점자블록을 따라 약 80미터 이동하세요.' },
    { type: 'crosswalk', text: '음향신호기가 있는 횡단보도를 건너세요.' },
    { type: 'destination', text: '목적지 주변에 도착했습니다.' },
  ]),
  'subway-internal': buildFixture('subway_internal', [
    {
      type: 'subway_entry',
      text: '시청역 입구에 도착했습니다. 역 안에서는 GPS 안내를 사용하지 않습니다. 역 안으로 들어가면 화면을 네 번 터치해주세요.',
      station_name: '시청',
    },
    {
      type: 'subway_internal',
      text: '시청역 안에서 지하 1층 승강장으로 이동하세요. 이동을 마치면 화면을 네 번 터치해주세요.',
      station_name: '시청',
    },
    {
      type: 'subway_ride',
      text: '2호선을 이용해 시청역에서 강남역까지 이동하세요. 도착하면 화면을 네 번 터치해주세요.',
      line_code: '2',
      from_station: '시청',
      to_station: '강남',
    },
  ]),
  'subway-ride': buildFixture('subway_ride', [
    {
      type: 'subway_ride',
      text: '2호선을 이용해 시청역에서 강남역까지 이동하세요. 도착하면 화면을 네 번 터치해주세요.',
      line_code: '2',
      from_station: '시청',
      to_station: '강남',
    },
    {
      type: 'subway_exit',
      text: '강남역 밖으로 이동하세요. 역 밖으로 나왔다면 화면을 네 번 터치해주세요. 확인 후 GPS 안내를 다시 시작합니다.',
      station_name: '강남',
    },
  ]),
  'subway-exit': buildFixture('subway_exit', [
    {
      type: 'subway_exit',
      text: '강남역 밖으로 이동하세요. 역 밖으로 나왔다면 화면을 네 번 터치해주세요. 확인 후 GPS 안내를 다시 시작합니다.',
      station_name: '강남',
    },
    { type: 'walk_with_braille', text: '점자블록을 따라 약 100미터 이동하세요.' },
    { type: 'destination', text: '목적지 주변에 도착했습니다.' },
  ]),
};

export function getDebugRoute(debug?: string | string[]) {
  const key = Array.isArray(debug) ? debug[0] : debug;
  return key ? fixtures[key] ?? null : null;
}
