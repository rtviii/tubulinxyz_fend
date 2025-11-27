// InputTabs.tsx
import { MolstarService } from '@/components/molstar/molstar_service';
import { useSequenceStructureRegistry } from './hooks/useSequenceStructureSync';
import { PDBSequenceExtractor } from './components/PDBSequenceExtractor';

interface InputTabsProps {
  mainService: MolstarService | null;
  registry: ReturnType<typeof useSequenceStructureRegistry>;
  onMutationClick?: (pdbId: string, chainId: string, masterIndex: number) => void;
}

export function InputTabs({ 
  mainService, 
  registry,
  onMutationClick  // ← ADD THIS
}: InputTabsProps) {
  return (
    <div className="flex flex-col h-full border rounded-lg bg-white">
      <div className="p-2 border-b bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-800">Load Structure & Chains</h2>
      </div>

      <div className="flex-1 p-2 min-h-0 overflow-y-auto">
        <PDBSequenceExtractor 
          mainService={mainService}
          registry={registry}
          onMutationClick={onMutationClick}  // ← ADD THIS
        />
      </div>
    </div>
  );
}
