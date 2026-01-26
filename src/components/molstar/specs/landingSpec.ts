import { DefaultPluginUISpec } from 'molstar/lib/mol-plugin-ui/spec';
import type { PluginUISpec } from 'molstar/lib/mol-plugin-ui/spec';
import { PluginConfig } from 'molstar/lib/mol-plugin/config';

export const landingSpec = {
  ...DefaultPluginUISpec(),
  actions: [],
  config: [
    [PluginConfig.Viewport.ShowControls, false],
    [PluginConfig.Viewport.ShowAnimation, false],   // 👈 animation button
    [PluginConfig.Viewport.ShowSettings, false],
   [PluginConfig.Viewport.ShowAnimation, false],  

    [PluginConfig.Viewport.ShowControls, false],  
    [PluginConfig.Viewport.ShowSettings, false],  
    [PluginConfig.Viewport.ShowScreenshotControls, false],  
    [PluginConfig.Viewport.ShowReset, false],  
    [PluginConfig.Viewport.ShowExpand, false],  
    [PluginConfig.Viewport.ShowSelectionMode, false],  
    [PluginConfig.Viewport.ShowTrajectoryControls, false], 
    // Hide the animate button  
    ['viewer.show-animation-button', false],  
    // Also hide other viewport controls if needed  
    ['viewer.show-controls-button', false],  
    ['viewer.show-settings-button', false],  
    ['viewer.show-screenshot-controls', false],  
    ['viewer.show-reset-button', false],  
    ['viewer.show-expand-button', false],  
    ['viewer.show-selection-model-button', false],  
    ['viewer.show-trajectory-controls', false],  
    ['viewer.show-animation-button', false],  
    [PluginConfig.Viewport.ShowScreenshotControls, false],
    [PluginConfig.Viewport.ShowReset, false],
    [PluginConfig.Viewport.ShowExpand, false],
    [PluginConfig.Viewport.ShowSelectionMode, false],
    [PluginConfig.Viewport.ShowTrajectoryControls, false],
    [PluginConfig.Viewport.ShowIllumination, false], // 👈 THIS ONE MATTERS
    [PluginConfig.Viewport.ShowToggleFullscreen, false],
    [PluginConfig.Viewport.ShowXR, 'never'],
  ],
  components: {
    ...DefaultPluginUISpec().components,
    controls: {
      left: 'none',
      right: 'none',
      top: 'none',
      bottom: 'none',
    },
    remoteState: 'none',
    disableDragOverlay: true,
    hideTaskOverlay: true,
  },
  layout: {
    initial: {
      showControls: false,
      isExpanded: false,
      regionState: {
        left: 'hidden',
        right: 'hidden',
        top: 'hidden',
        bottom: 'hidden',
      },
    },
  },
};

