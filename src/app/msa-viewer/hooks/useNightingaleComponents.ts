import { useState, useEffect } from 'react';

export function useNightingaleComponents() {
  const [areLoaded, setAreLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadComponents = async () => {
      try {
        await import("@nightingale-elements/nightingale-manager");
        await import("@nightingale-elements/nightingale-msa");
        await import("@nightingale-elements/nightingale-track");
        await import("@nightingale-elements/nightingale-navigation");
        await new Promise((resolve) => setTimeout(resolve, 100));
        setAreLoaded(true);
      } catch (err) {
        setError("Failed to load Nightingale visualization components.");
      }
    };
    loadComponents();
  }, []);

  return { areLoaded, error };
}