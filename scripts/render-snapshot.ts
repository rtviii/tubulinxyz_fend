// Render a Mol* state snapshot (.molj exported from the browser viewer) to a
// high-res PNG/JPEG with transparent background — the "exact pose" pipeline.
//
//   yarn render:snapshot path/to/view.molj [--output ./output] \
//        [--width 3840] [--height 2160] [--format png|jpeg] [--rewrite-api URL]
//
// The browser button ("Export .molj" on the structure viewer in dev mode)
// produces the input. The .molj is plain JSON (the StateSnapshot from
// plugin.managers.snapshot.serialize({ type: 'molj' })); we parse it and apply
// it with setStateSnapshot, which restores camera + components + coloring.
//
// If the structure fails to load headlessly, the .molj's data-source URL likely
// points at the dev "/api" proxy — pass --rewrite-api http://localhost:8000
// (or an absolute RCSB url root) to rewrite those source URLs before applying.

import * as fs from 'fs';
import * as path from 'path';
import { STYLIZED_POSTPROCESSING } from '@/components/molstar/rendering/postprocessing-config';
import { PluginStateObject } from 'molstar/lib/mol-plugin-state/objects';
import { createHeadlessPlugin } from './_plugin';

interface Opts {
  input: string;
  output: string;
  width: number;
  height: number;
  format: 'png' | 'jpeg';
  rewriteApi?: string;
  resetCamera: boolean;
  keepCamera: boolean;
  quality: number;
}

function parseArgs(): Opts {
  const args = process.argv.slice(2);
  const o: Opts = { input: '', output: './output', width: 3840, height: 2160, format: 'png', resetCamera: false, keepCamera: false, quality: 90 };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--output') o.output = args[++i];
    else if (a === '--width') o.width = parseInt(args[++i], 10);
    else if (a === '--height') o.height = parseInt(args[++i], 10);
    else if (a === '--format') o.format = args[++i] as 'png' | 'jpeg';
    else if (a === '--rewrite-api') o.rewriteApi = args[++i];
    else if (a === '--reset-camera') o.resetCamera = true;
    else if (a === '--keep-camera') o.keepCamera = true;
    else if (!a.startsWith('--') && !o.input) o.input = a;
  }
  return o;
}

async function main() {
  const opts = parseArgs();
  if (!opts.input) {
    console.error(
      'Usage: yarn render:snapshot <view.molj> [--output dir] [--width N] [--height N] [--format png|jpeg] [--rewrite-api URL]',
    );
    process.exit(1);
  }
  if (!fs.existsSync(opts.input)) {
    console.error(`Snapshot not found: ${opts.input}`);
    process.exit(1);
  }

  let raw = fs.readFileSync(opts.input, 'utf-8');
  if (opts.rewriteApi) {
    raw = raw.split('"/api/').join(`"${opts.rewriteApi.replace(/\/$/, '')}/`);
  }

  // Diagnostics: what data sources does this snapshot reference?
  const urls = Array.from(new Set((raw.match(/https?:\/\/[^"'\\ ]+/g) ?? []))).slice(0, 10);
  console.log('Data sources referenced in snapshot:', urls.length ? urls : '(none — data may be relative or embedded)');

  const snapshot = JSON.parse(raw);

  console.log(`Rendering ${opts.input} -> ${opts.width}x${opts.height} ${opts.format} (transparent)`);
  const plugin = await createHeadlessPlugin(opts.width, opts.height, { transparent: true, multiSample: 4 });
  try {
    await plugin.managers.snapshot.setStateSnapshot(snapshot).catch((e: any) => {
      console.error('setStateSnapshot error:', e?.message ?? e);
    });

    // Poll until the structure(s) materialize — async downloads/parses may not be
    // done when setStateSnapshot resolves. Empty after timeout => data didn't load.
    const countStructures = () =>
      plugin.state.data
        .selectQ((q) => q.ofType(PluginStateObject.Molecule.Structure))
        .filter((c) => c.obj && !c.obj.data.parent).length;
    let nStruct = 0;
    for (let i = 0; i < 40; i++) {
      nStruct = countStructures();
      if (nStruct > 0) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    const nRepr = plugin.state.data.selectQ((q) =>
      q.ofType(PluginStateObject.Molecule.Structure.Representation3D),
    ).length;
    console.log(`Loaded: ${nStruct} structure(s), ${nRepr} representation(s).`);
    if (nStruct === 0) {
      console.warn(
        'WARNING: no structure in the scene — output will be empty. The snapshot data source failed to fetch/parse headlessly. Share the .molj for inspection.',
      );
    }

    // Camera handling. A browser-saved camera often does not frame the structure
    // in a headless render at a different resolution/aspect (=> empty image).
    // Default: keep the snapshot's ORIENTATION (your angle) but refit the
    // distance/target to the structure's bounding sphere, so it's always framed.
    //   --keep-camera : use the snapshot camera verbatim (no refit)
    //   --reset-camera: full reset to molstar's default orientation
    if (plugin.canvas3d) {
      plugin.canvas3d.commit(true); // populate boundingSphere from loaded structures
      if (opts.resetCamera) {
        plugin.canvas3d.requestCameraReset();
      } else if (!opts.keepCamera) {
        const sph: any = plugin.canvas3d.boundingSphere;
        if (sph && sph.radius > 0) {
          plugin.canvas3d.camera.focus(sph.center, sph.radius, 0); // keeps current dir/up
          console.log(`Refit camera to structure (radius ${sph.radius.toFixed(1)}), orientation preserved.`);
        }
      }
      plugin.canvas3d.commit(true);
      await new Promise((r) => setTimeout(r, 150));
    }

    const base = path.basename(opts.input).replace(/\.molj$/i, '');
    const outPath = path.join(opts.output, `${base}.${opts.format}`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await plugin.saveImage(
      outPath,
      { width: opts.width, height: opts.height },
      STYLIZED_POSTPROCESSING,
      opts.format,
      opts.quality,
    );
    console.log(`Saved ${path.resolve(outPath)}`);
  } finally {
    plugin.dispose();
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
