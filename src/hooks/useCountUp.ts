import { useEffect, useState } from "react";

interface UseCountUpOptions {
  end: number;
  start?: number;
  duration?: number;
  decimals?: number;
  enabled?: boolean;
}

export function useCountUp({ end, start = 0, duration = 2000, decimals = 0, enabled = true }: UseCountUpOptions) {
  const [value, setValue] = useState(start);

  useEffect(() => {
    if (!enabled) {
      setValue(start);
      return;
    }

    let startTime: number | null = null;
    let rafId: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = start + (end - start) * eased;
      setValue(Number(current.toFixed(decimals)));

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [end, start, duration, decimals, enabled]);

  return value;
}
