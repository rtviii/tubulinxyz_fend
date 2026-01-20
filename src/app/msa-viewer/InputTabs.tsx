import { MolstarService } from '@/components/molstar/molstar_service';
import { PDBSequenceExtractor } from './components/PDBSequenceExtractor';

interface InputTabsProps {
  mainService: MolstarService | null;
  onChainAligned?: (pdbId: string, chainId: string) => void;
}

export function InputTabs({ mainService, onChainAligned }: InputTabsProps) {
  return (
    <div className="flex flex-col h-full border rounded-lg bg-white">
      <div className="p-2 border-b bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-800">Load Structure & Chains</h2>
      </div>

      <div className="flex-1 p-2 min-h-0 overflow-y-auto">
        <PDBSequenceExtractor 
          mainService={mainService}
          onChainAligned={onChainAligned}
        />
      </div>
    </div>
  );
}
