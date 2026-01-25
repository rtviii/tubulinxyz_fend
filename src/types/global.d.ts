// src/types/global.d.ts

interface NightingaleCustomColors {
  positionColors: Record<number, string>;
  cellColors?: Record<string, string>;
  defaultColor: string;
}

declare global {
  interface Window {
    __nightingaleCustomColors?: NightingaleCustomColors;
  }
}

export {};