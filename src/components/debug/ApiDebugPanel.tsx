// src/components/debug/ApiDebugPanel.tsx
'use client';

import { useState } from 'react';
import {
  useListStructuresQuery,
  useGetStructureFacetsQuery,
  useListPolymersQuery,
  useListLigandsQuery,
  useGetStructureQuery,
  useGetStructureProfileQuery,
  useGetPolymerAnnotationsQuery,
  useGetPolymerLigandNeighborhoodsQuery,
  useGetVariantsAtPositionQuery,
  useGetMasterProfileQuery,
} from '@/store/tubxz_api';

type QueryKey = 
  | 'structures' | 'facets' | 'polymers' | 'ligands' 
  | 'structure' | 'profile' | 'polymer_annotations' 
  | 'ligand_neighborhoods' | 'variants_at_position' | 'master_profile';

export function ApiDebugPanel() {
  const [activeQuery, setActiveQuery] = useState<QueryKey | null>(null);
  const [params, setParams] = useState({
    rcsbId: '7SJ7',
    authAsymId: 'A',
    family: 'tubulin_alpha',
    position: 250,
  });

  // Queries - only fetch when active
  const structures         = useListStructuresQuery({ limit: 5 }, { skip: activeQuery !== 'structures' });
  const facets             = useGetStructureFacetsQuery(undefined, { skip: activeQuery !== 'facets' });
  const polymers           = useListPolymersQuery({ limit: 5 }, { skip: activeQuery !== 'polymers' });
  const ligands            = useListLigandsQuery({ limit: 5 }, { skip: activeQuery !== 'ligands' });
  const structure          = useGetStructureQuery({ rcsbId: params.rcsbId }, { skip: activeQuery !== 'structure' });
  const profile            = useGetStructureProfileQuery({ rcsbId: params.rcsbId }, { skip: activeQuery !== 'profile' });
  const polymerAnnotations = useGetPolymerAnnotationsQuery(
    { rcsbId: params.rcsbId, authAsymId: params.authAsymId },
    { skip: activeQuery !== 'polymer_annotations' }
  );
  const ligandNeighborhoods = useGetPolymerLigandNeighborhoodsQuery(
    { rcsbId: params.rcsbId, authAsymId: params.authAsymId },
    { skip: activeQuery !== 'ligand_neighborhoods' }
  );
  const variantsAtPosition = useGetVariantsAtPositionQuery(
    { family: params.family, position: params.position },
    { skip: activeQuery !== 'variants_at_position' }
  );
  const masterProfile = useGetMasterProfileQuery(undefined, { skip: activeQuery !== 'master_profile' });

  const getQueryData = () => {
    const queries: Record<QueryKey, { data: any; isLoading: boolean; error: any }> = {
      structures, facets, polymers, ligands, structure, profile,
      polymer_annotations: polymerAnnotations,
      ligand_neighborhoods: ligandNeighborhoods,
      variants_at_position: variantsAtPosition,
      master_profile: masterProfile,
    };
    return activeQuery ? queries[activeQuery] : null;
  };

  const currentQuery = getQueryData();

  return (
    <div className="p-4 bg-gray-900 text-gray-100 rounded-lg max-w-4xl">
      <h2 className="text-lg font-bold mb-4">API Debug Panel</h2>
      
      {/* Param inputs */}
      <div className="grid grid-cols-4 gap-2 mb-4 text-sm">
        <input
          className="px-2 py-1 bg-gray-800 rounded"
          placeholder="RCSB ID"
          value={params.rcsbId}
          onChange={e => setParams(p => ({ ...p, rcsbId: e.target.value.toUpperCase() }))}
        />
        <input
          className="px-2 py-1 bg-gray-800 rounded"
          placeholder="Chain ID"
          value={params.authAsymId}
          onChange={e => setParams(p => ({ ...p, authAsymId: e.target.value }))}
        />
        <input
          className="px-2 py-1 bg-gray-800 rounded"
          placeholder="Family"
          value={params.family}
          onChange={e => setParams(p => ({ ...p, family: e.target.value }))}
        />
        <input
          className="px-2 py-1 bg-gray-800 rounded"
          placeholder="Position"
          type="number"
          value={params.position}
          onChange={e => setParams(p => ({ ...p, position: parseInt(e.target.value) || 0 }))}
        />
      </div>

      {/* Query buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {([
          ['structures', 'List Structures'],
          ['facets', 'Get Facets'],
          ['polymers', 'List Polymers'],
          ['ligands', 'List Ligands'],
          ['structure', 'Get Structure'],
          ['profile', 'Get Profile'],
          ['polymer_annotations', 'Polymer Annotations'],
          ['ligand_neighborhoods', 'Ligand Neighborhoods'],
          ['variants_at_position', 'Variants @ Position'],
          ['master_profile', 'Master Profile'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setActiveQuery(key);
              console.log(`[ApiDebug] Fetching: ${key}`);
            }}
            className={`px-3 py-1.5 text-xs rounded font-medium transition-colors ${
              activeQuery === key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Results */}
      {currentQuery && (
        <div className="bg-gray-800 rounded p-3">
          <div className="flex items-center gap-2 mb-2 text-xs">
            <span className="font-mono text-gray-400">{activeQuery}</span>
            {currentQuery.isLoading && <span className="text-yellow-400">Loading...</span>}
            {currentQuery.error && <span className="text-red-400">Error</span>}
            {currentQuery.data && <span className="text-green-400">OK</span>}
          </div>
          
          {currentQuery.data && (
            <>
              <button
                onClick={() => console.log(`[ApiDebug] ${activeQuery}:`, currentQuery.data)}
                className="mb-2 px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600"
              >
                Log to Console
              </button>
              <pre className="text-xs overflow-auto max-h-96 text-gray-300">
                {JSON.stringify(currentQuery.data, null, 2).slice(0, 3000)}
                {JSON.stringify(currentQuery.data).length > 3000 && '\n... (truncated, see console)'}
              </pre>
            </>
          )}

          {currentQuery.error && (
            <pre className="text-xs text-red-300">
              {JSON.stringify(currentQuery.error, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}