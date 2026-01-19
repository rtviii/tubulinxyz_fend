// src/app/msalite/MSALiteDisplay.tsx
'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { ColoringMode } from './ColoringControls';
import {
  setCustomColorData,
  createGradientColors,
  createAlternatingColors,
  createBindingSiteColors,
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

export interface MSALiteDisplayHandle {
  redraw: () => void;
}

const BUILTIN_SCHEMES: Record<string, string> = {
  'clustal'     : 'clustal2',
  'conservation': 'conservation',
  'hydro'       : 'hydro',
  'taylor'      : 'taylor',
  'zappo'       : 'zappo',
  'buried'      : 'buried',
  'polar'       : 'polar',
  'charged'     : 'charged',
};

const MIN_TILE_WIDTH = 4;
const ROW_HEIGHT = 20;
const NAV_HEIGHT = 30;

function generateFeatures(maxLength: number, sequenceCount: number, mode: ColoringMode): any[] {
  if (!mode.startsWith('features-')) return [];
  const features: any[] = [];

  if (mode === 'features-highlight') {
    features.push({
      id: 'region-1',
      residues: { from: 10, to: 30 },
      sequences: { from: 0, to: sequenceCount - 1 },
      fillColor: '#FF0000',
      borderColor: '#CC0000',
    });
    features.push({
      id: 'region-2',
      residues: { from: 50, to: 70 },
      sequences: { from: 0, to: sequenceCount - 1 },
      fillColor: '#00FF00',
      borderColor: '#00CC00',
    });
  } else if (mode === 'features-single') {
    [15, 45, 75, 105, 135, 165, 195].forEach((pos, idx) => {
      if (pos <= maxLength) {
        features.push({
          id: `marker-${idx}`,
          residues: { from: pos, to: pos },
          sequences: { from: 0, to: sequenceCount - 1 },
          fillColor: '#FFD700',
          borderColor: '#FF8C00',
        });
      }
    });
  }
  return features;
}

export const MSALiteDisplay = forwardRef<MSALiteDisplayHandle, MSALiteDisplayProps>(
  function MSALiteDisplay(
    { sequences, maxLength, coloringMode, onResidueHover, onResidueLeave, onResidueClick },
    ref
  ) {
    // Refs
    const outerRef = useRef<HTMLDivElement>(null);
    const msaRef = useRef<any>(null);
    const navRef = useRef<any>(null);

    // State: available width from parent
    const [availableWidth, setAvailableWidth] = useState(0);

    // Measure the outer container (available space)
    useEffect(() => {
      const el = outerRef.current;
      if (!el) return;

      const observer = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width;
        if (width > 0) setAvailableWidth(width);
      });

      observer.observe(el);
      return () => observer.disconnect();
    }, []);

    // Calculate dimensions
    const minMsaWidth = maxLength * MIN_TILE_WIDTH;

    // If we have enough space, fill it. Otherwise use minimum (triggers overflow)
    const msaWidth = availableWidth >= minMsaWidth ? availableWidth : minMsaWidth;

    // Content width is just msaWidth since we have no labels
    const contentWidth = msaWidth;

    // Sync navigation width
    useEffect(() => {
      if (!navRef.current || msaWidth === 0) return;

      const nav = navRef.current;
      nav.width = msaWidth;

      // Wait for Lit's update cycle to complete
      (nav as any).updateComplete?.then(() => {
        nav.onDimensionsChange?.();
        (nav as any).renderD3?.();
      });
    }, [msaWidth]);
    // Redraw helper
    const triggerRedraw = () => {
      const msa = msaRef.current;
      if (!msa) return;
      if (typeof msa.onDimensionsChange === 'function') {
        msa.onDimensionsChange();
      }
      if (msa.sequenceViewer?.drawScene) {
        msa.sequenceViewer.drawScene();
      }
    };

    useImperativeHandle(ref, () => ({ redraw: triggerRedraw }), []);

    // Set MSA data when sequences or width changes
    useEffect(() => {
      if (!msaRef.current || sequences.length === 0 || msaWidth === 0) return;

      const timer = setTimeout(() => {
        msaRef.current.data = sequences.map(s => ({
          name: s.name,
          sequence: s.sequence
        }));
      }, 50);

      return () => clearTimeout(timer);
    }, [sequences, msaWidth]);

    // Handle color scheme changes
    useEffect(() => {
      if (!msaRef.current) return;
      const msa = msaRef.current;

      if (coloringMode === 'custom-gradient') {
        setCustomColorData(createGradientColors(maxLength));
        msa.setAttribute('color-scheme', 'custom-position');
      } else if (coloringMode === 'custom-alternating') {
        setCustomColorData(createAlternatingColors(maxLength));
        msa.setAttribute('color-scheme', 'custom-position');
      } else if (coloringMode === 'custom-binding') {
        setCustomColorData(createBindingSiteColors([10, 11, 12, 50, 51, 52, 53, 100, 150, 200]));
        msa.setAttribute('color-scheme', 'custom-position');
      } else if (coloringMode === 'ligands') {
        msa.setAttribute('color-scheme', 'custom-position');
      } else if (BUILTIN_SCHEMES[coloringMode]) {
        msa.setAttribute('color-scheme', BUILTIN_SCHEMES[coloringMode]);
      } else {
        msa.setAttribute('color-scheme', 'clustal2');
      }

      requestAnimationFrame(() => triggerRedraw());
    }, [coloringMode, maxLength]);

    // Apply features
    useEffect(() => {
      if (!msaRef.current) return;
      msaRef.current.features = generateFeatures(maxLength, sequences.length, coloringMode);
      requestAnimationFrame(() => triggerRedraw());
    }, [coloringMode, maxLength, sequences.length]);

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
      const handleMouseLeave = () => onResidueLeave();

      msa.addEventListener('onResidueClick', handleClick);
      msa.addEventListener('onResidueMouseEnter', handleMouseEnter);
      msa.addEventListener('onResidueMouseLeave', handleMouseLeave);

      return () => {
        msa.removeEventListener('onResidueClick', handleClick);
        msa.removeEventListener('onResidueMouseEnter', handleMouseEnter);
        msa.removeEventListener('onResidueMouseLeave', handleMouseLeave);
      };
    }, [sequences, onResidueClick, onResidueHover, onResidueLeave]);

    // Loading states
    if (sequences.length === 0) {
      return (
        <div ref={outerRef} style={{ width: '100%', height: '100%' }}>
          <div className="text-gray-500 text-sm p-4">Waiting for sequences...</div>
        </div>
      );
    }

    if (availableWidth === 0) {
      return (
        <div ref={outerRef} style={{ width: '100%', height: '100%' }}>
          <div className="text-gray-500 text-sm p-4">Measuring...</div>
        </div>
      );
    }

    const msaHeight = Math.min(sequences.length * ROW_HEIGHT, 400);

    return (
      <div
        ref={outerRef}
        style={{
          width: '100%',
          height: '100%',
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
      >
        <div style={{ width: contentWidth, minWidth: minMsaWidth }}>
          <nightingale-manager style={{ display: 'block', width: '100%' }}>
            {/* Navigation - let it inherit width from container */}
            <div style={{ width: contentWidth }}>
              <nightingale-navigation
                ref={navRef}
                height={NAV_HEIGHT}

                key={`nav-${msaWidth}`}  // Force re-create when width changes
                length={maxLength}
                display-start="1"
                display-end={maxLength}
                highlight-color="#EB3BFF22"
                style={{ display: 'block', width: '100%' }}
              />
            </div>

            {/* MSA - let it inherit width from container */}
            <div style={{ width: contentWidth }}>
              <nightingale-msa
                ref={msaRef}
                height={msaHeight}
                length={maxLength}
                display-start="1"
                display-end={maxLength}
                color-scheme="clustal2"
                label-width="0"
                highlight-event="onmouseover"
                highlight-color="#00FF0044"
                style={{ display: 'block', width: '100%' }}
              />
            </div>
          </nightingale-manager>
        </div>

        {/* Status messages */}
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
