import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { NavigationFix } from '@/features/ieum/guidance/route-navigator';

const CURRENT_LOCATION_TIMEOUT_MS = 8000;
const LOCATION_RETRY_DELAY_MS = 5000;

type LocationState = {
  currentLocation: NavigationFix | null;
  permissionGranted: boolean;
  isTracking: boolean;
  error: string | null;
};

function toNavigationFix(location: Location.LocationObject): NavigationFix {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    heading: location.coords.heading,
    speed: location.coords.speed,
    timestamp: location.timestamp,
  };
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('location timeout')), milliseconds);
    }),
  ]);
}

export function useCurrentLocation(enabled: boolean): LocationState {
  const [currentLocation, setCurrentLocation] = useState<NavigationFix | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setIsTracking(false);
      return;
    }

    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function start() {
      try {
        retryTimer = null;
        subscription?.remove();
        subscription = null;

        const permission = await Location.requestForegroundPermissionsAsync();
        if (cancelled) {
          return;
        }
        if (permission.status !== Location.PermissionStatus.GRANTED) {
          setPermissionGranted(false);
          setIsTracking(false);
          setError('현재 위치 권한이 없어 GPS 안내를 시작할 수 없습니다.');
          return;
        }

        setPermissionGranted(true);
        setIsTracking(true);
        setError(null);

        const lastKnown = await Location.getLastKnownPositionAsync({
          maxAge: 60_000,
          requiredAccuracy: 200,
        }).catch(() => null);
        if (!cancelled && lastKnown) {
          setCurrentLocation(toNavigationFix(lastKnown));
        }

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 3,
          },
          (location) => {
            setCurrentLocation(toNavigationFix(location));
          }
        );

        const initial = await withTimeout(
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
          CURRENT_LOCATION_TIMEOUT_MS
        ).catch(() => null);
        if (!cancelled && initial) {
          setCurrentLocation(toNavigationFix(initial));
        }
      } catch {
        if (!cancelled) {
          setIsTracking(false);
          setError('현재 위치를 확인하지 못했습니다.');
          retryTimer = setTimeout(() => {
            void start();
          }, LOCATION_RETRY_DELAY_MS);
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      subscription?.remove();
      setIsTracking(false);
    };
  }, [enabled]);

  return { currentLocation, permissionGranted, isTracking, error };
}
