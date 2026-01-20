import React, { forwardRef } from 'react';
import { DefaultPluginUISpec, PluginUISpec } from "molstar/lib/mol-plugin-ui/spec";
import { PluginConfig } from 'molstar/lib/mol-plugin/config';
import { PluginBehaviors } from 'molstar/lib/mol-plugin/behavior';
import { PluginSpec } from "molstar/lib/mol-plugin/spec";
import { StateTransforms } from "molstar/lib/mol-plugin-state/transforms";
import { StateActions } from 'molstar/lib/mol-plugin-state/actions';

import './mstar.css';
import "molstar/lib/mol-plugin-ui/skin/light.scss";

export const ribxzSpec: PluginUISpec = {
  ...DefaultPluginUISpec(),
  behaviors: [
    PluginSpec.Behavior(PluginBehaviors.Representation.HighlightLoci, { mark: true }),
    PluginSpec.Behavior(PluginBehaviors.Representation.DefaultLociLabelProvider),
    PluginSpec.Behavior(PluginBehaviors.Camera.FocusLoci),
    PluginSpec.Behavior(PluginBehaviors.Representation.FocusLoci),
    PluginSpec.Behavior(PluginBehaviors.Representation.HighlightLoci),
    PluginSpec.Behavior(PluginBehaviors.Representation.SelectLoci),
    PluginSpec.Behavior(PluginBehaviors.Camera.CameraAxisHelper),
    PluginSpec.Behavior(PluginBehaviors.CustomProps.StructureInfo),
    PluginSpec.Behavior(PluginBehaviors.CustomProps.Interactions),
    PluginSpec.Behavior(PluginBehaviors.CustomProps.SecondaryStructure),
    PluginSpec.Behavior(PluginBehaviors.CustomProps.ValenceModel),
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
    PluginSpec.Action(StateActions.DataFormat.DownloadFile),
    PluginSpec.Action(StateActions.DataFormat.OpenFiles),
    PluginSpec.Action(StateTransforms.Data.Download),
    PluginSpec.Action(StateTransforms.Data.ParseCif),
    PluginSpec.Action(StateTransforms.Model.TrajectoryFromMmCif),
    PluginSpec.Action(StateTransforms.Model.StructureFromModel),
    PluginSpec.Action(StateTransforms.Model.ModelFromTrajectory),
    PluginSpec.Action(StateTransforms.Representation.StructureRepresentation3D),
  ],
  layout: {
    initial: {
      controlsDisplay: 'portrait',
      showControls: false,
      isExpanded: false,
    },
  },
  components: {
    controls: {
      bottom: 'none',
    },
    remoteState: 'none',
  },
};

// Container component for Molstar viewer
export const MolstarNode = forwardRef<HTMLDivElement>((props, ref) => {
  return (
    <div
      ref={ref}
      className="w-full h-full"
      style={{ position: 'relative' }}
    />
  );
});
MolstarNode.displayName = 'MolstarNode';