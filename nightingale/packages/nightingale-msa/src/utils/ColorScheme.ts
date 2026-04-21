// nightingale/packages/nightingale-msa/src/utils/ColorScheme.ts
import schemes from "../colorschemes";
import { DynSchemeClass, StaticSchemeClass } from "../colorschemes/schemeclass";
import { ConservationManager } from "../types/types";
const schemesMgr = new schemes();

class ColorScheme {
  scheme: DynSchemeClass | StaticSchemeClass;
  conservation?: ConservationManager;

  constructor(colorScheme: string) {
    this.scheme = schemesMgr.getScheme(colorScheme);
  }

  updateConservation(conservation: ConservationManager) {
    this.conservation = conservation;
  }

  getColor(element: string, position: number, row?: number) {
    if (this.scheme.type === "dyn") {
      return (this.scheme as DynSchemeClass).getColor(
        element,
        position,
        this.conservation,
        row,
      );
    }
    return (this.scheme as StaticSchemeClass).getColor(element);
  }
}

export default ColorScheme;
export { ColorScheme };
