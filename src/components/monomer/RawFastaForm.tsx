import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAlignSequenceMutation } from '@/store/tubxz_api';
import type { TubulinFamily } from '@/store/tubxz_api';
import { useAppDispatch } from '@/store/store';
import { addSequence, setPositionMapping } from '@/store/slices/sequence_registry';
import { parseFastaOrPlain } from '@/lib/fasta';

interface RawFastaFormProps {
  targetFamily?: string;
  onClose: () => void;
}

export function RawFastaForm({ targetFamily, onClose }: RawFastaFormProps) {
  const dispatch = useAppDispatch();
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [alignSequence, { isLoading }] = useAlignSequenceMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!targetFamily) {
      setError('No target family — open a chain in the monomer view first');
      return;
    }

    const fallback = name.trim() || `custom_${Date.now()}`;
    const parsed = parseFastaOrPlain(text, fallback);
    if ('error' in parsed) {
      setError(parsed.error);
      return;
    }

    try {
      const response = await alignSequence({
        family: targetFamily as TubulinFamily,
        alignmentRequest: {
          sequence: parsed.sequence,
          sequence_id: parsed.name,
        },
      }).unwrap();

      const id = `custom__${Date.now()}_${parsed.name.replace(/[^A-Za-z0-9_-]/g, '_')}`;
      dispatch(addSequence({
        id,
        name: parsed.name,
        sequence: response.aligned_sequence,
        originType: 'custom',
        family: targetFamily,
      }));

      if (Array.isArray(response.mapping) && response.mapping.length > 0) {
        const pm: Record<number, number> = {};
        response.mapping.forEach((authSeq, i) => {
          pm[i + 1] = authSeq;
        });
        dispatch(setPositionMapping({ sequenceId: id, mapping: pm }));
      }

      onClose();
    } catch (err: any) {
      const msg = err?.data?.detail || err?.error || err?.message || 'Alignment failed';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-2 bg-gray-50 rounded space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Name (optional if FASTA header supplied)"
          value={name}
          onChange={e => setName(e.target.value)}
          className="flex-1 px-2 py-1 text-xs border rounded"
          disabled={isLoading}
        />
      </div>
      <textarea
        placeholder={`Paste FASTA (>header\\nSEQUENCE) or plain residue letters`}
        value={text}
        onChange={e => setText(e.target.value)}
        rows={10}
        className="w-full px-2 py-1 text-xs border rounded font-mono resize-y"
        disabled={isLoading}
        spellCheck={false}
      />
      {error && <p className="text-[10px] text-red-500 leading-tight">{error}</p>}
      {isLoading && (
        <p className="text-[10px] text-blue-500 leading-tight">
          Aligning against {targetFamily?.replace('tubulin_', '') ?? 'family'} reference…
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isLoading || !text.trim() || !targetFamily}
          className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1"
        >
          {isLoading ? <Loader2 size={12} className="animate-spin" /> : 'Align & add'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
