import { MapVisual } from '@/components/ieum/map-visual';
import { StationVisual } from '@/components/ieum/station-visual';
import { TrainLineVisual } from '@/components/ieum/train-line-visual';
import { GuidancePresentation } from '@/features/ieum/guidance/instruction-presenter';
import { Coordinate, RouteInstruction, RouteResponse } from '@/services/route-api';

type GuidanceVisualProps = {
  state: GuidancePresentation;
  helperMode: boolean;
  currentLocation?: Coordinate | null;
  currentHeading?: number | null;
  cameraHeading?: number | null;
  navigationMessage?: string;
  route?: RouteResponse | null;
  instruction?: RouteInstruction;
  instructions: RouteInstruction[];
  stepIndex: number;
  onMapTripleTap: () => void;
  onOpenFullscreen: () => void;
};

export function GuidanceVisual({
  state,
  helperMode,
  currentLocation,
  currentHeading,
  cameraHeading,
  navigationMessage,
  route,
  instruction,
  instructions,
  stepIndex,
  onMapTripleTap,
  onOpenFullscreen,
}: GuidanceVisualProps) {
  if (state.visual === 'map') {
    return (
      <MapVisual
        title={state.mapTitle}
        helperMode={helperMode}
        currentLocation={currentLocation}
        currentHeading={currentHeading}
        cameraHeading={cameraHeading}
        followUser={!helperMode}
        navigationMessage={navigationMessage}
        route={route}
        onTripleTap={onMapTripleTap}
        onOpenFullscreen={onOpenFullscreen}
      />
    );
  }

  if (state.visual === 'station') {
    return <StationVisual helperMode={helperMode} instructions={instructions} stepIndex={stepIndex} />;
  }

  if (state.visual === 'trainLine') {
    return <TrainLineVisual instruction={instruction} />;
  }

  return null;
}
