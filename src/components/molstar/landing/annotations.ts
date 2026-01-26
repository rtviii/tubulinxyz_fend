import {StateTransforms} from 'molstar/lib/mol-plugin-state/transforms';
import {createStructureRepresentationParams} from 'molstar/lib/mol-plugin-state/helpers/structure-representation-params';
import {Color} from 'molstar/lib/mol-util/color';
import {MolScriptBuilder as MS} from 'molstar/lib/mol-script/language/builder';
import type {MolstarViewer} from '@/components/molstar/core/MolstarViewer';
import {PluginCommands} from 'molstar/lib/mol-plugin/commands';

// Build an expression from (chain, auth_seq_id) pairs
export function residueListExpr(residues: Array<[string, number]>) {
    const groups = residues.map(([chain, resi]) =>
        MS.struct.generator.atomGroups({
            'chain-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), chain]),
            'residue-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_seq_id(), resi])
        })
    );
    return MS.struct.combinator.merge(groups);
}

// Example: attach a “site” selection+rep under annotations_group
export async function addAnnotationSite(
    ctx: MolstarViewer,
    opts: {ref: string; label: string; residues: Array<[string, number]>; color?: number}
) {
    const color = Color(opts.color ?? 0xe24e1b);

    await ctx.plugin.dataTransaction(async () => {
        const update = ctx.plugin.build();

        const group = update.to('annotations_group');
        const selection = group.apply(
            StateTransforms.Model.StructureSelectionFromExpression,
            {expression: residueListExpr(opts.residues)},
            {ref: opts.ref}
        );

        // Use the currently loaded structure data for params
        const structureData = ctx.plugin.managers.structure.hierarchy.current.structures[0]?.cell.obj?.data;

        selection.apply(
            StateTransforms.Representation.StructureRepresentation3D,
            createStructureRepresentationParams(ctx.plugin, structureData, {
                type: 'ball-and-stick',
                color: 'uniform',
                colorParams: {value: color},
                typeParams: {emissive: 0.15}
            })
        );

        await PluginCommands.State.Update(ctx.plugin, {state: ctx.plugin.state.data, tree: update});
    });
}
