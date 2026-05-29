import { useCallback, useEffect, useMemo, useState } from 'react';

import { RouteResponse } from '@/services/route-api';
import {
  isGpsGuidedInstruction,
  presentInstruction,
  requiresGuidanceConfirmation,
} from '@/features/ieum/guidance/instruction-presenter';

export function useGuidanceController(route: RouteResponse | null) {
  const [stepIndex, setStepIndex] = useState(0);
  const instructions = useMemo(
    () => route?.instructions.filter((instruction) => instruction.type !== 'route_start') ?? [],
    [route]
  );

  useEffect(() => {
    setStepIndex(0);
  }, [route?.route_id]);

  const activeInstruction = instructions[stepIndex];
  const presentation = activeInstruction
    ? presentInstruction(activeInstruction, stepIndex, instructions.length, instructions[stepIndex - 1])
    : null;
  const canAdvance = stepIndex < instructions.length - 1;
  const advance = useCallback(() => {
    if (canAdvance) {
      setStepIndex((previous) => previous + 1);
    }
  }, [canAdvance]);
  const previous = useCallback(() => {
    setStepIndex((current) => Math.max(current - 1, 0));
  }, []);
  const goToStep = useCallback((nextIndex: number) => {
    setStepIndex(Math.max(0, Math.min(nextIndex, instructions.length - 1)));
  }, [instructions.length]);

  return {
    instructions,
    stepIndex,
    activeInstruction,
    presentation,
    isArrived: activeInstruction?.type === 'destination',
    isGpsGuided: isGpsGuidedInstruction(activeInstruction),
    requiresConfirmation: requiresGuidanceConfirmation(activeInstruction),
    progress: instructions.length ? `${Math.round(((stepIndex + 1) / instructions.length) * 100)}%` as const : '0%' as const,
    canAdvance,
    advance,
    previous,
    goToStep,
  };
}
