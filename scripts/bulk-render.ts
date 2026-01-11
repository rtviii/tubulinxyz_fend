import gl from 'gl';
import pngjs from 'pngjs';
import jpegjs from 'jpeg-js';
import { HeadlessPluginContext } from 'molstar/lib/mol-plugin/headless-plugin-context';
import { DefaultPluginSpec } from 'molstar/lib/mol-plugin/spec';
import { EnhancedTubulinSplitPreset } from '../src/components/molstar/molstar_preset_computed_residues';
import * as fs from 'fs';
import * as path from 'path';
import { STYLIZED_POSTPROCESSING } from '@/components/molstar/rendering/postprocessing-config';
import { PluginStateObject } from 'molstar/lib/mol-plugin-state/objects';
import { structureLayingTransform, changeCameraRotation } from 'molstar/lib/mol-plugin-state/manager/focus-camera/orient-axes';

// ============================================================
// CONFIGURATION - Adjust these as needed
// ============================================================

const CONFIG = {
    // Image dimensions
    IMAGE_WIDTH: 1920,
    IMAGE_HEIGHT: 1080,

    // Rendering settings
    TRANSPARENT_BACKGROUND: true,
    MULTISAMPLE_LEVEL: 4,  // Anti-aliasing quality (2, 4, or 8)

    // Performance
    DEFAULT_CONCURRENCY: 4,

    // Output
    DEFAULT_OUTPUT_DIR: './output',
    IMAGE_FORMAT: 'png' as const,  // 'png' or 'jpeg'
    JPEG_QUALITY: 90,  // Only used if format is 'jpeg'
} as const;

// ============================================================

interface RenderResult {
    pdbId: string;
    success: boolean;
    error?: string;
    duration: number;
}

async function createPlugin(): Promise<HeadlessPluginContext> {
    const externalModules = { gl, pngjs, 'jpeg-js': jpegjs };
    const spec = DefaultPluginSpec();

    const plugin = new HeadlessPluginContext(
        externalModules,
        spec,
        {
            width: CONFIG.IMAGE_WIDTH,
            height: CONFIG.IMAGE_HEIGHT
        },
        {
            // Configure transparent background and quality settings
            imagePass: {
                transparentBackground: CONFIG.TRANSPARENT_BACKGROUND,
                cameraHelper: {
                    axes: { name: 'off', params: {} },
                },
                multiSample: {
                    mode: 'on',
                    sampleLevel: CONFIG.MULTISAMPLE_LEVEL,
                }
            }
        }
    );

    await plugin.init();
    plugin.builders.structure.representation.registerPreset(EnhancedTubulinSplitPreset);

    return plugin;
}

async function renderStructure(
    plugin: HeadlessPluginContext,
    pdbId: string,
    outputPath: string
): Promise<RenderResult> {
    const startTime = Date.now();

    try {
        // Fetch GraphQL data from RCSB
        console.log(`[Backend] Fetching profile for ${pdbId}...`);
        const backendUrl = `http://localhost:8000/structures/${pdbId}/profile`;

        const response = await fetch(backendUrl);
        if (!response.ok) {
            throw new Error(`Backend fetch failed: ${response.status} ${response.statusText}`);
        }

        const profileData = await response.json();

        // Use your existing helper to convert the backend profile into 
        // the map format required by the Mol* Preset
        const { createClassificationFromProfile } = await import('../src/services/profile_service');
        const tubulinClassification = createClassificationFromProfile(profileData);

        if (Object.keys(tubulinClassification).length === 0) {
            console.warn(`  ⚠️  ${pdbId}: No tubulin chains found in backend profile`);
        }
        // ---------------------------------------------------------------

        // Download and parse structure (using standard RCSB CIF as fallback or your local source)
        const data = await plugin.builders.data.download({
            url: `https://files.rcsb.org/download/${pdbId}.cif`,
            isBinary: false
        });

        const trajectory = await plugin.builders.structure.parseTrajectory(data, 'mmcif');
        const model = await plugin.builders.structure.createModel(trajectory);
        const structure = await plugin.builders.structure.createStructure(model);

        // Apply preset with vibrant colors and backend classification
        await plugin.builders.structure.representation.applyPreset(
            structure,
            'tubulin-split-preset-computed-res',
            {
                pdbId: pdbId,
                tubulinClassification: tubulinClassification,
                computedResidues: [] // Pass empty or fetch from backend if available
            }
        );

        // Set ignoreLight on all representations
        const update = plugin.state.data.build();
        const representations = plugin.state.data.selectQ(q =>
            q.ofType(PluginStateObject.Molecule.Structure.Representation3D)
        );

        for (const repr of representations) {
            update.to(repr).update(old => {
                if (old.type?.params) {
                    old.type.params.ignoreLight = true;
                }
            });
        }

        await update.commit();

        // Set ignoreLight on manager
        plugin.managers.structure.component.setOptions({
            ...plugin.managers.structure.component.state.options,
            ignoreLight: true
        });

        // Optimize camera orientation
        const structCells = plugin.state.data.selectQ(q =>
            q.ofType(PluginStateObject.Molecule.Structure)
        );
        const structures = structCells
            .filter(cell => cell.obj && !cell.obj.data.parent)
            .map(cell => cell.obj!.data);

        if (structures.length > 0 && plugin.canvas3d) {
            const { rotation } = structureLayingTransform(structures);
            const currentSnapshot = plugin.canvas3d.camera.getSnapshot();
            const newSnapshot = changeCameraRotation(currentSnapshot, rotation);
            plugin.canvas3d.camera.setState(newSnapshot);
        }

        // Ensure output directory exists
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });

        // Render and save with configured settings
        await plugin.saveImage(
            outputPath,
            {
                width: CONFIG.IMAGE_WIDTH,
                height: CONFIG.IMAGE_HEIGHT
            },
            STYLIZED_POSTPROCESSING,
            CONFIG.IMAGE_FORMAT,
            CONFIG.JPEG_QUALITY
        );

        // Clear for next structure
        await plugin.clear();

        const duration = Date.now() - startTime;
        return { pdbId, success: true, duration };

    } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { pdbId, success: false, error: errorMessage, duration };
    }
}

async function processQueue(
    pdbIds: string[],
    concurrency: number,
    outputDir: string
): Promise<RenderResult[]> {
    const results: RenderResult[] = [];
    const total = pdbIds.length;
    let completed = 0;

    // Create a queue of tasks
    const queue = [...pdbIds];

    // Worker function
    const worker = async (workerId: number): Promise<void> => {
        // Each worker gets its own plugin instance
        const plugin = await createPlugin();

        try {
            while (queue.length > 0) {
                const pdbId = queue.shift();
                if (!pdbId) break;

                const outputPath = path.join(outputDir, `${pdbId}.${CONFIG.IMAGE_FORMAT}`);

                console.log(`[Worker ${workerId}] Processing ${pdbId} (${completed + 1}/${total})...`);

                const result = await renderStructure(plugin, pdbId, outputPath);
                results.push(result);
                completed++;

                if (result.success) {
                    console.log(`[Worker ${workerId}] ✅ ${pdbId} (${(result.duration / 1000).toFixed(1)}s)`);
                } else {
                    console.error(`[Worker ${workerId}] ❌ ${pdbId}: ${result.error}`);
                }
            }
        } finally {
            // Clean up plugin
            plugin.dispose();
        }
    };

    // Start workers
    const workers = Array.from({ length: concurrency }, (_, i) => worker(i + 1));
    await Promise.all(workers);

    return results;
}

async function main() {
    const args = process.argv.slice(2);

    // Parse arguments
    let pdbIds: string[] = [];
    let concurrency = CONFIG.DEFAULT_CONCURRENCY;
    let outputDir = CONFIG.DEFAULT_OUTPUT_DIR;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--list' && args[i + 1]) {
            const fileContent = fs.readFileSync(args[i + 1], 'utf-8');
            pdbIds = fileContent
                .split('\n')
                .map(id => id.trim().toUpperCase())
                .filter(id => id.length === 4);
            i++;
        } else if (args[i] === '--concurrency' && args[i + 1]) {
            concurrency = parseInt(args[i + 1], 10);
            i++;
        } else if (args[i] === '--output' && args[i + 1]) {
            outputDir = args[i + 1];
            i++;
        } else if (args[i].length === 4) {
            pdbIds.push(args[i].toUpperCase());
        }
    }

    if (pdbIds.length === 0) {
        console.error('Usage: npm run render [options] <pdb_id1> [pdb_id2] ...');
        console.error('');
        console.error('Options:');
        console.error('  --list <file>         Read PDB IDs from file (one per line)');
        console.error('  --concurrency <n>     Number of parallel renders (default: 4)');
        console.error('  --output <dir>        Output directory (default: ./output)');
        console.error('');
        console.error('Examples:');
        console.error('  npm run render 1JFF 6WVR 4O2B');
        console.error('  npm run render --list structures.txt --concurrency 8');
        console.error('  npm run render --list structures.txt --output ./images --concurrency 4');
        console.error('');
        console.error('Current configuration:');
        console.error(`  Resolution: ${CONFIG.IMAGE_WIDTH}x${CONFIG.IMAGE_HEIGHT}`);
        console.error(`  Transparent background: ${CONFIG.TRANSPARENT_BACKGROUND}`);
        console.error(`  Multisample level: ${CONFIG.MULTISAMPLE_LEVEL}`);
        console.error(`  Format: ${CONFIG.IMAGE_FORMAT}`);
        process.exit(1);
    }

    console.log('\n' + '='.repeat(60));
    console.log(`🚀 Bulk Renderer`);
    console.log(`   Structures: ${pdbIds.length}`);
    console.log(`   Concurrency: ${concurrency}`);
    console.log(`   Resolution: ${CONFIG.IMAGE_WIDTH}x${CONFIG.IMAGE_HEIGHT}`);
    console.log(`   Transparent: ${CONFIG.TRANSPARENT_BACKGROUND}`);
    console.log(`   Format: ${CONFIG.IMAGE_FORMAT}`);
    console.log(`   Output: ${outputDir}`);
    console.log('='.repeat(60) + '\n');

    const startTime = Date.now();

    // Process with parallelization
    const results = await processQueue(pdbIds, concurrency, outputDir);

    const totalTime = (Date.now() - startTime) / 1000;
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const avgTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length / 1000;

    console.log('\n' + '='.repeat(60));
    console.log(`✨ Complete!`);
    console.log(`   ✅ Successful: ${successful}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⏱️  Total time: ${totalTime.toFixed(1)}s`);
    console.log(`   📊 Avg per structure: ${avgTime.toFixed(1)}s`);
    console.log(`   📁 Output: ${path.resolve(outputDir)}`);
    console.log('='.repeat(60) + '\n');

    if (failed > 0) {
        console.log('Failed structures:');
        results.filter(r => !r.success).forEach(r => {
            console.log(`  - ${r.pdbId}: ${r.error}`);
        });
    }
}

main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});