// src/app/msalite/LigandSelector.tsx
'use client';

import { LigandAnnotation } from './services/ligandColorService';

interface LigandSelectorProps {
  ligands: LigandAnnotation[];
  selectedIds: Set<string>;
  ligandColors: Map<string, string>;
  onToggle: (ligandId: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  isLoading: boolean;
}

export function LigandSelector({
  ligands,
  selectedIds,
  ligandColors,
  onToggle,
  onSelectAll,
  onClearAll,
  isLoading,
}: LigandSelectorProps) {
  if (isLoading) {
    return (
      <div className="text-xs text-gray-500 p-2">
        Loading ligands...
      </div>
    );
  }

  if (ligands.length === 0) {
    return (
      <div className="text-xs text-gray-500 p-2">
        No ligands available
      </div>
    );
  }

  return (
    <div className="text-xs">
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium text-gray-700">
          Ligand Binding Sites
        </span>
        <span className="text-gray-500">
          {selectedIds.size}/{ligands.length}
        </span>
      </div>

      {/* Quick actions */}
      <div className="flex gap-1 mb-2">
        <button
          onClick={onSelectAll}
          className="flex-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
        >
          All
        </button>
        <button
          onClick={onClearAll}
          className="flex-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
        >
          None
        </button>
      </div>

      {/* Ligand list */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {ligands.map(lig => {
          const isSelected = selectedIds.has(lig.ligandId);
          const color = ligandColors.get(lig.ligandId) || '#ccc';
          
          return (
            <button
              key={lig.ligandId}
              onClick={() => onToggle(lig.ligandId)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded border transition-all ${
                isSelected
                  ? 'border-gray-400 bg-white shadow-sm'
                  : 'border-transparent bg-gray-50 hover:bg-gray-100'
              }`}
            >
              {/* Color swatch */}
              <div
                className={`w-3 h-3 rounded-sm flex-shrink-0 ${
                  isSelected ? '' : 'opacity-30'
                }`}
                style={{ backgroundColor: color }}
              />
              
              {/* Name */}
              <span className={`flex-1 text-left truncate ${
                isSelected ? 'text-gray-900' : 'text-gray-500'
              }`}>
                {lig.ligandName}
              </span>
              
              {/* Position count */}
              <span className="text-gray-400 text-[10px]">
                {lig.bindingPositions.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Summary when items selected */}
      {selectedIds.size > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="text-[10px] text-gray-500">
            {(() => {
              const positions = new Set<number>();
              ligands.forEach(lig => {
                if (selectedIds.has(lig.ligandId)) {
                  lig.bindingPositions.forEach(p => positions.add(p));
                }
              });
              return `${positions.size} unique positions highlighted`;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}