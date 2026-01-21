// nightingale/packages/nightingale-msa/src/colorschemes/pid_colors.ts
import { ConservationManager } from "../types/types";
import { ColorStructure } from "./schemeclass";

const aLetterOffset = "A".charCodeAt(0);
const lettersInAlphabet = 26;
const gaps = new Set(["", " ", "-", "_", "."]);

const pid: ColorStructure = {
  init: function () {},
  
  run: function (
    baseRaw: string,
    pos: number,
    conservationRaw?: unknown,
    _row?: number
  ): string {
    const base = baseRaw.toUpperCase();
    const conservation = conservationRaw as ConservationManager | undefined;
    
    if (
      !conservation ||
      conservation.progress !== 1 ||
      gaps.has(base) ||
      pos > conservation.map.length / lettersInAlphabet
    )
      return "#ffffff";
    
    const letterIndex = base.charCodeAt(0) - aLetterOffset;
    if (letterIndex < 0 || letterIndex >= lettersInAlphabet) {
      return "#ffffff";
    }
    
    const cons = conservation.map[pos * lettersInAlphabet + letterIndex] || 0;
    if (cons > 0.8) {
      return "#6464ff";
    } else if (cons > 0.6) {
      return "#9da5ff";
    } else if (cons > 0.4) {
      return "#cccccc";
    } else {
      return "#ffffff";
    }
  },
  
  map: {
    "> 0.8": "#6464ff",
    "> 0.6": "#9da5ff",
    "> 0.4": "#cccccc",
    "> 0": "#ffffff",
  },
};

export default pid;
