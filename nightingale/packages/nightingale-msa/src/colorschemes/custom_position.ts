// nightingale/packages/nightingale-msa/src/colorschemes/custom_position.ts
import { ColorStructure } from "./schemeclass";

export interface PositionColorConfig {
  positionColors: Map<number, string> | Record<number, string>;
  cellColors?: Map<string, string> | Record<string, string>;
  defaultColor: string;
}

declare global {
  interface Window {
    __nightingaleCustomColors?: PositionColorConfig;
  }
}

const customPosition: ColorStructure = {
  init: function () { },

run: function (
    base: string,
    position: number,
    _conservation?: unknown,
    row?: number
  ): string {
    const config = typeof window !== 'undefined' ? window.__nightingaleCustomColors : undefined;
    
    // Debug: log every 100th call to avoid spam
    if (position === 339 || position === 340) {
      console.log('[custom_position.run]', { base, position, row, hasConfig: !!config, cellColors: config?.cellColors });
    }
    
    if (!config) {
      return "#ffffff";
    }
    
    // Check cell-specific coloring first (row+position)
    if (row !== undefined && config.cellColors) {
      const cellKey = `${row}-${position}`;
      const cellColor = config.cellColors instanceof Map
        ? config.cellColors.get(cellKey)
        : config.cellColors[cellKey];
        
      if (position === 339 || position === 340) {
        console.log('[custom_position.run] Cell lookup:', { cellKey, cellColor, allKeys: Object.keys(config.cellColors || {}) });
      }
      
      if (cellColor) {
        return cellColor;
      }
    }

    // Fall back to position-only coloring
    const posColor = config.positionColors instanceof Map
      ? config.positionColors.get(position)
      : config.positionColors[position];

    if (posColor) {
      return posColor;
    }

    return config.defaultColor;
  },
  map: {},
};

export default customPosition;
