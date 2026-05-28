import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { NavigationFix } from '@/features/ieum/guidance/route-navigator';

type LocationState = {
  currentLocation: NavigationFix | null;
  permissionGranted: boolean;
  isTracking: boolean;
  error: string | null;
};

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

    async function start() {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (cancelled) {
          return;
        }
        if (permission.status !== Location.PermissionStatus.GRANTED) {
          setPermissionGranted(false);
          setError('현재 위치 권한이 없어 GPS 안내를 시작할 수 없습니다.');
          return;
        }

        setPermissionGranted(true);
        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setCurrentLocation({
            latitude: initial.coords.latitude,
            longitude: initial.coords.longitude,
            accuracy: initial.coords.accuracy,
            heading: initial.coords.heading,
            speed: initial.coords.speed,
          });
        }

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 3,
          },
          (location) => {
            setCurrentLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy,
              heading: location.coords.heading,
              speed: location.coords.speed,
            });
          }
        );
        if (!cancelled) {
          setIsTracking(true);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setIsTracking(false);
          setError('현재 위치를 확인하지 못했습니다.');
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      subscription?.remove();
      setIsTracking(false);
    };
  }, [enabled]);

  return { currentLocation, permissionGranted, isTracking, error };
}
