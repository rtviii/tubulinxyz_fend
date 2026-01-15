'use client';


import { applyRowHighlight } from './services/ligandColorService';

export type ColoringMode =
  // Built-in schemes
  | 'none'
  | 'clustal'
  | 'clustal-original'
  | 'conservation'
  | 'hydro'
  | 'taylor'
  | 'zappo'
  | 'cinema'
  | 'lesk'
  | 'mae'
  | 'buried'
  | 'helix'
  | 'strand'
  | 'turn'
  | 'polar'
  | 'charged'
  | 'negative'
  | 'positive'
  // Custom runtime schemes
  | 'custom-gradient'
  | 'custom-alternating'
  | 'custom-binding'
  // Feature overlays
  | 'features-highlight'
  | 'features-single'
  | 'ligands';  // NEW

interface ColoringControlsProps {
  currentMode: ColoringMode;
  onModeChange: (mode: ColoringMode) => void;
  maxLength: number;
  sequenceCount: number;
}

interface ModeInfo {
  id: ColoringMode;
  label: string;
  description: string;
}

const SCHEME_MODES: ModeInfo[] = [
  { id: 'clustal', label: 'Clustal2', description: 'Default Clustal coloring' },
  { id: 'conservation', label: 'Conservation', description: 'Conservation-based' },
  { id: 'hydro', label: 'Hydrophobicity', description: 'Hydrophobic properties' },
  { id: 'taylor', label: 'Taylor', description: 'Taylor scheme' },
  { id: 'zappo', label: 'Zappo', description: 'Zappo scheme' },
  { id: 'buried', label: 'Buried', description: 'Buried residues' },
  { id: 'polar', label: 'Polar', description: 'Polar residues' },
  { id: 'charged', label: 'Charged', description: 'Charged residues' },
];

const CUSTOM_MODES: ModeInfo[] = [
  { id: 'ligands', label: 'Ligand Sites', description: 'Show ligand binding positions' },  // NEW
  { id: 'custom-gradient', label: 'Gradient', description: 'Position-based gradient' },
  { id: 'custom-alternating', label: 'Bands', description: 'Alternating color bands' },
  { id: 'custom-binding', label: 'Demo Binding', description: 'Hardcoded demo positions' },
];

const FEATURE_MODES: ModeInfo[] = [
  { id: 'features-highlight', label: 'Region Overlay', description: 'Highlight regions (30% opacity)' },
  { id: 'features-single', label: 'Position Markers', description: 'Single-residue markers' },
];

export function ColoringControls({
  currentMode,
  onModeChange,
  maxLength,
  sequenceCount,
}: ColoringControlsProps) {
  return (
    <div className="text-xs flex flex-col h-full">
      <div className="font-medium text-gray-700 mb-2">Coloring Experiments</div>
      <div>

        <button onClick={() => {


          applyRowHighlight(2, [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], '#ff0000');
          msaDisplayRef.current?.redraw();
        }}>Testsingle seq</button>

      </div>


      <div className="flex-1 overflow-y-auto space-y-3">
        {/* Custom Runtime Schemes - THE EXCITING PART */}
        <div>
          <div className="text-green-700 mb-1 font-medium">
            Custom Schemes (Runtime Injection)
          </div>
          <div className="space-y-1">
            {CUSTOM_MODES.map(mode => (
              <button
                key={mode.id}
                onClick={() => { onModeChange(mode.id) }}
                className={`w-full text-left px-2 py-1 rounded border transition-colors ${currentMode === mode.id
                  ? 'bg-green-100 border-green-300 text-green-800'
                  : 'bg-gray-50 border-gray-200 hover:bg-green-50'
                  }`}
              >
                <div className="font-medium">{mode.label}</div>
                <div className="text-gray-500 text-[10px]">{mode.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Built-in Color Schemes */}
        <div>
          <div className="text-gray-500 mb-1 font-medium">Built-in Schemes</div>
          <div className="grid grid-cols-2 gap-1">
            {SCHEME_MODES.map(mode => (
              <button
                key={mode.id}
                onClick={() => onModeChange(mode.id)}
                className={`text-left px-2 py-1 rounded border transition-colors ${currentMode === mode.id
                  ? 'bg-blue-100 border-blue-300 text-blue-800'
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                title={mode.description}
              >
                <div className="font-medium truncate">{mode.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Features Overlay */}
        <div>
          <div className="text-purple-600 mb-1 font-medium">Features Overlay</div>
          <div className="space-y-1">
            {FEATURE_MODES.map(mode => (
              <button
                key={mode.id}
                onClick={() => onModeChange(mode.id)}
                className={`w-full text-left px-2 py-1 rounded border transition-colors ${currentMode === mode.id
                  ? 'bg-purple-100 border-purple-300 text-purple-800'
                  : 'bg-gray-50 border-gray-200 hover:bg-purple-50'
                  }`}
              >
                <div className="font-medium">{mode.label}</div>
                <div className="text-gray-500 text-[10px]">{mode.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Current state */}
      <div className="mt-2 p-2 bg-blue-50 rounded text-[10px] flex-shrink-0">
        <div className="font-medium text-blue-800">Current: {currentMode}</div>
        <div className="text-blue-600">
          {sequenceCount} seqs, {maxLength} cols
        </div>
      </div>
    </div>
  );
}