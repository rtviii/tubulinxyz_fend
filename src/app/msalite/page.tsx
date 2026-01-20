// src/app/msalite/page.tsx
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { useGetMasterProfileMsaMasterGetQuery } from '@/store/tubxz_api';
import {
  addSequence,
  selectMasterSequences,
  selectAddedSequenceGroups,
  removeSequence
} from '@/store/slices/sequence_registry';
import { useNightingaleComponents } from './useNightingaleComponents';

import { useMolstarInstance } from '@/components/molstar/services/MolstarInstanceManager';
import { MolstarNode } from '@/components/molstar/spec';

import { MSAViewerPanel } from './components/MSAViewerPanel';
import { ChainAligner } from './components/ChainAligner';
import { AnnotationData } from './components/AnnotationPanel';

// Mock annotations for demo/testing
const DEMO_ANNOTATIONS: AnnotationData = {
  bindingSites: [
    {
      id: 'colchicine',
      name: 'Colchicine Site',
      positions: [247, 248, 249, 250, 251, 252, 314, 315, 316, 317, 318],
    },
    {
      id: 'taxol',
      name: 'Paclitaxel Site',
      positions: [22, 23, 24, 25, 26, 227, 228, 229, 230, 274, 275, 276, 277],
    },
    {
      id: 'vinblastine',
      name: 'Vinblastine Site',
      positions: [175, 176, 177, 178, 179, 180, 181, 214, 215, 216, 217],
    },
    {
      id: 'gtp',
      name: 'GTP Binding',
      positions: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 140, 141, 142, 143, 144, 145],
    },
  ],
  mutations: [
    { masterIndex: 50, fromResidue: 'A', toResidue: 'V', phenotype: 'Drug resistance' },
    { masterIndex: 120, fromResidue: 'G', toResidue: 'R', phenotype: 'Altered dynamics' },
    { masterIndex: 275, fromResidue: 'T', toResidue: 'I', phenotype: 'Taxol resistance' },
    { masterIndex: 301, fromResidue: 'E', toResidue: 'K', phenotype: 'Unknown' },
  ],
};

export default function MSALitePage() {
  const dispatch = useAppDispatch();
  const molstarNodeRef = useRef<HTMLDivElement>(null);
  const masterSequencesInitialized = useRef(false);

  const [eventLog, setEventLog] = useState<string[]>([]);
  const [panelWidth, setPanelWidth] = useState(65);

  const { areLoaded: componentsLoaded } = useNightingaleComponents();
  const { instance: molstarInstance, isInitialized: molstarReady } = useMolstarInstance(molstarNodeRef, 'msalite');
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

  // Combine master + added sequences
  const allSequences = [
    ...masterSequences.map((seq) => ({
      id: seq.id,
      name: seq.name,
      sequence: seq.sequence,
      originType: seq.originType,
      family: seq.family,
    })),
    ...addedGroups.flatMap((group) =>
      group.sequences.map((seq) => ({
        id: seq.id,
        name: seq.name,
        sequence: seq.sequence,
        originType: seq.originType,
        family: seq.family,
      }))
    ),
  ];

  const log = useCallback((msg: string) => {
    setEventLog((prev) => [...prev.slice(-29), `${new Date().toLocaleTimeString()}: ${msg}`]);
  }, []);

  const handleRemoveSequence = useCallback((seqId: string) => {
    dispatch(removeSequence(seqId));
    log(`Removed: ${seqId}`);
  }, [dispatch, log]);

  const handleResidueHover = useCallback((seqId: string, position: number) => {
    log(`Hover: ${seqId} @ ${position}`);
  }, [log]);

  const handleResidueClick = useCallback((seqId: string, position: number) => {
    log(`Click: ${seqId} @ ${position}`);
  }, [log]);

  const isReady = componentsLoaded && !loadingMaster && maxLength > 0;
  const addedCount = addedGroups.reduce((sum, g) => sum + g.sequences.length, 0);

  return (
    <div className="h-screen flex flex-col bg-gray-100 p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow px-4 py-2">
        <h1 className="text-lg font-semibold text-gray-800">MSA Playground</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {isReady ? `${allSequences.length} sequences (${masterSequences.length} master + ${addedCount} added)` : 'Loading...'}
          </span>
          <label className="text-sm text-gray-600 flex items-center gap-2">
            Width:
            <input
              type="range"
              min="40"
              max="80"
              value={panelWidth}
              onChange={(e) => setPanelWidth(Number(e.target.value))}
              className="w-20"
            />
            {panelWidth}%
          </label>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* MSA Panel */}
        <div
          className="bg-white rounded-lg shadow overflow-hidden"
          style={{ width: `${panelWidth}%` }}
        >
          {isReady ? (
            <MSAViewerPanel
              sequences={allSequences}
              maxLength={maxLength}
              annotations={DEMO_ANNOTATIONS}
              title="Master Alignment"
              onResidueHover={handleResidueHover}
              onResidueLeave={() => { }}
              onResidueClick={handleResidueClick}
              showToolbar={true}
              showAnnotations={true}
              compact={false}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-y-auto">
          {/* Structure loader */}
          <div className="bg-white rounded-lg shadow p-3">
            <div className="text-sm font-medium text-gray-700 mb-2">Load Structure & Align</div>
            <div className="flex gap-3">
              <div className="w-40 h-32 bg-gray-100 rounded overflow-hidden relative flex-shrink-0">
                <MolstarNode ref={molstarNodeRef} />
                {!molstarReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100/75">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <ChainAligner molstarInstance={molstarInstance} onLog={log} />
              </div>
            </div>
          </div>

          {/* Added sequences list */}
          {addedCount > 0 && (
            <div className="bg-white rounded-lg shadow p-3">
              <div className="text-sm font-medium text-gray-700 mb-2">
                Added Sequences ({addedCount})
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {addedGroups.map((group) => (
                  <div key={group.title}>
                    <div className="text-xs text-gray-500 mb-1">{group.title}</div>
                    {group.sequences.map((seq) => (
                      <div
                        key={seq.id}
                        className="flex items-center justify-between text-xs bg-gray-50 p-1.5 rounded"
                      >
                        <span className="font-mono truncate">{seq.name}</span>
                        <button
                          onClick={() => handleRemoveSequence(seq.id)}
                          className="text-red-500 hover:text-red-700 px-1 flex-shrink-0"
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

          {/* Event log */}
          <div className="flex-1 bg-white rounded-lg shadow flex flex-col min-h-[120px]">
            <div className="px-3 py-2 border-b text-sm font-medium text-gray-700 flex justify-between">
              <span>Event Log</span>
              <button
                onClick={() => setEventLog([])}
                className="text-xs text-blue-600 hover:underline"
              >
                Clear
              </button>
            </div>
            <div className="flex-1 p-2 overflow-auto">
              <pre className="text-xs font-mono text-gray-600 whitespace-pre-wrap">
                {eventLog.length === 0 ? 'Interact with the MSA viewer...' : eventLog.join('\n')}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}