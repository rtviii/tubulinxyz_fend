// src/app/msalite/page.tsx
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { useGetMasterProfileMsaMasterGetQuery } from '@/store/tubxz_api';
import { addSequence, selectMasterSequences } from '@/store/slices/sequence_registry';
import { useNightingaleComponents } from '../msa-viewer/hooks/useNightingaleComponents';
import { ResizableMSAContainer, ResizableMSAContainerHandle } from './ResizableMSAContainer';

const COLOR_SCHEMES = [
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
  const [panelWidth, setPanelWidth] = useState(70); // percentage

  const { areLoaded: componentsLoaded } = useNightingaleComponents();
  const { data: masterData, isLoading: loadingMaster } = useGetMasterProfileMsaMasterGetQuery();
  const masterSequences = useAppSelector(selectMasterSequences);

  const [customStart, setCustomStart] = useState(100);
  const [customEnd, setCustomEnd] = useState(150);

  // Initialize master sequences
  useEffect(() => {
    if (!masterData?.sequences || masterSequencesInitialized.current) return;

    masterData.sequences.forEach((seq: any) => {
      const name = seq.id.split('|')[0];
      dispatch(addSequence({
        id: name,
        name: name,
        sequence: seq.sequence,
        originType: 'master',
      }));
    });

    masterSequencesInitialized.current = true;
  }, [masterData, dispatch]);

  const maxLength = masterData?.alignment_length ?? 0;

  const sequences = masterSequences.map((seq) => ({
    id: seq.id,
    name: seq.name,
    sequence: seq.sequence,
  }));

  const log = useCallback((msg: string) => {
    setEventLog((prev) => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: ${msg}`]);
  }, []);

  const handleResidueHover = useCallback((seqId: string, position: number) => {
    log(`Hover: ${seqId} @ ${position}`);
  }, [log]);

  const handleResidueClick = useCallback((seqId: string, position: number) => {
    log(`Click: ${seqId} @ ${position}`);
  }, [log]);

  const handleResidueLeave = useCallback(() => {
    // silent
  }, []);

  const isReady = componentsLoaded && !loadingMaster && maxLength > 0;

  return (
    <div className="h-screen flex flex-col bg-gray-100 p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow px-4 py-2">
        <h1 className="text-lg font-semibold text-gray-800">MSA Resize Test</h1>
        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-600">
            Color scheme:
            <select
              value={colorScheme}
              onChange={(e) => setColorScheme(e.target.value)}
              className="ml-2 border rounded px-2 py-1 text-sm"
            >
              {COLOR_SCHEMES.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-600">
            Panel width: {panelWidth}%
            <input
              type="range"
              min="20"
              max="100"
              value={panelWidth}
              onChange={(e) => setPanelWidth(Number(e.target.value))}
              className="ml-2 w-32"
            />
          </label>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* MSA Panel - resizable via slider */}
        <div
          className="bg-white rounded-lg shadow flex flex-col min-w-0"
          style={{ width: `${panelWidth}%` }}
        >
          <div className="px-3 py-2 border-b text-sm text-gray-600">
            {isReady
              ? `${sequences.length} sequences, ${maxLength} columns`
              : 'Loading...'}
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

        {/* Side panel */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Event log */}
          <div className="flex-1 bg-white rounded-lg shadow flex flex-col min-h-0">
            <div className="px-3 py-2 border-b text-sm font-medium text-gray-700">
              Event Log
            </div>
            <div className="flex-1 p-2 overflow-auto">
              <pre className="text-xs font-mono text-gray-600 whitespace-pre-wrap">
                {eventLog.length === 0 ? 'Interact with MSA to see events...' : eventLog.join('\n')}
              </pre>
            </div>
            <div className="px-3 py-2 border-t">
              <button
                onClick={() => setEventLog([])}
                className="text-xs text-blue-600 hover:underline"
              >
                Clear log
              </button>
            </div>
          </div>

          {/* Debug info */}
          <div className="bg-white rounded-lg shadow p-3">
            <div className="text-sm font-medium text-gray-700 mb-2">Debug Info</div>
            <div className="text-xs text-gray-600 space-y-1">
              <div>Components loaded: {componentsLoaded ? 'Yes' : 'No'}</div>
              <div>Master data loaded: {!loadingMaster ? 'Yes' : 'No'}</div>
              <div>Sequence count: {sequences.length}</div>
              <div>Alignment length: {maxLength}</div>
              <div>Min width needed: {maxLength * 4}px</div>
              <div>Panel width setting: {panelWidth}%</div>
            </div>

            <div className="mt-3 pt-3 border-t">
              <div className="text-sm font-medium text-gray-700 mb-2">Jump to Range</div>

              {/* Preset buttons */}
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => msaRef.current?.jumpToRange(1, 50)}
                  className="px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded text-xs"
                >
                  1-50
                </button>
                <button
                  onClick={() => msaRef.current?.jumpToRange(100, 150)}
                  className="px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded text-xs"
                >
                  100-150
                </button>
                <button
                  onClick={() => msaRef.current?.jumpToRange(200, 220)}
                  className="px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded text-xs"
                >
                  200-220
                </button>
                <button
                  onClick={() => msaRef.current?.jumpToRange(300, 400)}
                  className="px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded text-xs"
                >
                  300-400
                </button>
                <button
                  onClick={() => msaRef.current?.jumpToRange(1, maxLength)}
                  className="px-2 py-1 bg-green-100 hover:bg-green-200 rounded text-xs"
                >
                  Full ({maxLength})
                </button>
              </div>

              {/* Custom range inputs */}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={customStart}
                  onChange={(e) => setCustomStart(Number(e.target.value))}
                  min={1}
                  max={maxLength}
                  className="w-16 px-1 py-0.5 border rounded text-xs"
                />
                <span className="text-xs">to</span>
                <input
                  type="number"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(Number(e.target.value))}
                  min={1}
                  max={maxLength}
                  className="w-16 px-1 py-0.5 border rounded text-xs"
                />
                <button
                  onClick={() => msaRef.current?.jumpToRange(customStart, customEnd)}
                  className="px-2 py-1 bg-purple-100 hover:bg-purple-200 rounded text-xs"
                >
                  Go
                </button>
              </div>
            </div>

            <button
              onClick={() => msaRef.current?.redraw()}
              className="mt-3 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs"
            >
              Force Redraw
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}