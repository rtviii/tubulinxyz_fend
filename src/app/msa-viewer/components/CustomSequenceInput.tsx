// components/CustomSequenceInput.tsx
import { useState } from 'react';
import { useSequenceStructureRegistry } from '../hooks/useSequenceStructureSync';

const API_BASE_URL = "http://localhost:8000";

interface CustomSequenceInputProps {
  registry: ReturnType<typeof useSequenceStructureRegistry>;
}

export function CustomSequenceInput({ registry }: CustomSequenceInputProps) {
  const [input, setInput] = useState("");
  const [sequenceName, setSequenceName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!input.trim()) {
      setError("Please enter a sequence");
      return;
    }

    const cleanSequence = input.trim().toUpperCase().replace(/\s/g, '');
    const validAminoAcids = /^[ACDEFGHIKLMNPQRSTVWY]+$/;
    
    if (!validAminoAcids.test(cleanSequence)) {
      setError("Invalid sequence - please use standard amino acid letters only");
      return;
    }
    setError(null);
    setIsAdding(true);
    try {
      const customId = `custom_${Date.now()}`;
      const displayName = sequenceName.trim() || customId;
      
      const response = await fetch(`${API_BASE_URL}/msaprofile/sequence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sequence: cleanSequence,
          sequence_id: displayName,
          annotations: []
        }),
      });

      if (!response.ok) {
        throw new Error(`Alignment failed: ${response.status}`);
      }

      const result = await response.json();
      
      registry.addSequence(customId, displayName, result.aligned_sequence, { type: 'custom' });
      
      setInput("");
      setSequenceName("");
      setError(null);
    } catch (err: any) {
      console.error("Failed to align custom sequence:", err);
      setError(`Failed to align sequence: ${err.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const customSequences = registry.getCustomSequences();

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2 text-gray-800">
        Add Custom Sequence
      </h3>

      <div className="space-y-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Sequence Name (optional)
          </label>
          <input
            type="text"
            value={sequenceName}
            onChange={(e) => setSequenceName(e.target.value)}
            placeholder="e.g., MyProtein_v1"
            className="p-1.5 w-full border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all"
            disabled={isAdding}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Amino Acid Sequence
          </label>
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError(null);
              }}
              placeholder="Paste your amino acid sequence here (e.g., MGHIQ...)"
              className={`flex-1 p-1.5 border rounded-md text-sm font-mono resize-none focus:ring-1 transition-all ${
                error 
                  ? 'border-red-300 focus:ring-red-500' 
                  : 'border-gray-300 focus:ring-purple-500 focus:border-purple-500'
              }`}
              rows={3}
              disabled={isAdding}
            />
            <button
              onClick={handleAdd}
              disabled={isAdding || !input.trim()}
              className="px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium shadow-sm hover:shadow transition-all self-end"
            >
              {isAdding ? "..." : "Add"}
            </button>
          </div>
          
          {error && (
            <div className="mt-2 p-1.5 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0.0.20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-xs text-red-700">{error}</span>
            </div>
          )}
        </div>
      </div>

      {customSequences.length > 0 && (
        // Removed border, using bg and rounded
        <div className="mt-2 p-2 bg-purple-50 rounded-md">
          <div className="text-xs text-gray-600 mb-1">
            <span className="font-semibold">Added:</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {customSequences.map(seq => (
              <span 
                key={seq.id}
                className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full"
              >
                {seq.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-2">
        Sequence will be aligned and added to the alignment.
      </p>
    </div>
  );
}