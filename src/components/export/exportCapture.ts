'use client';

// Poster-asset capture helpers. Three tiers, picked per component:
//  - captureNodePng / captureNodeSvg: generic DOM nodes (residue popup, cards)
//  - captureCanvasPng: pixel-accurate grab of the MSA alignment <canvas>
//  - captureSvg: true-vector grab of an <svg> (the nightingale nav ruler)
// Nightingale renders some pieces inside web components, so the finders below
// traverse shadow roots as well as light DOM.

/** Trigger a browser download of a data URL or object URL. */
export function downloadUrl(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Trigger a browser download of a Blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  downloadUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** querySelectorAll that descends into open shadow roots. */
function deepQueryAll<T extends Element>(root: ParentNode, selector: string): T[] {
  const out: T[] = [];
  const visit = (node: ParentNode) => {
    node.querySelectorAll(selector).forEach((el) => out.push(el as unknown as T));
    node.querySelectorAll('*').forEach((el) => {
      const sr = (el as HTMLElement).shadowRoot;
      if (sr) visit(sr);
    });
  };
  visit(root);
  return out;
}

/** Capture a DOM node as a high-res PNG via html-to-image.
 *  pixelRatio multiplies the node's CSS size, so a 1800px node at 4 → 7200px. */
export async function captureNodePng(node: HTMLElement, filename: string, pixelRatio = 4) {
  const { toPng } = await import('html-to-image');
  const dataUrl = await toPng(node, { pixelRatio, cacheBust: true });
  downloadUrl(dataUrl, filename);
}

/** Capture a DOM node as an SVG (vector for text/shapes, embedded raster for images). */
export async function captureNodeSvg(node: HTMLElement, filename: string) {
  const { toSvg } = await import('html-to-image');
  const dataUrl = await toSvg(node, { cacheBust: true });
  downloadUrl(dataUrl, filename);
}

/** Find the visible MSA alignment canvas inside a root.
 *  nightingale-msa double-buffers two <canvas>; the live one has
 *  style.visibility !== 'hidden'. Falls back to the largest drawn canvas. */
export function findVisibleCanvas(root: HTMLElement): HTMLCanvasElement | null {
  const canvases = deepQueryAll<HTMLCanvasElement>(root, 'canvas').filter(
    (c) => c.width > 0 && c.height > 0,
  );
  if (canvases.length === 0) return null;
  const visible = canvases.find((c) => c.style.visibility !== 'hidden');
  return visible ?? canvases.sort((a, b) => b.width * b.height - a.width * a.height)[0];
}

/** Pixel-accurate PNG of a canvas (no re-render — resolution = current canvas size). */
export function captureCanvasPng(canvas: HTMLCanvasElement, filename: string) {
  downloadUrl(canvas.toDataURL('image/png'), filename);
}

/** Find the nightingale navigation ruler <svg> inside a root (light or shadow DOM). */
export function findNavigationSvg(root: HTMLElement): SVGSVGElement | null {
  const svgs = deepQueryAll<SVGSVGElement>(root, 'svg');
  // The navigation ruler lives under <nightingale-navigation>; prefer one whose
  // ancestor chain includes that element, else the first non-trivial svg.
  const nav = svgs.find((s) => s.closest?.('nightingale-navigation'));
  return nav ?? svgs.find((s) => s.getBoundingClientRect().width > 50) ?? svgs[0] ?? null;
}

/** Rebuild the whole MSA grid as a NATIVE-vector SVG. Samples the rendered
 *  alignment canvas at each cell's center to get its exact on-screen color
 *  (salience grid + annotation-track marks alike) and emits one <rect> per
 *  non-blank cell, grouped per row, plus vector row labels and a ruler.
 *
 *  Requires the MSA in "Full" mode (all columns visible) so the canvas maps 1:1
 *  to alignment columns. `rows` is the panel's displaySequences (same order as
 *  the on-screen rows). */
export function captureMsaVectorSvg(
  canvas: HTMLCanvasElement,
  rows: Array<{ originType?: string; name?: string; layerLabel?: string }>,
  maxLength: number,
  filename: string,
  colRange?: [number, number],
) {
  const ctx = canvas.getContext('2d');
  if (!ctx || maxLength <= 0 || rows.length === 0) return;
  const W = canvas.width;
  const H = canvas.height;
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, W, H).data;
  } catch {
    alert('Could not read the alignment canvas (tainted). SVG rebuild aborted.');
    return;
  }

  const numRows = rows.length;
  const colPx = W / maxLength; // backing pixels per column (Full mode)
  const rowPx = H / numRows;

  // 1-based master-column window to emit (defaults to all columns).
  const c0 = Math.max(0, (colRange?.[0] ?? 1) - 1);
  const c1 = Math.min(maxLength - 1, (colRange?.[1] ?? maxLength) - 1);
  const nCols = Math.max(1, c1 - c0 + 1);

  // SVG layout (logical units). Widen cells for a small window so it stays legible.
  const LABEL = 150, RULER = 28, CW = nCols > 160 ? 3 : 8, CH = 16, PAD = 8;
  const totalW = LABEL + nCols * CW + PAD;
  const totalH = RULER + numRows * CH + PAD;

  const hex = (n: number) => n.toString(16).padStart(2, '0');
  const escText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escAttr = (s: string) => escText(s).replace(/"/g, '&quot;');

  const labelFor = (seq: { originType?: string; name?: string; layerLabel?: string }) => {
    if (seq.originType === 'auxiliary') return seq.layerLabel ?? seq.name ?? '';
    if (seq.originType === 'master') return (seq.name ?? '').split('|')[0] || (seq.name ?? '');
    return seq.name ?? '';
  };

  const groups: string[] = [];
  for (let r = 0; r < numRows; r++) {
    const seq = rows[r];
    if (seq.originType === 'spacer') continue;
    const sy = Math.min(H - 1, Math.floor(r * rowPx + rowPx / 2));
    const cells: string[] = [];
    for (let c = c0; c <= c1; c++) {
      const sx = Math.min(W - 1, Math.floor(c * colPx + colPx / 2));
      const i = (sy * W + sx) * 4;
      if (data[i + 3] < 12) continue;
      const rr = data[i], gg = data[i + 1], bb = data[i + 2];
      if (rr > 248 && gg > 248 && bb > 248) continue; // blank / gap
      cells.push(`<rect x="${LABEL + (c - c0) * CW}" y="${RULER + r * CH}" width="${CW}" height="${CH}" fill="#${hex(rr)}${hex(gg)}${hex(bb)}"/>`);
    }
    const label = labelFor(seq);
    const labelTxt = label
      ? `<text x="${LABEL - 6}" y="${(RULER + r * CH + CH * 0.72).toFixed(1)}" text-anchor="end" font-size="10" fill="#374151">${escText(label)}</text>`
      : '';
    groups.push(`<g inkscape:label="${escAttr(label || `row ${r}`)}">${labelTxt}${cells.join('')}</g>`);
  }

  // Ruler ticks within the window (finer step for a small window).
  const winStart = c0 + 1, winEnd = c1 + 1;
  const step = nCols > 160 ? 50 : 10;
  const ticks: number[] = [winStart];
  for (let t = Math.ceil(winStart / step) * step; t < winEnd; t += step) {
    if (t !== winStart) ticks.push(t);
  }
  if (ticks[ticks.length - 1] !== winEnd) ticks.push(winEnd);
  const ruler = ticks
    .map((t) => {
      const x = (LABEL + (t - winStart + 0.5) * CW).toFixed(1);
      return `<line x1="${x}" y1="${RULER - 6}" x2="${x}" y2="${RULER - 1}" stroke="#9ca3af" stroke-width="1"/><text x="${x}" y="${RULER - 9}" text-anchor="middle" font-size="9" fill="#9ca3af">${t}</text>`;
    })
    .join('');

  const svg =
    `<svg viewBox="0 0 ${totalW} ${totalH}" xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" font-family="Inter, Helvetica, Arial, sans-serif">` +
    `<g inkscape:label="ruler">${ruler}</g>` +
    groups.join('') +
    `</svg>`;

  downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), filename);
}

/** Serialize an <svg> element to a standalone .svg file (true vector). */
export function captureSvg(svgEl: SVGSVGElement, filename: string) {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (!clone.getAttribute('xmlns:xlink')) clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', xml], {
    type: 'image/svg+xml;charset=utf-8',
  });
  downloadBlob(blob, filename);
}
