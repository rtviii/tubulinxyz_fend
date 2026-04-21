import { ColorStructure } from "../schemeclass";
import { categorizeCell, resetCategorizeCache } from "./categorize";
import { PALETTE_BW, LEGEND_ORDER } from "./palettes";

const salienceMono: ColorStructure = {
  init: function () {
    resetCategorizeCache();
  },

  run: function (
    baseRaw: string,
    pos: number,
    conservationRaw?: unknown,
    _row?: number,
  ): string {
    const cat = categorizeCell(baseRaw, pos, conservationRaw);
    return PALETTE_BW[cat];
  },

  map: Object.fromEntries(
    LEGEND_ORDER.map(({ label, category }) => [label, PALETTE_BW[category]]),
  ),
};

export default salienceMono;
