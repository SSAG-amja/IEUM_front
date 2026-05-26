import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';

import { RouteResponse } from '@/services/route-api';

type RouteSessionValue = {
  originQuery: string;
  destinationQuery: string;
  route: RouteResponse | null;
  setOriginQuery: (value: string) => void;
  setDestinationQuery: (value: string) => void;
  setRoute: (value: RouteResponse | null) => void;
  clearRoute: () => void;
};

const RouteSessionContext = createContext<RouteSessionValue | null>(null);

export function RouteSessionProvider({ children }: PropsWithChildren) {
  const [originQuery, setOriginQuery] = useState('시청역');
  const [destinationQuery, setDestinationQuery] = useState('강남역');
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const value = useMemo(
    () => ({
      originQuery,
      destinationQuery,
      route,
      setOriginQuery,
      setDestinationQuery,
      setRoute,
      clearRoute: () => setRoute(null),
    }),
    [destinationQuery, originQuery, route]
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
