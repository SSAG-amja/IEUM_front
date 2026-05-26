import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';

type MutedGuidanceHapticsOptions = {
  guidanceActive: boolean;
  isOutputMuted: boolean | null;
};

const MUTED_GUIDANCE_PULSE_INTERVAL_MS = 1000;

export function useMutedGuidanceHaptics({
  guidanceActive,
  isOutputMuted,
}: MutedGuidanceHapticsOptions) {
  useEffect(() => {
    if (!guidanceActive || isOutputMuted !== true) {
      return;
    }

    const pulse = () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    };

    pulse();
    const interval = setInterval(pulse, MUTED_GUIDANCE_PULSE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [guidanceActive, isOutputMuted]);
}
