// src/app/msalite/page.tsx
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { useGetMasterProfileMsaMasterGetQuery } from '@/store/tubxz_api';
import { addSequence, selectMasterSequences } from '@/store/slices/sequence_registry';
import { useNightingaleComponents } from '../msa-viewer/hooks/useNightingaleComponents';

import { ResizableMSAContainer, ResizableMSAContainerHandle } from './components/ResizableMSAContainer';
import { clearColorConfig, RowHighlight } from './services/msaColorService';
import {
  exampleGradient,
  exampleBands,
  exampleConservedRegions,
  exampleSingleRow,
  exampleMultipleRows,
  exampleRandomHighlights,
  exampleCombined,
  exampleBindingSites,
} from './examples/coloringExamples';

const BUILTIN_SCHEMES = [
  { id: 'clustal2', name: 'Clustal' },
  { id: 'zappo', name: 'Zappo' },
  { id: 'taylor', name: 'Taylor' },
  { id: 'hydro', name: 'Hydrophobicity' },
  { id: 'buried', name: 'Buried' },
  { id: 'cinema', name: 'Cinema' },
];

export default function MSALitePage() {
  const dispatch = useAppDispatch();
  const msaRef = useRef<ResizableMSAContainerHandle>(null);
  const masterSequencesInitialized = useRef(false);

  const [colorScheme, setColorScheme] = useState('clustal2');
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [panelWidth, setPanelWidth] = useState(70);
  const [customStart, setCustomStart] = useState(100);
  const [customEnd, setCustomEnd] = useState(150);
  const [activeMode, setActiveMode] = useState<string | null>(null);

  const { areLoaded: componentsLoaded } = useNightingaleComponents();
  const { data: masterData, isLoading: loadingMaster } = useGetMasterProfileMsaMasterGetQuery();
  const masterSequences = useAppSelector(selectMasterSequences);

  useEffect(() => {
    if (!masterData?.sequences || masterSequencesInitialized.current) return;
    masterData.sequences.forEach((seq: any) => {
      const name = seq.id.split('|')[0];
      dispatch(addSequence({ id: name, name, sequence: seq.sequence, originType: 'master' }));
    });
    masterSequencesInitialized.current = true;
  }, [masterData, dispatch]);

  const maxLength = masterData?.alignment_length ?? 0;
  const sequences = masterSequences.map((seq) => ({ id: seq.id, name: seq.name, sequence: seq.sequence }));

  const log = useCallback((msg: string) => {
    setEventLog((prev) => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: ${msg}`]);
  }, []);

  // Apply custom coloring helper
  const applyCustom = useCallback((mode: string, setupFn: () => void) => {
    setupFn();
    msaRef.current?.setColorScheme('custom-position');
    msaRef.current?.redraw();
    setActiveMode(mode);
    setColorScheme('custom-position');
    log(`Applied: ${mode}`);
  }, [log]);

  // Clear and switch to builtin
  const switchToBuiltin = useCallback((scheme: string) => {
    clearColorConfig();
    setColorScheme(scheme);
    setActiveMode(null);
    msaRef.current?.setColorScheme(scheme);
    msaRef.current?.redraw();
    log(`Builtin: ${scheme}`);
  }, [log]);

  const isReady = componentsLoaded && !loadingMaster && maxLength > 0;

  return (
    <div className="h-screen flex flex-col bg-gray-100 p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow px-4 py-2">
        <h1 className="text-lg font-semibold text-gray-800">MSA Playground</h1>
        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-600">
            Builtin:
            <select
              value={activeMode ? '' : colorScheme}
              onChange={(e) => e.target.value && switchToBuiltin(e.target.value)}
              className="ml-2 border rounded px-2 py-1 text-sm"
            >
              {activeMode && <option value="">-- custom --</option>}
              {BUILTIN_SCHEMES.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-600">
            Width: {panelWidth}%
            <input type="range" min="30" max="100" value={panelWidth} onChange={(e) => setPanelWidth(Number(e.target.value))} className="ml-2 w-24" />
          </label>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* MSA */}
        <div className="bg-white rounded-lg shadow flex flex-col min-w-0" style={{ width: `${panelWidth}%` }}>
          <div className="px-3 py-2 border-b text-sm text-gray-600 flex justify-between">
            <span>{isReady ? `${sequences.length} seq, ${maxLength} col` : 'Loading...'}</span>
            {activeMode && <span className="text-purple-600 font-medium">{activeMode}</span>}
          </div>
          <div className="flex-1 p-2 min-h-0">
            {isReady ? (
              <ResizableMSAContainer
                ref={msaRef}
                sequences={sequences}
                maxLength={maxLength}
                colorScheme={colorScheme}
                onResidueHover={(id, pos) => log(`Hover: ${id} @ ${pos}`)}
                onResidueLeave={() => {}}
                onResidueClick={(id, pos) => log(`Click: ${id} @ ${pos}`)}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-y-auto">
          
          {/* Jump to Range */}
          <div className="bg-white rounded-lg shadow p-3">
            <div className="text-sm font-medium text-gray-700 mb-2">Jump to Range</div>
            <div className="flex flex-wrap gap-2 mb-2">
              {[[1,50], [100,150], [200,250]].map(([s,e]) => (
                <button key={`${s}-${e}`} onClick={() => msaRef.current?.jumpToRange(s, e)} className="px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded text-xs">{s}-{e}</button>
              ))}
              <button onClick={() => msaRef.current?.jumpToRange(1, maxLength)} className="px-2 py-1 bg-green-100 hover:bg-green-200 rounded text-xs">Full</button>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" value={customStart} onChange={(e) => setCustomStart(Number(e.target.value))} className="w-16 px-1 py-0.5 border rounded text-xs" />
              <span className="text-xs">to</span>
              <input type="number" value={customEnd} onChange={(e) => setCustomEnd(Number(e.target.value))} className="w-16 px-1 py-0.5 border rounded text-xs" />
              <button onClick={() => msaRef.current?.jumpToRange(customStart, customEnd)} className="px-2 py-1 bg-purple-100 hover:bg-purple-200 rounded text-xs">Go</button>
            </div>
          </div>

          {/* Example: Whole-MSA */}
          <div className="bg-white rounded-lg shadow p-3">
            <div className="text-sm font-medium text-gray-700 mb-1">Examples: Whole-MSA</div>
            <div className="text-xs text-gray-500 mb-2">Column-based coloring</div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => applyCustom('gradient', () => exampleGradient(maxLength))} className={`px-2 py-1 rounded text-xs ${activeMode === 'gradient' ? 'bg-purple-200 ring-2 ring-purple-400' : 'bg-purple-100 hover:bg-purple-200'}`}>Gradient</button>
              <button onClick={() => applyCustom('bands', () => exampleBands(maxLength))} className={`px-2 py-1 rounded text-xs ${activeMode === 'bands' ? 'bg-purple-200 ring-2 ring-purple-400' : 'bg-purple-100 hover:bg-purple-200'}`}>Bands</button>
              <button onClick={() => applyCustom('conserved', () => exampleConservedRegions(maxLength))} className={`px-2 py-1 rounded text-xs ${activeMode === 'conserved' ? 'bg-purple-200 ring-2 ring-purple-400' : 'bg-purple-100 hover:bg-purple-200'}`}>Conserved</button>
              <button onClick={() => applyCustom('binding', () => exampleBindingSites())} className={`px-2 py-1 rounded text-xs ${activeMode === 'binding' ? 'bg-purple-200 ring-2 ring-purple-400' : 'bg-purple-100 hover:bg-purple-200'}`}>Binding Sites</button>
            </div>
          </div>

          {/* Example: Per-Sequence */}
          <div className="bg-white rounded-lg shadow p-3">
            <div className="text-sm font-medium text-gray-700 mb-1">Examples: Per-Sequence</div>
            <div className="text-xs text-gray-500 mb-2">Row-specific highlights</div>
            <div className="flex flex-wrap gap-2 mb-2">
              <button onClick={() => applyCustom('row-0', () => exampleSingleRow(0, 20, 80, '#ff6b6b'))} className="px-2 py-1 bg-red-100 hover:bg-red-200 rounded text-xs">Seq 0</button>
              <button onClick={() => applyCustom('row-1', () => exampleSingleRow(1, 100, 180, '#4ecdc4'))} className="px-2 py-1 bg-teal-100 hover:bg-teal-200 rounded text-xs">Seq 1</button>
              <button onClick={() => applyCustom('row-2', () => exampleSingleRow(2, 200, 280, '#45b7d1'))} className="px-2 py-1 bg-sky-100 hover:bg-sky-200 rounded text-xs">Seq 2</button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => applyCustom('multi', () => exampleMultipleRows(sequences.length))} className={`px-2 py-1 rounded text-xs ${activeMode === 'multi' ? 'bg-amber-200 ring-2 ring-amber-400' : 'bg-amber-100 hover:bg-amber-200'}`}>Diagonal</button>
              <button onClick={() => { const h = exampleRandomHighlights(sequences.length, maxLength, 5); setActiveMode('random'); setColorScheme('custom-position'); log(`Random: ${h.length} highlights`); }} className="px-2 py-1 bg-amber-100 hover:bg-amber-200 rounded text-xs">Random</button>
              <button onClick={() => applyCustom('combined', () => exampleCombined(maxLength))} className={`px-2 py-1 rounded text-xs ${activeMode === 'combined' ? 'bg-green-200 ring-2 ring-green-400' : 'bg-green-100 hover:bg-green-200'}`}>Combined</button>
            </div>
          </div>

          {/* Reset */}
          <div className="bg-white rounded-lg shadow p-3">
            <button onClick={() => switchToBuiltin('clustal2')} className="w-full px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm font-medium">
              Reset to Clustal
            </button>
          </div>

          {/* Log */}
          <div className="flex-1 bg-white rounded-lg shadow flex flex-col min-h-[120px]">
            <div className="px-3 py-2 border-b text-sm font-medium text-gray-700 flex justify-between">
              <span>Log</span>
              <button onClick={() => setEventLog([])} className="text-xs text-blue-600 hover:underline">Clear</button>
            </div>
            <div className="flex-1 p-2 overflow-auto">
              <pre className="text-xs font-mono text-gray-600 whitespace-pre-wrap">
                {eventLog.length === 0 ? 'Interact with MSA...' : eventLog.join('\n')}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}