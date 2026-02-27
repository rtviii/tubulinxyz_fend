// src/components/molstar/labels/LabelManager.ts

import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';
import { LabelRepresentation, LabelParams } from 'molstar/lib/mol-repr/shape/loci/label';
import type { LabelData } from 'molstar/lib/mol-repr/shape/loci/label';
import { StructureElement } from 'molstar/lib/mol-model/structure';
import { Color } from 'molstar/lib/mol-util/color';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';

/** Blend a color toward white by a factor (0 = original, 1 = white) */
function tintColor(color: Color, factor: number): Color {
  const r = (color >> 16) & 0xFF;
  const g = (color >> 8) & 0xFF;
  const b = color & 0xFF;
  return Color.fromRgb(
    Math.round(r + (255 - r) * factor),
    Math.round(g + (255 - g) * factor),
    Math.round(b + (255 - b) * factor),
  );
}

function makeLabelParams(accentColor?: Color, overrides?: Record<string, any>) {
  const defaults = PD.getDefaultValues(LabelParams);
  const accent = accentColor ?? Color(0x888888);

  return {
    ...defaults,
    scaleByRadius: false,
    textSize: 2.0,
    sizeFactor: 2.5,
    // Text styled with the accent color
    textColor: Color(0xFFFFFF),
    fontWeight: 'bold' as const,

    // Background tinted from the accent
    background: true,
    backgroundMargin: 0.5,
    backgroundColor: accent,
    backgroundOpacity: 0.85,

    // Border in a slightly darker shade
    borderWidth: 0.3,
    borderColor: accent,

    // Tether (the arrow line)
    tether: true,
    tetherLength: 5.0,
    tetherBaseWidth: 0.3,
    attachment: 'top-center' as const,

    ...overrides,
  };
}

export class LabelManager {
  private hoverRepr: any = null;
  private hoverOnCanvas = false;
  private persistent: Map<string, any> = new Map();

  constructor(private plugin: PluginUIContext) {}

  private get canvas() {
    return this.plugin.canvas3d;
  }

  private createRepr() {
    return LabelRepresentation(
      { webgl: this.canvas?.webgl, ...this.plugin.representation.structure.themes } as any,
      () => LabelParams
    );
  }

  // ── Hover label ──────────────────────────────────────────

  async showHover(loci: StructureElement.Loci, text: string, accentColor?: Color): Promise<void> {
    if (!this.canvas) return;

    const data: LabelData = { infos: [{ loci, label: text }] };

    if (!this.hoverRepr) {
      this.hoverRepr = this.createRepr();
    }

    await (this.hoverRepr as any).createOrUpdate(makeLabelParams(accentColor), data).run();

    if (!this.hoverOnCanvas) {
      this.canvas.add(this.hoverRepr);
      this.hoverOnCanvas = true;
    }
    this.canvas.commit?.();
  }

  hideHover(): void {
    if (!this.canvas || !this.hoverRepr || !this.hoverOnCanvas) return;
    this.canvas.remove(this.hoverRepr);
    this.hoverOnCanvas = false;
    this.canvas.commit?.();
  }

  // ── Persistent labels ────────────────────────────────────

  async addPersistent(
    key: string,
    loci: StructureElement.Loci,
    text: string,
    accentColor?: Color,
    paramOverrides?: Record<string, any>
  ): Promise<void> {
    if (!this.canvas) return;
    this.removePersistent(key);

    const repr = this.createRepr();
    const data: LabelData = { infos: [{ loci, label: text }] };
    await (repr as any).createOrUpdate(makeLabelParams(accentColor, paramOverrides), data).run();
    this.canvas.add(repr as any);
    this.canvas.commit?.();
    this.persistent.set(key, repr);
  }

  removePersistent(key: string): void {
    const repr = this.persistent.get(key);
    if (!repr || !this.canvas) return;
    this.canvas.remove(repr);
    this.canvas.commit?.();
    this.persistent.delete(key);
  }

  removeAllPersistent(): void {
    for (const key of [...this.persistent.keys()]) {
      this.removePersistent(key);
    }
  }

  dispose(): void {
    this.hideHover();
    this.removeAllPersistent();
    this.hoverRepr = null;
  }
}