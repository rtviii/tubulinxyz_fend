// components/CustomSequenceInput.tsx
import { useState } from 'react';
import { useSequenceStructureRegistry } from '../hooks/useSequenceStructureSync';

const API_BASE_URL = "http://localhost:8000";

interface CustomSequenceInputProps {
  registry: ReturnType<typeof useSequenceStructureRegistry>;
}

export function CustomSequenceInput({ registry }: CustomSequenceInputProps) {
  const [input, setInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    if (!input.trim()) return;

    setIsAdding(true);
    try {
      const response = await fetch(`${API_BASE_URL}/msaprofile/sequence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sequence: input.trim(),
          sequence_id: `custom_${Date.now()}`,
          annotations: []
        }),
      });

      if (!response.ok) {
        throw new Error(`Alignment failed: ${response.status}`);
      }

      const result = await response.json();
      const customId = `custom_${Date.now()}`;
      
      registry.addSequence(customId, customId, result.aligned_sequence, { type: 'custom' });
      setInput("");
    } catch (err) {
      console.error("Failed to align custom sequence:", err);
      alert(`Failed to align sequence: ${err}`);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="p-4 border-t bg-gray-50">
      <h3 className="text-md font-semibold mb-2">Add Custom Sequence</h3>
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste your amino acid sequence here (e.g., MGHIQ...)"
          className="flex-1 p-2 border rounded text-sm font-mono"
          rows={3}
        />
        <button
          onClick={handleAdd}
          disabled={isAdding || !input.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
        >
          {isAdding ? "Adding..." : "Add Sequence"}
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-1">Sequence will be aligned and added as the last row.</p>
    </div>
  );
}