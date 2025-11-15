import gl from 'gl';
import pngjs from 'pngjs';
import jpegjs from 'jpeg-js';
import { HeadlessPluginContext } from 'molstar/lib/mol-plugin/headless-plugin-context';
import { DefaultPluginSpec } from 'molstar/lib/mol-plugin/spec';
import { EnhancedTubulinSplitPreset } from '../src/components/molstar/molstar_preset_computed_residues';
import { fetchRcsbGraphQlData } from '../src/services/rcsb_graphql_service';
import { createTubulinClassificationMap } from '../src/services/gql_parser';
import * as fs from 'fs';
import * as path from 'path';
import { applyStylizedLighting } from '@/components/molstar/colors/stylized-lighting';
import { STYLIZED_POSTPROCESSING } from '@/components/molstar/rendering/postprocessing-config';
import { PluginStateObject } from 'molstar/lib/mol-plugin-state/objects';
import { changeCameraRotation, structureLayingTransform } from 'molstar/lib/mol-plugin-state/manager/focus-camera/orient-axes';

async function renderStructure(
    plugin: HeadlessPluginContext,
    pdbId: string,
    outputPath: string
) {
    console.log(`\n🔄 Processing ${pdbId}...`);

    try {
        // Fetch GraphQL data from RCSB
        console.log(`  📡 Fetching GraphQL data from RCSB...`);
        const gqlData = await fetchRcsbGraphQlData(pdbId);

        // Parse tubulin classification
        console.log(`  🧬 Parsing tubulin classification...`);
        const tubulinClassification = createTubulinClassificationMap(gqlData);

        if (Object.keys(tubulinClassification).length === 0) {
            console.warn(`  ⚠️  No tubulin chains found in ${pdbId}`);
        }

        // Download structure
        console.log(`  ⬇️  Downloading structure file...`);
        const data = await plugin.builders.data.download({
            url: `https://files.rcsb.org/download/${pdbId}.cif`,
            isBinary: false
        });

        // Parse structure
        console.log(`  🔬 Parsing structure...`);
        const trajectory = await plugin.builders.structure.parseTrajectory(data, 'mmcif');
        const model = await plugin.builders.structure.createModel(trajectory);
        const structure = await plugin.builders.structure.createStructure(model);

        // Apply your custom preset
        console.log(`  🎨 Applying tubulin preset...`);
        await plugin.builders.structure.representation.applyPreset(
            structure,
            'tubulin-split-preset-computed-res',
            {
                pdbId: pdbId,
                tubulinClassification: tubulinClassification,
                computedResidues: []
            }
        );
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


        // Set ignoreLight (this is important!)
        console.log(`  💡 Configuring lighting...`);
        plugin.managers.structure.component.setOptions({
            ...plugin.managers.structure.component.state.options,
            ignoreLight: true
        });

        // Ensure output directory exists
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });


        // Calculate optimal camera orientation  
        const structCells = plugin.state.data.selectQ(q =>
            q.ofType(PluginStateObject.Molecule.Structure)
        );
        const structures = structCells
            .filter(cell => cell.obj && !cell.obj.data.parent)
            .map(cell => cell.obj!.data);

        if (structures.length > 0 && plugin.canvas3d) {
            // Get PCA-based rotation  
            const { rotation } = structureLayingTransform(structures);

            // Get current camera snapshot and apply rotation  
            const currentSnapshot = plugin.canvas3d.camera.getSnapshot();
            const newSnapshot = changeCameraRotation(currentSnapshot, rotation);

            // Apply immediately (synchronous)  
            plugin.canvas3d.camera.setState(newSnapshot);
        }

        // Now render  
        await plugin.saveImage(outputPath, { width: 1920, height: 1080 }, STYLIZED_POSTPROCESSING);

        console.log(`  ✅ Saved ${pdbId} to ${outputPath}`);
        await plugin.clear();

        return true;

    } catch (error) {
        console.error(`  ❌ Failed to render ${pdbId}:`, error);
        return false;
    }
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error('Usage: npm run render <pdb_id1> [pdb_id2] [pdb_id3] ...');
        console.error('   or: npm run render --list pdb_list.txt');
        console.error('\nExamples:');
        console.error('  npm run render 1JFF 6WVR 4O2B');
        console.error('  npm run render --list structures.txt');
        process.exit(1);
    }

    let pdbIds: string[];

    if (args[0] === '--list' && args[1]) {
        // Read from file
        const fileContent = fs.readFileSync(args[1], 'utf-8');
        pdbIds = fileContent
            .split('\n')
            .map(id => id.trim().toUpperCase())
            .filter(id => id.length === 4);
        console.log(`📋 Loaded ${pdbIds.length} PDB IDs from ${args[1]}`);
    } else {
        pdbIds = args.map(id => id.toUpperCase());
    }

    if (pdbIds.length === 0) {
        console.error('❌ No valid PDB IDs provided');
        process.exit(1);
    }

    console.log(`\n🚀 Starting bulk render for ${pdbIds.length} structure(s)...\n`);

    // Initialize headless plugin
    const externalModules = { gl, pngjs, 'jpeg-js': jpegjs };
    const spec = DefaultPluginSpec();
    const plugin = new HeadlessPluginContext(
        externalModules,
        spec,
        { width: 1920, height: 1080 }
    );

    await plugin.init();

    // Register your custom preset
    plugin.builders.structure.representation.registerPreset(EnhancedTubulinSplitPreset);

    // Track results
    let successful = 0;
    let failed = 0;

    // Process each structure
    for (let i = 0; i < pdbIds.length; i++) {
        const pdbId = pdbIds[i];
        console.log(`\n[${i + 1}/${pdbIds.length}] ${pdbId}`);

        const success = await renderStructure(plugin, pdbId, `./output/${pdbId}.png`);

        if (success) {
            successful++;
        } else {
            failed++;
        }
    }

    plugin.dispose();

    console.log('\n' + '='.repeat(50));
    console.log(`✨ Bulk render complete!`);
    console.log(`   ✅ Successful: ${successful}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📁 Output directory: ./output/`);
    console.log('='.repeat(50) + '\n');
}

main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});