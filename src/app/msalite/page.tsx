// src/app/msalite/page.tsx
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { useGetMasterProfileMsaMasterGetQuery } from '@/store/tubxz_api';
import { addSequence, selectMasterSequences, selectAddedSequenceGroups, removeSequence } from '@/store/slices/sequence_registry';
import { useNightingaleComponents } from '../msa-viewer/hooks/useNightingaleComponents';
import { useMolstarService } from '@/components/molstar/molstar_service';
import { MolstarNode } from '@/components/molstar/molstar_spec';
import { ResizableMSAContainer, ResizableMSAContainerHandle } from './components/ResizableMSAContainer';
import { ChainAligner } from './components/ChainAligner';
import { clearColorConfig } from './services/msaColorService';
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
];

export default function MSALitePage() {
  const dispatch                   = useAppDispatch();
  const msaRef                     = useRef<ResizableMSAContainerHandle>(null);
  const molstarNodeRef             = useRef<HTMLDivElement>(null);
  const masterSequencesInitialized = useRef(false);

  const [colorScheme, setColorScheme] = useState('clustal2');
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [panelWidth, setPanelWidth] = useState(60);
  const [customStart, setCustomStart] = useState(100);
  const [customEnd, setCustomEnd] = useState(150);
  const [activeMode, setActiveMode] = useState<string | null>(null);

  const { areLoaded: componentsLoaded } = useNightingaleComponents();
  const { service: molstarService, isInitialized: molstarReady } = useMolstarService(molstarNodeRef, 'msalite');
  const { data: masterData, isLoading: loadingMaster } = useGetMasterProfileMsaMasterGetQuery();
  
  const masterSequences = useAppSelector(selectMasterSequences);
  const addedGroups = useAppSelector(selectAddedSequenceGroups);

  // Initialize master sequences
  useEffect(() => {
    if (!masterData?.sequences || masterSequencesInitialized.current) return;
    masterData.sequences.forEach((seq: any) => {
      const name = seq.id.split('|')[0];
      dispatch(addSequence({ id: name, name, sequence: seq.sequence, originType: 'master' }));
    });
    masterSequencesInitialized.current = true;
  }, [masterData, dispatch]);

  const maxLength = masterData?.alignment_length ?? 0;

  // Combine master + added sequences for display
  const allSequences = [
    ...masterSequences.map((seq) => ({ id: seq.id, name: seq.name, sequence: seq.sequence })),
    ...addedGroups.flatMap((group) =>
      group.sequences.map((seq) => ({ id: seq.id, name: seq.name, sequence: seq.sequence }))
    ),
  ];

  const log = useCallback((msg: string) => {
    setEventLog((prev) => [...prev.slice(-29), `${new Date().toLocaleTimeString()}: ${msg}`]);
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

  // Remove an added sequence
  const handleRemoveSequence = useCallback((seqId: string) => {
    dispatch(removeSequence(seqId));
    log(`Removed: ${seqId}`);
  }, [dispatch, log]);

  const isReady = componentsLoaded && !loadingMaster && maxLength > 0;
  const addedCount = addedGroups.reduce((sum, g) => sum + g.sequences.length, 0);

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
            <input type="range" min="30" max="80" value={panelWidth} onChange={(e) => setPanelWidth(Number(e.target.value))} className="ml-2 w-20" />
          </label>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* MSA Panel */}
        <div className="bg-white rounded-lg shadow flex flex-col min-w-0" style={{ width: `${panelWidth}%` }}>
          <div className="px-3 py-2 border-b text-sm text-gray-600 flex justify-between">
            <span>{isReady ? `${allSequences.length} seq (${masterSequences.length} master + ${addedCount} added), ${maxLength} col` : 'Loading...'}</span>
            {activeMode && <span className="text-purple-600 font-medium">{activeMode}</span>}
          </div>
          <div className="flex-1 p-2 min-h-0">
            {isReady ? (
              <ResizableMSAContainer
                ref={msaRef}
                sequences={allSequences}
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

        {/* Right Panel */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-y-auto">
          
          {/* Structure + Chain Aligner */}
          <div className="bg-white rounded-lg shadow p-3">
            <div className="text-sm font-medium text-gray-700 mb-2">Load Structure & Align Chains</div>
            <div className="flex gap-3">
              {/* Molstar viewer */}
              <div className="w-48 h-36 bg-gray-100 rounded overflow-hidden relative flex-shrink-0">
                <MolstarNode ref={molstarNodeRef} />
                {!molstarReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100/75">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                  </div>
                )}
              </div>
              {/* Chain aligner */}
              <div className="flex-1 min-w-0">
                <ChainAligner molstarService={molstarService} onLog={log} />
              </div>
            </div>
          </div>

          {/* Added Sequences List */}
          {addedCount > 0 && (
            <div className="bg-white rounded-lg shadow p-3">
              <div className="text-sm font-medium text-gray-700 mb-2">Added Sequences ({addedCount})</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {addedGroups.map((group) => (
                  <div key={group.title}>
                    <div className="text-xs text-gray-500 mb-1">{group.title}</div>
                    {group.sequences.map((seq) => (
                      <div key={seq.id} className="flex items-center justify-between text-xs bg-gray-50 p-1.5 rounded">
                        <span className="font-mono">{seq.name}</span>
                        <button
                          onClick={() => handleRemoveSequence(seq.id)}
                          className="text-red-500 hover:text-red-700 px-1"
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

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

          {/* Example Colorings */}
          <div className="bg-white rounded-lg shadow p-3">
            <div className="text-sm font-medium text-gray-700 mb-2">Example Colorings</div>
            <div className="flex flex-wrap gap-2 mb-2">
              <button onClick={() => applyCustom('gradient', () => exampleGradient(maxLength))} className={`px-2 py-1 rounded text-xs ${activeMode === 'gradient' ? 'bg-purple-200 ring-2 ring-purple-400' : 'bg-purple-100 hover:bg-purple-200'}`}>Gradient</button>
              <button onClick={() => applyCustom('bands', () => exampleBands(maxLength))} className={`px-2 py-1 rounded text-xs ${activeMode === 'bands' ? 'bg-purple-200 ring-2 ring-purple-400' : 'bg-purple-100 hover:bg-purple-200'}`}>Bands</button>
              <button onClick={() => applyCustom('binding', () => exampleBindingSites())} className={`px-2 py-1 rounded text-xs ${activeMode === 'binding' ? 'bg-purple-200 ring-2 ring-purple-400' : 'bg-purple-100 hover:bg-purple-200'}`}>Binding Sites</button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => applyCustom('row-0', () => exampleSingleRow(0, 20, 80, '#ff6b6b'))} className="px-2 py-1 bg-amber-100 hover:bg-amber-200 rounded text-xs">Row 0</button>
              <button onClick={() => applyCustom('multi', () => exampleMultipleRows(allSequences.length))} className={`px-2 py-1 rounded text-xs ${activeMode === 'multi' ? 'bg-amber-200 ring-2 ring-amber-400' : 'bg-amber-100 hover:bg-amber-200'}`}>Multi-Row</button>
              <button onClick={() => { exampleRandomHighlights(allSequences.length, maxLength, 5); setActiveMode('random'); setColorScheme('custom-position'); msaRef.current?.redraw(); }} className="px-2 py-1 bg-amber-100 hover:bg-amber-200 rounded text-xs">Random</button>
            </div>
          </div>

          {/* Reset */}
          <div className="bg-white rounded-lg shadow p-3">
            <button onClick={() => switchToBuiltin('clustal2')} className="w-full px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm font-medium">
              Reset to Clustal
            </button>
          </div>

          {/* Log */}
          <div className="flex-1 bg-white rounded-lg shadow flex flex-col min-h-[100px]">
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