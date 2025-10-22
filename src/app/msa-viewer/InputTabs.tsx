// InputTabs.tsx
import { useState } from 'react';
import { MolstarService } from '@/components/molstar/molstar_service';
import { useSequenceStructureRegistry } from './hooks/useSequenceStructureSync';
import { PDBSequenceExtractor } from './components/PDBSequenceExtractor';
import { CustomSequenceInput } from './components/CustomSequenceInput';

interface InputTabsProps {
  mainService: MolstarService | null;
  auxiliaryService: MolstarService | null;
  registry: ReturnType<typeof useSequenceStructureRegistry>;
}

export function InputTabs({ mainService, auxiliaryService, registry }: InputTabsProps) {
  const [activeTab, setActiveTab] = useState<'pdb' | 'custom'>('pdb');

  const getButtonClass = (tabName: 'pdb' | 'custom') => {
    const isActive = activeTab === tabName;
    return `flex-1 py-2 px-4 text-sm font-medium text-center rounded-t-lg transition-colors
            ${isActive
              ? 'bg-white border-b-0 border-gray-300 border-l border-t border-r text-blue-600'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-600 cursor-pointer'
            }`;
  };

  return (
    <div className="flex flex-col h-full border rounded-lg bg-white">
      <div className="flex border-b border-gray-300">
        <button
          onClick={() => setActiveTab('pdb')}
          className={getButtonClass('pdb')}
        >
          Load Structure & Chains
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={getButtonClass('custom')}
        >
          Add Custom Sequence
        </button>
      </div>

      <div className="flex-1 p-2 min-h-0 overflow-y-auto">
        {activeTab === 'pdb' && (
          <PDBSequenceExtractor 
            mainService={mainService}
            auxiliaryService={auxiliaryService}
            registry={registry} 
          />
        )}
        {activeTab === 'custom' && (
          <CustomSequenceInput registry={registry} />
        )}
      </div>
    </div>
  );
}