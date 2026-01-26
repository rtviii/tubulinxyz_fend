// src/components/debug/LigandDebug.tsx
'use client';

import { useGetPolymerLigandNeighborhoodsQuery } from '@/store/tubxz_api';

export function LigandDebug({ rcsbId, authAsymId }: { rcsbId: string; authAsymId: string }) {
  const { data, error, isLoading } = useGetPolymerLigandNeighborhoodsQuery(
    { rcsbId, authAsymId },
    { skip: !rcsbId || !authAsymId }
  );

  if (isLoading) return <div>Loading ligand data...</div>;
  if (error) return <div>Error: {JSON.stringify(error)}</div>;
  if (!data) return <div>No data</div>;

  return (
    <div style={{ fontFamily: 'monospace', fontSize: '12px', background: '#f5f5f5', padding: '10px' }}>
      <h3>Raw Ligand API Response for {rcsbId}:{authAsymId}</h3>
      <pre>{JSON.stringify(data, null, 2)}</pre>
      
      <h4>Processed Neighborhoods:</h4>
      <ul>
        {(data.neighborhoods || []).map((n, i) => (
          <li key={i}>
            <strong>{n.ligand_id}</strong> ({n.ligand_name}) - 
            Chain {n.ligand_auth_asym_id}:{n.ligand_auth_seq_id} -
            {n.residues?.length || 0} residues
            <div style={{ marginLeft: '20px' }}>
              Residues: {n.residues?.map(r => `${r.auth_asym_id}:${r.observed_index}`).join(', ')}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}