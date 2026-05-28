import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useState } from 'react';

import { Coordinate, RouteResponse } from '@/services/route-api';

type RouteSessionValue = {
  originQuery: string;
  originCoordinate: Coordinate | null;
  destinationQuery: string;
  route: RouteResponse | null;
  setOriginQuery: (value: string) => void;
  setOriginCoordinate: (value: Coordinate | null) => void;
  setDestinationQuery: (value: string) => void;
  setRoute: (value: RouteResponse | null) => void;
  clearRoute: () => void;
};

const RouteSessionContext = createContext<RouteSessionValue | null>(null);

export function RouteSessionProvider({ children }: PropsWithChildren) {
  const [originQuery, setOriginQuery] = useState('고덕로 210');
  const [originCoordinate, setOriginCoordinate] = useState<Coordinate | null>(null);
  const [destinationQuery, setDestinationQuery] = useState('강남역');
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const clearRoute = useCallback(() => setRoute(null), []);
  const value = useMemo(
    () => ({
      originQuery,
      originCoordinate,
      destinationQuery,
      route,
      setOriginQuery,
      setOriginCoordinate,
      setDestinationQuery,
      setRoute,
      clearRoute,
    }),
    [clearRoute, destinationQuery, originCoordinate, originQuery, route]
  );

  return <RouteSessionContext.Provider value={value}>{children}</RouteSessionContext.Provider>;
}

export function useRouteSession() {
  const session = useContext(RouteSessionContext);
  if (!session) {
    throw new Error('useRouteSession must be used within RouteSessionProvider');
  }
  return session;
}
