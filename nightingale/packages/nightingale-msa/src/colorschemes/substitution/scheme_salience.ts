import { ColorStructure } from "../schemeclass";
import { categorizeCell, resetCategorizeCache } from "./categorize";
import { PALETTE_SALIENCE, LEGEND_ORDER } from "./palettes";

const substitutionSalience: ColorStructure = {
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
    return PALETTE_SALIENCE[cat];
  },

  map: Object.fromEntries(
    LEGEND_ORDER.map(({ label, category }) => [label, PALETTE_SALIENCE[category]]),
  ),
};

export default substitutionSalience;
