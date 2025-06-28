'use client'
import { DefaultPluginUISpec, PluginUISpec } from "molstar/lib/mol-plugin-ui/spec";
import './mstar.css'
import "molstar/lib/mol-plugin-ui/skin/light.scss";
import { PluginConfig } from 'molstar/lib/mol-plugin/config';
import { StructureComponentControls } from 'molstar/lib/mol-plugin-ui/structure/components';
import { StructureSourceControls } from 'molstar/lib/mol-plugin-ui/structure/source';
import { StructureQuickStylesControls } from 'molstar/lib/mol-plugin-ui/structure/quick-styles';
import { VolumeStreamingControls, VolumeSourceControls } from 'molstar/lib/mol-plugin-ui/structure/volume'
import { PluginUIComponent } from 'molstar/lib/mol-plugin-ui/base';
import { BuildSvg, Icon } from 'molstar/lib/mol-plugin-ui/controls/icons';
import { PluginBehaviors } from 'molstar/lib/mol-plugin/behavior'
import React, { forwardRef } from "react";
import { PluginSpec } from "molstar/lib/mol-plugin/spec";
import { StateTransforms } from "molstar/lib/mol-plugin-state/transforms";
import { BoxifyVolumeStreaming, CreateVolumeStreamingBehavior, InitVolumeStreaming } from "molstar/lib/mol-plugin/behavior/dynamic/volume-streaming/transformers";
import { StateActions } from 'molstar/lib/mol-plugin-state/actions'
import { BuiltInTrajectoryFormat } from "molstar/lib/mol-plugin-state/formats/trajectory";
import { StructureProperties } from "molstar/lib/mol-model/structure/structure/properties";
import { Queries, QueryContext, StructureQuery, StructureSelection } from "molstar/lib/mol-model/structure/query";
import { ModelExportUI } from 'molstar/lib/extensions/model-export/ui';
import { Expression } from 'molstar/lib/mol-script/language/expression';
import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";
import { Asset } from 'molstar/lib/mol-util/assets';
import { compile } from "molstar/lib/mol-script/runtime/query/compiler";


export class CustomStructureTools extends PluginUIComponent {
  render() {
    return <>
      <div className='msp-section-header'>
        <Icon svg={BuildSvg} /> Structure Tools</div>
      <StructureSourceControls />
      <StructureComponentControls />
      <VolumeStreamingControls />
      <VolumeSourceControls />
      <ModelExportUI />
      <StructureQuickStylesControls />
    </>;
  }
}
export const ribxzSpec: PluginUISpec = {
  ...DefaultPluginUISpec(),
  behaviors: [
    PluginSpec.Behavior(PluginBehaviors.Representation.HighlightLoci, { mark: true }),
    PluginSpec.Behavior(PluginBehaviors.Representation.DefaultLociLabelProvider),
    PluginSpec.Behavior(PluginBehaviors.Camera.FocusLoci),
    PluginSpec.Behavior(PluginBehaviors.Representation.FocusLoci),
    // PluginSpec.Behavior(PluginBehaviors.CustomProps.Interactions),
    PluginSpec.Behavior(PluginBehaviors.Representation.HighlightLoci),
    PluginSpec.Behavior(PluginBehaviors.Representation.SelectLoci),
    PluginSpec.Behavior(PluginBehaviors.Representation.FocusLoci),
    PluginSpec.Behavior(PluginBehaviors.Camera.FocusLoci),
    PluginSpec.Behavior(PluginBehaviors.Camera.CameraAxisHelper),

    PluginSpec.Behavior(PluginBehaviors.CustomProps.StructureInfo),
    // PluginSpec.Behavior(PluginBehaviors.CustomProps.AccessibleSurfaceArea),
    PluginSpec.Behavior(PluginBehaviors.CustomProps.Interactions),
    PluginSpec.Behavior(PluginBehaviors.CustomProps.SecondaryStructure),
    PluginSpec.Behavior(PluginBehaviors.CustomProps.ValenceModel),
    PluginSpec.Behavior(PluginBehaviors.CustomProps.CrossLinkRestraint),

  ],
  config: [
    [PluginConfig.VolumeStreaming.Enabled, true],
    [PluginConfig.Viewport.ShowSelectionMode, true],
    [PluginConfig.Viewport.ShowSettings, true],
    [PluginConfig.Viewport.ShowAnimation, true],
    [PluginConfig.Viewport.ShowTrajectoryControls, true],

  ],
  actions: [
    PluginSpec.Action(StateActions.Structure.DownloadStructure),
    PluginSpec.Action(StateActions.Volume.DownloadDensity),
    PluginSpec.Action(StateActions.DataFormat.DownloadFile),
    PluginSpec.Action(StateActions.DataFormat.OpenFiles),
    PluginSpec.Action(StateActions.Structure.LoadTrajectory),
    PluginSpec.Action(StateActions.Structure.EnableModelCustomProps),
    PluginSpec.Action(StateActions.Structure.EnableStructureCustomProps),


    PluginSpec.Action(StateTransforms.Data.Download),
    PluginSpec.Action(StateTransforms.Data.ParseCif),
    PluginSpec.Action(StateTransforms.Data.ParseCcp4),
    PluginSpec.Action(StateTransforms.Data.ParseDsn6),

    PluginSpec.Action(StateTransforms.Model.TrajectoryFromMmCif),
    PluginSpec.Action(StateTransforms.Model.TrajectoryFromCifCore),
    PluginSpec.Action(StateTransforms.Model.TrajectoryFromPDB),
    PluginSpec.Action(StateTransforms.Model.TransformStructureConformation),
    PluginSpec.Action(StateTransforms.Model.StructureFromModel),
    PluginSpec.Action(StateTransforms.Model.StructureFromTrajectory),
    PluginSpec.Action(StateTransforms.Model.ModelFromTrajectory),
    PluginSpec.Action(StateTransforms.Model.StructureSelectionFromScript),

    PluginSpec.Action(StateTransforms.Representation.StructureRepresentation3D),
    PluginSpec.Action(StateTransforms.Representation.StructureSelectionsDistance3D),
    PluginSpec.Action(StateTransforms.Representation.StructureSelectionsAngle3D),
    PluginSpec.Action(StateTransforms.Representation.StructureSelectionsDihedral3D),
    PluginSpec.Action(StateTransforms.Representation.StructureSelectionsLabel3D),
    PluginSpec.Action(StateTransforms.Representation.StructureSelectionsOrientation3D),
    PluginSpec.Action(StateTransforms.Representation.ModelUnitcell3D),
    PluginSpec.Action(StateTransforms.Representation.StructureBoundingBox3D),
    PluginSpec.Action(StateTransforms.Representation.ExplodeStructureRepresentation3D),
    PluginSpec.Action(StateTransforms.Representation.SpinStructureRepresentation3D),
    PluginSpec.Action(StateTransforms.Representation.UnwindStructureAssemblyRepresentation3D),
    PluginSpec.Action(StateTransforms.Representation.OverpaintStructureRepresentation3DFromScript),
    PluginSpec.Action(StateTransforms.Representation.TransparencyStructureRepresentation3DFromScript),
    PluginSpec.Action(StateTransforms.Representation.ClippingStructureRepresentation3DFromScript),
    PluginSpec.Action(StateTransforms.Representation.SubstanceStructureRepresentation3DFromScript),
    PluginSpec.Action(StateTransforms.Representation.ThemeStrengthRepresentation3D),

    // PluginSpec.Action(AssignColorVolume),
    PluginSpec.Action(StateTransforms.Volume.VolumeFromCcp4),
    PluginSpec.Action(StateTransforms.Volume.VolumeFromDsn6),
    PluginSpec.Action(StateTransforms.Volume.VolumeFromCube),
    PluginSpec.Action(StateTransforms.Volume.VolumeFromDx),
    PluginSpec.Action(StateTransforms.Representation.VolumeRepresentation3D),

  ],
  layout: {
    initial: {
      controlsDisplay: 'portrait',
      showControls: false,
      isExpanded: false,
    },
  },

  components: {
    structureTools: CustomStructureTools,
    controls: {
      bottom: 'none',
      // left:'none'
    },
    remoteState: 'none',

  },

}

// Your MolstarNode component remains the same
export const MolstarNode = React.forwardRef<HTMLDivElement>((props, ref) => {
  return (
    <div
      ref={ref}
      className="w-full h-full"
      style={{ position: 'relative' }}
    />
  );
});
MolstarNode.displayName = 'MolstarNode';