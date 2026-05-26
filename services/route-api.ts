export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type RouteFeature = {
  type: 'Feature';
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  properties: {
    edge_type?: string;
    line_color?: string;
    near_braille_count?: number;
    has_braille?: boolean;
    has_elevator?: boolean;
    has_audible_signal?: boolean;
    [key: string]: unknown;
  };
};

export type RouteInstruction = {
  type: string;
  text: string;
  distance_m?: number;
  direction?: string;
  station_name?: string;
  line_code?: string;
  from_station?: string;
  to_station?: string;
  segment_count?: number;
};

export type RouteLeg = {
  type: 'outdoor_walk' | 'station_entry' | 'subway_ride' | 'station_exit';
  distance_m: number;
  edge_count: number;
  accessibility: string[];
};

export type RouteResponse = {
  route_id: string;
  profile: string;
  summary: {
    start: { label: string; lon: number; lat: number; source: string };
    end: { label: string; lon: number; lat: number; source: string };
    total_length_m: number;
    total_visual_impairment_cost: number;
    uses_subway: boolean;
    transfer_count: number;
    subway_lines: string[];
    dataset_coverage?: Record<string, number>;
  };
  geometry: {
    type: 'FeatureCollection';
    features: RouteFeature[];
  };
  instructions: RouteInstruction[];
  legs: RouteLeg[];
};

const API_URL = process.env.EXPO_PUBLIC_IEUM_API_URL ?? 'http://127.0.0.1:8020';

export async function requestAccessibleRoute(originQuery: string, destinationQuery: string) {
  const response = await fetch(`${API_URL}/api/v1/routes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      origin: { query: originQuery },
      destination: { query: destinationQuery },
      profile: 'visual_impairment_default',
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.detail ?? '경로를 계산하지 못했습니다.');
  }
  return payload as RouteResponse;
}
