import { Coordinate, RouteFeature, RouteInstruction, RouteResponse } from '@/services/route-api';

export type NavigationFix = Coordinate & {
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp?: number | null;
};

export type InstructionTarget = {
  instructionIndex: number;
  startM: number;
  endM: number;
};

export type RouteMatch = {
  distanceFromRouteM: number;
  rawProgressM: number;
  progressM: number;
  routeHeading: number | null;
  remainingRouteM: number;
  remainingInstructionM: number | null;
  target: InstructionTarget | null;
};

export type RouteNavigationModel = {
  totalM: number;
  targets: InstructionTarget[];
  matchLocation: (location: Coordinate, instructionIndex: number) => RouteMatch | null;
  instructionIndexAtProgress: (progressM: number) => number | null;
  routeHeadingAtProgress: (progressM: number) => number | null;
};

type RoutePoint = Coordinate & {
  progressM: number;
};

const GPS_INSTRUCTION_TYPES = new Set(['walk', 'walk_with_braille', 'crosswalk', 'move', 'facility_connector']);
const EARTH_RADIUS_M = 6371000;

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function toDeg(value: number) {
  return (value * 180) / Math.PI;
}

function normalizeDegrees(value: number) {
  return (value + 360) % 360;
}

export function isGpsNavigableInstruction(instruction?: RouteInstruction) {
  return Boolean(instruction && GPS_INSTRUCTION_TYPES.has(instruction.type));
}

export function distanceMeters(left: Coordinate, right: Coordinate) {
  const dLat = toRad(right.latitude - left.latitude);
  const dLon = toRad(right.longitude - left.longitude);
  const lat1 = toRad(left.latitude);
  const lat2 = toRad(right.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function bearingDegrees(start: Coordinate, end: Coordinate) {
  const startLat = toRad(start.latitude);
  const endLat = toRad(end.latitude);
  const deltaLon = toRad(end.longitude - start.longitude);
  const y = Math.sin(deltaLon) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(deltaLon);
  return normalizeDegrees(toDeg(Math.atan2(y, x)));
}

function featureCoordinates(feature: RouteFeature) {
  return feature.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude }));
}

function flattenRoute(route: RouteResponse): RoutePoint[] {
  const points: RoutePoint[] = [];
  let progressM = 0;

  for (const feature of route.geometry.features) {
    const coords = featureCoordinates(feature);
    for (const coord of coords) {
      const previous = points[points.length - 1];
      if (previous) {
        progressM += distanceMeters(previous, coord);
      }
      if (!previous || previous.latitude !== coord.latitude || previous.longitude !== coord.longitude) {
        points.push({ ...coord, progressM });
      }
    }
  }

  return points;
}

function buildTargets(instructions: RouteInstruction[], totalM: number): InstructionTarget[] {
  const targets: InstructionTarget[] = [];
  let cursorM = 0;

  instructions.forEach((instruction, instructionIndex) => {
    const distanceM = Math.max(0, Number(instruction.distance_m || 0));
    const startM = cursorM;
    const endM = distanceM > 0 ? Math.min(totalM, cursorM + distanceM) : cursorM;

    if (isGpsNavigableInstruction(instruction)) {
      targets.push({
        instructionIndex,
        startM,
        endM: Math.max(endM, startM + 1),
      });
    }

    cursorM = endM;
  });

  return targets;
}

function projectOnSegment(point: Coordinate, start: RoutePoint, end: RoutePoint) {
  const latitudeScale = 111320;
  const longitudeScale = 111320 * Math.cos(toRad(point.latitude));
  const px = point.longitude * longitudeScale;
  const py = point.latitude * latitudeScale;
  const ax = start.longitude * longitudeScale;
  const ay = start.latitude * latitudeScale;
  const bx = end.longitude * longitudeScale;
  const by = end.latitude * latitudeScale;
  const dx = bx - ax;
  const dy = by - ay;
  const length2 = dx * dx + dy * dy;
  const t = length2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2)) : 0;
  const projected = {
    latitude: start.latitude + (end.latitude - start.latitude) * t,
    longitude: start.longitude + (end.longitude - start.longitude) * t,
  };
  const segmentM = Math.max(0, end.progressM - start.progressM);

  return {
    distanceM: distanceMeters(point, projected),
    progressM: start.progressM + segmentM * t,
  };
}

function routeHeadingAtProgress(points: RoutePoint[], progressM: number) {
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    if (progressM <= end.progressM) {
      return bearingDegrees(start, end);
    }
  }

  const start = points[points.length - 2];
  const end = points[points.length - 1];
  return start && end ? bearingDegrees(start, end) : null;
}

function nearestProgress(points: RoutePoint[], location: Coordinate) {
  let best: { distanceM: number; progressM: number } | null = null;

  for (let index = 1; index < points.length; index += 1) {
    const candidate = projectOnSegment(location, points[index - 1], points[index]);
    if (!best || candidate.distanceM < best.distanceM) {
      best = candidate;
    }
  }

  return best;
}

export function buildRouteNavigationModel(
  route: RouteResponse | null,
  instructions: RouteInstruction[]
): RouteNavigationModel | null {
  if (!route) {
    return null;
  }

  const points = flattenRoute(route);
  if (points.length < 2) {
    return null;
  }

  const totalM = points[points.length - 1].progressM;
  const targets = buildTargets(instructions, totalM);

  return {
    totalM,
    targets,
    matchLocation(location, instructionIndex) {
      const nearest = nearestProgress(points, location);
      if (!nearest) {
        return null;
      }

      const target = targets.find((item) => item.instructionIndex === instructionIndex) ?? null;
      const progressForTarget = target
        ? Math.max(target.startM, Math.min(target.endM, nearest.progressM))
        : nearest.progressM;
      const remainingInstructionM = target ? Math.max(0, target.endM - progressForTarget) : null;
      const routeHeading = routeHeadingAtProgress(points, progressForTarget);

      return {
        distanceFromRouteM: nearest.distanceM,
        rawProgressM: nearest.progressM,
        progressM: progressForTarget,
        routeHeading,
        remainingRouteM: Math.max(0, totalM - progressForTarget),
        remainingInstructionM,
        target,
      };
    },
    instructionIndexAtProgress(progressM) {
      const target = targets.find((item) => progressM >= item.startM - 8 && progressM <= item.endM + 8);
      return target?.instructionIndex ?? null;
    },
    routeHeadingAtProgress(progressM) {
      return routeHeadingAtProgress(points, progressM);
    },
  };
}
