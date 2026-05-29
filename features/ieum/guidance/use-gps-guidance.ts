import { useEffect, useMemo, useRef, useState } from 'react';

import {
  buildRouteNavigationModel,
  isGpsNavigableInstruction,
  NavigationFix,
  RouteMatch,
} from '@/features/ieum/guidance/route-navigator';
import { RouteInstruction, RouteResponse } from '@/services/route-api';

const ADVANCE_DISTANCE_M = 2;
const OFF_ROUTE_DISTANCE_M = 55;
const AUTO_JUMP_MIN_DELTA = 1;

type GpsGuidanceState = {
  match: RouteMatch | null;
  matchStepIndex: number | null;
  message: string;
  offRoute: boolean;
  routeHeading: number | null;
};

function formatMeters(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}킬로미터`;
  }
  return `${Math.max(0, Math.round(value))}미터`;
}

export function useGpsGuidance({
  route,
  instructions,
  stepIndex,
  currentLocation,
  onStepChange,
}: {
  route: RouteResponse | null;
  instructions: RouteInstruction[];
  stepIndex: number;
  currentLocation: NavigationFix | null;
  onStepChange: (stepIndex: number) => void;
}): GpsGuidanceState {
  const [state, setState] = useState<GpsGuidanceState>({
    match: null,
    matchStepIndex: null,
    message: '현재 위치를 확인하는 중입니다.',
    offRoute: false,
    routeHeading: null,
  });
  const lastAutoStepRef = useRef(stepIndex);
  const navigationModel = useMemo(() => buildRouteNavigationModel(route, instructions), [instructions, route]);
  const activeInstruction = instructions[stepIndex];

  useEffect(() => {
    lastAutoStepRef.current = stepIndex;
  }, [stepIndex]);

  useEffect(() => {
    if (!currentLocation) {
      setState((previous) => ({
        ...previous,
        match: null,
        message: '현재 위치를 확인하는 중입니다.',
        matchStepIndex: null,
        offRoute: false,
        routeHeading: null,
      }));
      return;
    }

    if (!navigationModel) {
      setState({
        match: null,
        matchStepIndex: null,
        message: '경로 좌표가 부족해 현재 위치 기반 안내를 사용할 수 없습니다.',
        offRoute: false,
        routeHeading: null,
      });
      return;
    }

    const match = navigationModel.matchLocation(currentLocation, stepIndex);
    if (!match) {
      setState((previous) => ({
        ...previous,
        match: null,
        matchStepIndex: null,
        routeHeading: null,
      }));
      return;
    }

    const offRoute = match.distanceFromRouteM > OFF_ROUTE_DISTANCE_M;
    const progressStepIndex = navigationModel.instructionIndexAtProgress(match.rawProgressM);
    const shouldJumpForward =
      progressStepIndex !== null &&
      progressStepIndex - stepIndex >= AUTO_JUMP_MIN_DELTA &&
      progressStepIndex > lastAutoStepRef.current;

    if (shouldJumpForward) {
      lastAutoStepRef.current = progressStepIndex;
      onStepChange(progressStepIndex);
    } else if (
      isGpsNavigableInstruction(activeInstruction) &&
      match.remainingInstructionM !== null &&
      match.remainingInstructionM <= ADVANCE_DISTANCE_M &&
      stepIndex < instructions.length - 1
    ) {
      const nextStep = stepIndex + 1;
      lastAutoStepRef.current = nextStep;
      onStepChange(nextStep);
    }

    let message = '현재 위치 기준으로 경로를 따라 안내 중입니다.';
    if (offRoute) {
      message = `경로에서 약 ${formatMeters(match.distanceFromRouteM)} 벗어났습니다. 주변 보행로를 확인하고 필요하면 경로를 다시 계산하세요.`;
    } else if (isGpsNavigableInstruction(activeInstruction) && match.remainingInstructionM !== null) {
      message = `다음 안내까지 약 ${formatMeters(match.remainingInstructionM)} 남았습니다.`;
    } else {
      message = '역 내부 또는 차량 이동 구간입니다. 화면 안내를 확인한 뒤 진행을 완료하면 네 번 터치하세요.';
    }

    setState({ match, matchStepIndex: stepIndex, message, offRoute, routeHeading: match.routeHeading });
  }, [activeInstruction, currentLocation, instructions.length, navigationModel, onStepChange, stepIndex]);

  return state;
}
