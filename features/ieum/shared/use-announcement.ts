import * as Speech from 'expo-speech';
import { useEffect } from 'react';

const SPEECH_RATE = 1.1;

export function useAnnouncement(text: string, enabled = true) {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    Speech.stop();
    Speech.speak(text, {
      language: 'ko-KR',
      rate: SPEECH_RATE,
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
    rate: SPEECH_RATE,
    useApplicationAudioSession: false,
  });
}
