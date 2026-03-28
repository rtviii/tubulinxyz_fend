// nightingale/packages/nightingale-msa/src/utils/ColorScheme.ts
import schemes from "../colorschemes";
import { DynSchemeClass, StaticSchemeClass } from "../colorschemes/schemeclass";
import { ConservationManager } from "../types/types";
const schemesMgr = new schemes();

class ColorScheme {
  scheme: DynSchemeClass | StaticSchemeClass;
  conservation?: ConservationManager;
  private _schemeName: string;
  private _loggedOnce = false;

  constructor(colorScheme: string) {
    this._schemeName = colorScheme;
    this.scheme = schemesMgr.getScheme(colorScheme);
    console.log('[ColorScheme] created for:', colorScheme, 'type:', this.scheme.type);
  }

  updateConservation(conservation: ConservationManager) {
    console.log('[ColorScheme] updateConservation called, scheme:', this._schemeName, 'progress:', conservation?.progress, 'map length:', conservation?.map?.length);
    this.conservation = conservation;
  }

  getColor(element: string, position: number, row?: number) {
    if (this.scheme.type === "dyn") {
      if (!this._loggedOnce) {
        this._loggedOnce = true;
        console.log('[ColorScheme] first getColor call for dyn scheme:', this._schemeName, 'conservation exists:', !!this.conservation, 'progress:', this.conservation?.progress);
      }
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
