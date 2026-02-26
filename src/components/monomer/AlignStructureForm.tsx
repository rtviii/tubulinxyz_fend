import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useChainAlignment } from '@/hooks/useChainAlignment';
import { useGetStructureProfileQuery } from '@/store/tubxz_api';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';

interface AlignStructureFormProps {
  targetChainId: string;
  instance: MolstarInstance | null;
  targetFamily?: string;
  masterLength: number;
  onClose: () => void;
}

export function AlignStructureForm({
  targetChainId,
  instance,
  targetFamily,
  masterLength,
  onClose,
}: AlignStructureFormProps) {
  const [sourcePdbId, setSourcePdbId] = useState('');
  const [sourceChainId, setSourceChainId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // We only fetch the source profile after the user submits, so track
  // a "committed" PDB ID separately from the text input.
  const [committedPdbId, setCommittedPdbId] = useState<string | null>(null);

  const { alignChainFromProfile } = useChainAlignment();

  const {
    data: sourceProfile,
    isLoading: profileLoading,
    error: profileError,
  } = useGetStructureProfileQuery(
    { rcsbId: committedPdbId! },
    { skip: !committedPdbId }
  );

  // Once the profile arrives (or errors), drive the alignment to completion.
  useEffect(() => {
    if (!committedPdbId || !loading) return;

    if (profileError) {
      setError(
        'Could not fetch profile for ' + committedPdbId +
        '. Make sure it has been ingested.'
      );
      setLoading(false);
      setCommittedPdbId(null);
      return;
    }

    if (!sourceProfile) return;

    const chainId = sourceChainId.trim().toUpperCase();
    const result = alignChainFromProfile(sourceProfile, chainId, masterLength);

    if (!result) {
      setError(
        `No alignment mapping found for chain ${chainId} in ${committedPdbId}. ` +
        `The chain may not be a classified tubulin.`
      );
    } else if (instance && targetChainId) {
      // Find the family from the source profile and restyle the aligned chain
      const poly = sourceProfile.polypeptides?.find(p => p.auth_asym_id === chainId);
      const entity = poly ? sourceProfile.entities?.[poly.entity_id] : null;
      const family = entity && 'family' in entity ? (entity as any).family : undefined;

      if (family) {
        const alignedId = `${committedPdbId}_${chainId}_on_${targetChainId}`;
        instance.styleAlignedChainAsGhost(targetChainId, alignedId, family);
      }
    }

    setLoading(false);
    setCommittedPdbId(null);
    if (result) onClose();
  }, [
    sourceProfile, profileError, committedPdbId, loading,
    sourceChainId, masterLength, alignChainFromProfile, onClose,
    instance, targetChainId,
  ]);;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pdbId = sourcePdbId.trim().toUpperCase();
    const chainId = sourceChainId.trim().toUpperCase();
    if (!instance || !pdbId || !chainId) return;

    setLoading(true);
    setError(null);

    try {
      // Step 1: 3D superposition (this already works)
      const ok = await instance.loadAlignedStructure(targetChainId, pdbId, chainId);
      if (!ok) {
        setError('Failed to load or align structure in 3D');
        setLoading(false);
        return;
      }

      // Step 2: Kick off profile fetch for MSA registration.
      // The useEffect above handles the rest once data arrives.
      setCommittedPdbId(pdbId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error during alignment');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-2 bg-gray-50 rounded space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="PDB ID"
          value={sourcePdbId}
          onChange={e => setSourcePdbId(e.target.value)}
          className="flex-1 px-2 py-1 text-xs border rounded"
          disabled={loading}
        />
        <input
          type="text"
          placeholder="Chain"
          value={sourceChainId}
          onChange={e => setSourceChainId(e.target.value)}
          className="w-16 px-2 py-1 text-xs border rounded"
          disabled={loading}
        />
      </div>
      {error && <p className="text-[10px] text-red-500 leading-tight">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading || !sourcePdbId.trim() || !sourceChainId.trim()}
          className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : 'Align'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}