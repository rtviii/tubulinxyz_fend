'use client';

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { ColoringMode } from './ColoringControls';
import {
  setCustomColorData,
  createGradientColors,
  createAlternatingColors,
  createBindingSiteColors,
  CustomColorData
} from './customColorScheme';

interface SequenceData {
  id: string;
  name: string;
  sequence: string;
}

interface MSALiteDisplayProps {
  sequences: SequenceData[];
  maxLength: number;
  coloringMode: ColoringMode;
  onResidueHover: (seqId: string, position: number) => void;
  onResidueLeave: () => void;
  onResidueClick: (seqId: string, position: number) => void;
}

// Map our mode to actual nightingale color scheme names
const BUILTIN_SCHEMES: Record<string, string> = {
  'clustal': 'clustal2',
  'clustal-original': 'clustal',
  'conservation': 'conservation',
  'hydro': 'hydro',
  'taylor': 'taylor',
  'zappo': 'zappo',
  'cinema': 'cinema',
  'lesk': 'lesk',
  'mae': 'mae',
  'buried': 'buried',
  'helix': 'helix',
  'strand': 'strand',
  'turn': 'turn',
  'polar': 'polar',
  'charged': 'charged',
  'negative': 'negative',
  'positive': 'positive',
};

// Custom scheme modes that need injection
const CUSTOM_SCHEME_MODES = ['custom-gradient', 'custom-alternating', 'custom-binding'];

// Generate feature overlays
function generateFeatures(
  maxLength: number,
  sequenceCount: number,
  mode: ColoringMode
): any[] {
  if (!mode.startsWith('features-')) return [];

  const features: any[] = [];

  if (mode === 'features-highlight') {
    features.push({
      id: 'region-1',
      residues: { from: 10, to: 30 },
      sequences: { from: 0, to: sequenceCount - 1 },
      fillColor: '#FF0000',
      borderColor: '#CC0000',
      mouseOverFillColor: '#FF4444',
      mouseOverBorderColor: '#AA0000',
    });
    features.push({
      id: 'region-2',
      residues: { from: 50, to: 70 },
      sequences: { from: 0, to: sequenceCount - 1 },
      fillColor: '#00FF00',
      borderColor: '#00CC00',
      mouseOverFillColor: '#44FF44',
      mouseOverBorderColor: '#00AA00',
    });
    features.push({
      id: 'region-3',
      residues: { from: 100, to: 120 },
      sequences: { from: 0, to: sequenceCount - 1 },
      fillColor: '#0000FF',
      borderColor: '#0000CC',
      mouseOverFillColor: '#4444FF',
      mouseOverBorderColor: '#0000AA',
    });
  } else if (mode === 'features-single') {
    const markerPositions = [15, 45, 75, 105, 135, 165, 195];
    markerPositions.forEach((pos, idx) => {
      if (pos <= maxLength) {
        features.push({
          id: `marker-${idx}`,
          residues: { from: pos, to: pos },
          sequences: { from: 0, to: sequenceCount - 1 },
          fillColor: '#FFD700',
          borderColor: '#FF8C00',
          mouseOverFillColor: '#FFEC8B',
          mouseOverBorderColor: '#FF4500',
        });
      }
    });
  }

  return features;
}


export interface MSALiteDisplayHandle {
  redraw: () => void;
}
export const MSALiteDisplay = forwardRef<MSALiteDisplayHandle, MSALiteDisplayProps>(
  function MSALiteDisplay(
    {
      sequences,
      maxLength,
      coloringMode,
      onResidueHover,
      onResidueLeave,
      onResidueClick,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const msaRef = useRef<any>(null);
    const navRef = useRef<any>(null);
    const [isReady, setIsReady] = useState(false);

    const labelWidth = 100;
    const rowHeight = 20;

    // Initialize after mount
    useEffect(() => {
      const timer = setTimeout(() => setIsReady(true), 100);
      return () => clearTimeout(timer);
    }, []);

// Update the useImperativeHandle to use the new method
useImperativeHandle(ref, () => ({
  redraw: () => {
    if (msaRef.current?.sequenceViewer) {
      msaRef.current.sequenceViewer.invalidateAndRedraw();
    }
  },
}), []);

    // Initialize after mount
    useEffect(() => {
      const timer = setTimeout(() => setIsReady(true), 100);
      return () => clearTimeout(timer);
    }, []);


    // Set MSA data
    useEffect(() => {
      if (!msaRef.current || !isReady || sequences.length === 0) return;

      msaRef.current.data = sequences.map(s => ({
        name: s.name,
        sequence: s.sequence
      }));
    }, [sequences, isReady]);


    // Handle color scheme changes
    // Handle color scheme changes
    useEffect(() => {
      if (!msaRef.current || !isReady) return;

      const msa = msaRef.current;

      // Custom position-based schemes
      if (coloringMode === 'custom-gradient') {
        setCustomColorData(createGradientColors(maxLength));
        msa.setAttribute('color-scheme', 'custom-position');
        setTimeout(() => msa.sequenceViewer?.draw(), 50);
        return;
      }

      if (coloringMode === 'custom-alternating') {
        setCustomColorData(createAlternatingColors(maxLength));
        msa.setAttribute('color-scheme', 'custom-position');
        setTimeout(() => msa.sequenceViewer?.draw(), 50);
        return;
      }

      if (coloringMode === 'custom-binding') {
        setCustomColorData(createBindingSiteColors([10, 11, 12, 50, 51, 52, 53, 100, 150, 200]));
        msa.setAttribute('color-scheme', 'custom-position');
        setTimeout(() => msa.sequenceViewer?.draw(), 50);
        return;
      }

      // NEW: Ligand mode - just switch to custom-position, data is already set via hook
      if (coloringMode === 'ligands') {
        msa.setAttribute('color-scheme', 'custom-position');
        setTimeout(() => msa.sequenceViewer?.draw(), 50);
        return;
      }

      // Built-in schemes
      if (BUILTIN_SCHEMES[coloringMode]) {
        msa.setAttribute('color-scheme', BUILTIN_SCHEMES[coloringMode]);
        setTimeout(() => msa.sequenceViewer?.draw(), 50);
        return;
      }

      // Default
      msa.setAttribute('color-scheme', 'clustal2');
      setTimeout(() => msa.sequenceViewer?.draw(), 50);
    }, [coloringMode, maxLength, isReady]);

    // Apply features
    useEffect(() => {
      if (!msaRef.current || !isReady) return;

      const features = generateFeatures(maxLength, sequences.length, coloringMode);
      msaRef.current.features = features;

      setTimeout(() => {
        if (msaRef.current?.sequenceViewer) {
          msaRef.current.sequenceViewer.invalidateAndRedraw();
        }
      }, 50);
    }, [coloringMode, maxLength, sequences.length, isReady]);

    // Event handlers
    useEffect(() => {
      const msa = msaRef.current;
      if (!msa) return;

      const handleClick = (e: any) => {
        const { position, i } = e.detail || {};
        if (typeof position === 'number' && sequences[i]) {
          onResidueClick(sequences[i].id, position);
        }
      };

      const handleMouseEnter = (e: any) => {
        const { position, i } = e.detail || {};
        if (typeof position === 'number' && sequences[i]) {
          onResidueHover(sequences[i].id, position);
        }
      };

      const handleMouseLeave = () => {
        onResidueLeave();
      };

      msa.addEventListener('onResidueClick', handleClick);
      msa.addEventListener('onResidueMouseEnter', handleMouseEnter);
      msa.addEventListener('onResidueMouseLeave', handleMouseLeave);

      return () => {
        msa.removeEventListener('onResidueClick', handleClick);
        msa.removeEventListener('onResidueMouseEnter', handleMouseEnter);
        msa.removeEventListener('onResidueMouseLeave', handleMouseLeave);
      };
    }, [sequences, onResidueClick, onResidueHover, onResidueLeave]);

    if (!isReady) {
      return <div className="text-gray-500 text-sm">Initializing...</div>;
    }

    return (

      <div ref={containerRef} style={{ width: '100%' }}>
        <nightingale-manager style={{ width: '100%', display: 'block' }}>
          {/* Navigation */}
          <div style={{ display: 'flex', marginBottom: 4 }}>
            <div style={{ width: labelWidth, minWidth: labelWidth }} />
            <div style={{ flex: 1, lineHeight: 0 }}>
              <nightingale-navigation
                ref={navRef}
                height="30"
                length={maxLength}
                display-start="1"
                display-end={maxLength}
                highlight-color="#EB3BFF22"
              />
            </div>
          </div>

          {/* MSA */}
          <div style={{ display: 'flex' }}>
            <div style={{ width: labelWidth, minWidth: labelWidth }} />
            <div style={{ flex: 1, lineHeight: 0 }}>
              <nightingale-msa
                ref={msaRef}
                height={Math.min(sequences.length * rowHeight, 400)}
                length={maxLength}
                display-start="1"
                display-end={maxLength}
                color-scheme="clustal2"
                label-width="0"
                highlight-event="onmouseover"
                highlight-color="#00FF0044"
              />
            </div>
          </div>
        </nightingale-manager>

        {/* Status indicator */}
        {coloringMode === 'ligands' && (
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
            Ligand binding site coloring active
          </div>
        )}

        {coloringMode.startsWith('features-') && (
          <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
            Feature overlay opacity is hardcoded at 30% in nightingale source.
          </div>
        )}
      </div>
    );
  }
);