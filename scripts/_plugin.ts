// Shared headless Mol* plugin factory used by both bulk-render.ts and
// render-snapshot.ts so the two don't drift. Mirrors the original bulk-render
// createPlugin(): transparent background, multisample AA, stylized tubulin preset.

import gl from 'gl';
import pngjs from 'pngjs';
import jpegjs from 'jpeg-js';
import { HeadlessPluginContext } from 'molstar/lib/mol-plugin/headless-plugin-context';
import { DefaultPluginSpec } from 'molstar/lib/mol-plugin/spec';
import { Canvas3D } from 'molstar/lib/mol-canvas3d/canvas3d';
import { EnhancedTubulinSplitPreset } from '../src/components/molstar/colors/preset_structure';

export interface HeadlessPluginOptions {
  transparent?: boolean;
  multiSample?: number; // 2 | 4 | 8
}

// molstar 5.6's PluginLayout constructor calls document.addEventListener
// unguarded (mol-plugin/layout.js:198), so constructing any plugin in pure Node
// throws "document is not defined". The render path itself uses headless gl, not
// the DOM, so a minimal stub for construction/teardown is enough. No-op if a
// real DOM already exists (e.g. running under jsdom).
function makeStubEl(): any {
  const el: any = {
    style: {},
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    setAttribute() {}, removeAttribute() {}, getAttribute() { return null; },
    appendChild(c: any) { return c; },
    removeChild(c: any) { return c; },
    insertBefore(c: any) { return c; },
    addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
    focus() {}, blur() {}, click() {},
  };
  return el;
}

// molstar 5.6's headless screenshot helper builds the Canvas3D context without a
// `canvas`, but Canvas3D.create -> syncCanvasBackground unconditionally does
// Object.assign(canvas.style, ...) (mol-canvas3d/canvas3d.js:275/313), so any
// headless render throws "Cannot read properties of undefined (reading 'style')".
// Fixed upstream; until a molstar bump, inject a stub canvas when missing.
let canvas3dPatched = false;
function patchCanvas3DForHeadless() {
  if (canvas3dPatched) return;
  canvas3dPatched = true;
  const C = Canvas3D as any;
  const orig = C.create;
  C.create = function (ctx: any, props?: any, attribs?: any) {
    if (ctx && !ctx.canvas) ctx = { ...ctx, canvas: makeStubEl() };
    return orig(ctx, props, attribs);
  };
}

function setupHeadlessDom() {
  const g = globalThis as any;
  if (typeof g.document !== 'undefined') return;
  const body = makeStubEl();
  const head = makeStubEl();
  g.document = {
    body,
    head,
    documentElement: makeStubEl(),
    scrollingElement: null,
    fullscreenElement: null,
    addEventListener() {},
    removeEventListener() {},
    createElement() { return makeStubEl(); },
    createElementNS() { return makeStubEl(); },
    getElementsByTagName(tag: string) { return [tag === 'head' ? head : body]; },
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    exitFullscreen() { return Promise.resolve(); },
  };
  if (typeof g.window === 'undefined') g.window = g;
  if (typeof g.navigator === 'undefined') g.navigator = { userAgent: 'node', platform: 'node' };
  if (typeof g.addEventListener === 'undefined') g.addEventListener = function () {};
  if (typeof g.removeEventListener === 'undefined') g.removeEventListener = function () {};
  if (typeof g.devicePixelRatio === 'undefined') g.devicePixelRatio = 1;
  if (typeof g.matchMedia === 'undefined') {
    g.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  }
}

export async function createHeadlessPlugin(
  width: number,
  height: number,
  opts: HeadlessPluginOptions = {},
): Promise<HeadlessPluginContext> {
  const { transparent = true, multiSample = 4 } = opts;
  setupHeadlessDom();
  patchCanvas3DForHeadless();
  const externalModules = { gl, pngjs, 'jpeg-js': jpegjs };
  const spec = DefaultPluginSpec();

  const plugin = new HeadlessPluginContext(
    externalModules,
    spec,
    { width, height },
    {
      imagePass: {
        transparentBackground: transparent,
        cameraHelper: {
          axes: { name: 'off', params: {} },
        },
        multiSample: {
          mode: 'on',
          sampleLevel: multiSample,
        },
      },
    },
  );

  await plugin.init();
  plugin.builders.structure.representation.registerPreset(EnhancedTubulinSplitPreset);

  return plugin;
}
