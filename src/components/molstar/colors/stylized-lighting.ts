import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { Color } from 'molstar/lib/mol-util/color';
import { STYLIZED_POSTPROCESSING } from '../rendering/postprocessing-config';

/**
 * Applies stylized lighting to the Molstar viewer.
 * This ensures consistent rendering across frontend and headless rendering.
 */
export async function applyStylizedLighting(plugin: PluginContext) {
    // Set ignoreLight on structure component
    plugin.managers.structure.component.setOptions({
        ...plugin.managers.structure.component.state.options,
        ignoreLight: true
    });

    // Apply postprocessing effects
    if (plugin.canvas3d) {
        plugin.canvas3d.setProps({
            postprocessing: STYLIZED_POSTPROCESSING
        });
    }
}