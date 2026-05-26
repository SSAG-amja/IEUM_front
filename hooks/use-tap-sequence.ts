import { useEffect, useRef } from 'react';

export function useTapSequence(onResolved: (count: number) => void, delayMs = 430) {
  const handlerRef = useRef(onResolved);
  const countRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  handlerRef.current = onResolved;

  const cancelPendingSequence = () => {
    countRef.current = 0;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return cancelPendingSequence;
  }, []);

  const registerTap = () => {
    countRef.current += 1;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      const count = countRef.current;
      countRef.current = 0;

      if ([2, 3, 4].includes(count)) {
        handlerRef.current(count);
      }
    }, delayMs);
  };

  return { registerTap, cancelPendingSequence };
}
