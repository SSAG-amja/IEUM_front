import * as Speech from 'expo-speech';
import { useEffect } from 'react';

export function useAnnouncement(text: string, enabled = true) {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    Speech.stop();
    Speech.speak(text, {
      language: 'ko-KR',
      rate: 0.95,
      useApplicationAudioSession: false,
    });
    return () => {
      Speech.stop();
    };
  }, [enabled, text]);
}

export function repeatAnnouncement(text: string) {
  Speech.stop();
  Speech.speak(text, {
    language: 'ko-KR',
    rate: 0.95,
    useApplicationAudioSession: false,
  });
}
