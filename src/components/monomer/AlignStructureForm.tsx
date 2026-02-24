import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';

interface AlignStructureFormProps {
  targetChainId: string;
  instance: MolstarInstance | null;
  targetFamily?: string;
  alignChain: (
    pdbId: string,
    chainId: string,
    inst: MolstarInstance,
    family?: string
  ) => Promise<any>;
  onClose: () => void;
}

export function AlignStructureForm({
  targetChainId,
  instance,
  targetFamily,
  alignChain,
  onClose,
}: AlignStructureFormProps) {
  const [sourcePdbId, setSourcePdbId] = useState('');
  const [sourceChainId, setSourceChainId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pdbId = sourcePdbId.trim().toUpperCase();
    const chainId = sourceChainId.trim().toUpperCase();
    if (!instance || !pdbId || !chainId) return;

    setLoading(true);
    setError(null);

    try {
      const ok = await instance.loadAlignedStructure(targetChainId, pdbId, chainId);
      if (ok) {
        await alignChain(pdbId, chainId, instance, targetFamily);
        onClose();
      } else {
        setError('Failed to load or align structure in 3D');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error during alignment');
    } finally {
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