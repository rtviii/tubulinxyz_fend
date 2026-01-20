// src/app/msalite/page.tsx
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { useGetMasterProfileMsaMasterGetQuery } from '@/store/tubxz_api';
import { addSequence, selectMasterSequences } from '@/store/slices/sequence_registry';
import { useNightingaleComponents } from '../msa-viewer/hooks/useNightingaleComponents';
import { ResizableMSAContainer, ResizableMSAContainerHandle } from './ResizableMSAContainer';
import {
  applyGradient,
  applyBands,
  applyRowHighlights,
  applySingleRowHighlight,
  applyCombined,
  clearColorConfig,
  generateRandomRowHighlights,
  PRESETS,
  RowHighlight,
} from './services/msaColorService';

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
  const [activeCustomMode, setActiveCustomMode] = useState<string | null>(null);

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

  const handleResidueHover = useCallback((seqId: string, position: number) => {
    log(`Hover: ${seqId} @ ${position}`);
  }, [log]);

  const handleResidueClick = useCallback((seqId: string, position: number) => {
    log(`Click: ${seqId} @ ${position}`);
  }, [log]);

  const handleResidueLeave = useCallback(() => { }, []);

  // Apply custom scheme helper
  const applyCustom = useCallback((mode: string, setupFn: () => void) => {
    setupFn();
    msaRef.current?.setColorScheme('custom-position');
    msaRef.current?.redraw();
    setActiveCustomMode(mode);
    setColorScheme('custom-position');
    log(`Applied: ${mode}`);
  }, [log]);

  // Whole-MSA handlers
  const handleGradient = useCallback(() => applyCustom('gradient', () => applyGradient(maxLength)), [applyCustom, maxLength]);
  const handleBands = useCallback(() => applyCustom('bands', () => applyBands(maxLength)), [applyCustom, maxLength]);
  const handleConserved = useCallback(() => applyCustom('conserved', () => PRESETS.conservedRegions(maxLength)), [applyCustom, maxLength]);
  const handleBindingSites = useCallback(() => applyCustom('binding-sites', () => PRESETS.bindingSites()), [applyCustom]);

  // Per-sequence handlers
  const handleSingleRow = useCallback((row: number, start: number, end: number, color: string) => {
    applyCustom(`row-${row}`, () => applySingleRowHighlight(row, start, end, color));
  }, [applyCustom]);

  const handleMultiRow = useCallback(() => {
    const highlights: RowHighlight[] = [
      { rowIndex: 0, start: 20, end: 60, color: '#ff6b6b' },
      { rowIndex: 1, start: 80, end: 130, color: '#4ecdc4' },
      { rowIndex: 2, start: 150, end: 200, color: '#45b7d1' },
      { rowIndex: 3, start: 250, end: 300, color: '#96ceb4' },
      { rowIndex: 4, start: 350, end: 400, color: '#ffeaa7' },
    ];
    applyCustom('multi-row', () => applyRowHighlights(highlights));
  }, [applyCustom]);

  const handleRandomHighlights = useCallback(() => {
    const highlights = generateRandomRowHighlights(sequences.length, maxLength, 6);
    applyCustom('random', () => applyRowHighlights(highlights));
  }, [applyCustom, sequences.length, maxLength]);

  const handlePerSeqDemo = useCallback(() => {
    applyCustom('per-seq-demo', () => PRESETS.perSequenceDemo(sequences.length));
  }, [applyCustom, sequences.length]);

  // Combined
  const handleCombined = useCallback(() => {
    const highlights: RowHighlight[] = [
      { rowIndex: 1, start: 50, end: 100, color: '#ff0000' },
      { rowIndex: 3, start: 200, end: 250, color: '#00ff00' },
    ];
    applyCustom('combined', () => applyCombined(maxLength, 'bands', highlights));
  }, [applyCustom, maxLength]);

  // Clear
  const handleClear = useCallback(() => {
    clearColorConfig();
    msaRef.current?.setColorScheme('clustal2');
    msaRef.current?.redraw();
    setActiveCustomMode(null);
    setColorScheme('clustal2');
    log('Cleared custom coloring');
  }, [log]);

  const handleBuiltinChange = useCallback((scheme: string) => {
    clearColorConfig();
    setColorScheme(scheme);
    setActiveCustomMode(null);
    msaRef.current?.setColorScheme(scheme);
    msaRef.current?.redraw();
    log(`Builtin: ${scheme}`);
  }, [log]);

  const isReady = componentsLoaded && !loadingMaster && maxLength > 0;

  return (
    <div className="h-screen flex flex-col bg-gray-100 p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow px-4 py-2">
        <h1 className="text-lg font-semibold text-gray-800">MSA Coloring Playground</h1>
        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-600">
            Builtin:
            <select
              value={activeCustomMode ? '' : colorScheme}
              onChange={(e) => e.target.value && handleBuiltinChange(e.target.value)}
              className="ml-2 border rounded px-2 py-1 text-sm"
            >
              {activeCustomMode && <option value="">-- custom --</option>}
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
            {activeCustomMode && <span className="text-purple-600 font-medium">{activeCustomMode}</span>}
          </div>
          <div className="flex-1 p-2 min-h-0">
            {isReady ? (
              <ResizableMSAContainer
                ref={msaRef}
                sequences={sequences}
                maxLength={maxLength}
                colorScheme={colorScheme}
                onResidueHover={handleResidueHover}
                onResidueLeave={handleResidueLeave}
                onResidueClick={handleResidueClick}
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

          {/* Jump */}
          <div className="bg-white rounded-lg shadow p-3">
            <div className="text-sm font-medium text-gray-700 mb-2">Jump to Range</div>
            <div className="flex flex-wrap gap-2 mb-2">
              {[[1, 50], [100, 150], [200, 250], [1, maxLength]].map(([s, e]) => (
                <button key={`${s}-${e}`} onClick={() => msaRef.current?.jumpToRange(s, e)} className={`px-2 py-1 rounded text-xs ${e === maxLength ? 'bg-green-100 hover:bg-green-200' : 'bg-blue-100 hover:bg-blue-200'}`}>
                  {e === maxLength ? 'Full' : `${s}-${e}`}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input type="number" value={customStart} onChange={(e) => setCustomStart(Number(e.target.value))} className="w-16 px-1 py-0.5 border rounded text-xs" />
              <span className="text-xs">to</span>
              <input type="number" value={customEnd} onChange={(e) => setCustomEnd(Number(e.target.value))} className="w-16 px-1 py-0.5 border rounded text-xs" />
              <button onClick={() => msaRef.current?.jumpToRange(customStart, customEnd)} className="px-2 py-1 bg-purple-100 hover:bg-purple-200 rounded text-xs">Go</button>
            </div>
          </div>

          {/* Whole-MSA */}
          <div className="bg-white rounded-lg shadow p-3">
            <div className="text-sm font-medium text-gray-700 mb-2">Whole-MSA Coloring</div>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'gradient', fn: handleGradient, label: 'Gradient' },
                { id: 'bands', fn: handleBands, label: 'Bands' },
                { id: 'conserved', fn: handleConserved, label: 'Conserved' },
                { id: 'binding-sites', fn: handleBindingSites, label: 'Binding Sites' },
              ].map(({ id, fn, label }) => (
                <button key={id} onClick={fn} className={`px-2 py-1 rounded text-xs ${activeCustomMode === id ? 'bg-purple-200 ring-2 ring-purple-400' : 'bg-purple-100 hover:bg-purple-200'}`}>{label}</button>
              ))}
            </div>
          </div>

          {/* Per-Sequence */}
          <div className="bg-white rounded-lg shadow p-3">
            <div className="text-sm font-medium text-gray-700 mb-2">Per-Sequence Highlights</div>
            <div className="text-xs text-gray-500 mb-2">Single row:</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                { row: 0, s: 20, e: 80, c: '#ff6b6b', bg: 'red' },
                { row: 1, s: 100, e: 180, c: '#4ecdc4', bg: 'teal' },
                { row: 2, s: 200, e: 280, c: '#45b7d1', bg: 'sky' },
              ].map(({ row, s, e, c, bg }) => (
                <button key={row} onClick={() => handleSingleRow(row, s, e, c)} className={`px-2 py-1 bg-${bg}-100 hover:bg-${bg}-200 rounded text-xs`}>Seq {row}: {s}-{e}</button>
              ))}
            </div>
            <div className="text-xs text-gray-500 mb-2">Multiple rows:</div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleMultiRow} className={`px-2 py-1 rounded text-xs ${activeCustomMode === 'multi-row' ? 'bg-amber-200 ring-2 ring-amber-400' : 'bg-amber-100 hover:bg-amber-200'}`}>Fixed Multi</button>
              <button onClick={handleRandomHighlights} className="px-2 py-1 bg-amber-100 hover:bg-amber-200 rounded text-xs">Random</button>
              <button onClick={handlePerSeqDemo} className={`px-2 py-1 rounded text-xs ${activeCustomMode === 'per-seq-demo' ? 'bg-amber-200 ring-2 ring-amber-400' : 'bg-amber-100 hover:bg-amber-200'}`}>Diagonal</button>
            </div>
          </div>

          {/* Combined */}
          <div className="bg-white rounded-lg shadow p-3">
            <div className="text-sm font-medium text-gray-700 mb-2">Combined</div>
            <button onClick={handleCombined} className={`px-2 py-1 rounded text-xs ${activeCustomMode === 'combined' ? 'bg-green-200 ring-2 ring-green-400' : 'bg-green-100 hover:bg-green-200'}`}>Bands + Row Overrides</button>
          </div>

          {/* Clear */}
          <div className="bg-white rounded-lg shadow p-3">
            <button onClick={handleClear} className="w-full px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm font-medium">Reset to Builtin</button>
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