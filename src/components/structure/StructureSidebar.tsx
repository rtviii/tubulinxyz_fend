// src/components/structure/StructureSidebar.tsx
import { Eye, EyeOff, Focus, Microscope } from 'lucide-react';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { PolymerComponent, LigandComponent } from '@/components/molstar/core/types';
import type { StructureProfile } from './types'; // Define this shared type
import { useAppSelector } from '@/store/store';
import { selectComponentState } from '@/components/molstar/state/selectors';

interface StructureSidebarProps {
  loadedStructure: string | null;
  polymerComponents: PolymerComponent[];
  ligandComponents: LigandComponent[];
  instance: MolstarInstance | null;
  error: string | null;
  profile: StructureProfile | null;
}

export function StructureSidebar({
  loadedStructure,
  polymerComponents,
  ligandComponents,
  instance,
  error,
  profile,
}: StructureSidebarProps) {
  
  const getFamilyForChain = (chainId: string): string | undefined => {
    if (!profile) return undefined;
    const poly = profile.polypeptides.find(p => p.auth_asym_id === chainId);
    if (!poly) return undefined;
    return profile.entities[poly.entity_id]?.family;
  };

  return (
    <div className="h-full bg-white border-r border-gray-200 p-4 overflow-y-auto">
      <h1 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
         {loadedStructure ?? 'No Structure'}
      </h1>

      {error && (
        <div className="text-red-500 text-sm mb-4 p-3 bg-red-50 border border-red-100 rounded-md">
           {error}
        </div>
      )}

      <section className="mb-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Chains</h2>
        <div className="space-y-1">
          {polymerComponents.map(chain => (
            <ChainRow
              key={chain.chainId}
              chain={chain}
              instance={instance}
              family={getFamilyForChain(chain.chainId)}
            />
          ))}
        </div>
      </section>

      {ligandComponents.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ligands</h2>
          <div className="space-y-1">
            {ligandComponents.map(ligand => (
              <LigandRow key={ligand.uniqueKey} ligand={ligand} instance={instance} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ChainRow({ chain, instance, family }: { chain: PolymerComponent; instance: MolstarInstance | null; family?: string }) {
  const componentState = useAppSelector(state => selectComponentState(state, 'structure', chain.chainId));
  
  // Format family name nicely
  const familyLabel = family ? family.replace(/^(tubulin_|map_)/, '').toUpperCase() : null;

  return (
    <div
      className={`flex items-center justify-between py-1.5 px-2 rounded-md text-sm cursor-pointer transition-colors ${
        componentState.hovered ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
      }`}
      onMouseEnter={() => instance?.highlightChain(chain.chainId, true)}
      onMouseLeave={() => instance?.highlightChain(chain.chainId, false)}
      onClick={() => instance?.focusChain(chain.chainId)}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono font-bold bg-gray-100 px-1.5 rounded text-gray-600">{chain.chainId}</span>
        {familyLabel && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
            {familyLabel}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); instance?.enterMonomerView(chain.chainId); }}
          className="p-1 text-gray-400 hover:text-purple-600"
          title="Open Monomer View"
        >
          <Microscope size={14} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); instance?.setChainVisibility(chain.chainId, !componentState.visible); }}
          className="p-1 text-gray-400 hover:text-gray-700"
        >
          {componentState.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>
    </div>
  );
}

function LigandRow({ ligand, instance }: { ligand: LigandComponent; instance: MolstarInstance | null }) {
  const componentState = useAppSelector(state => selectComponentState(state, 'structure', ligand.uniqueKey));

  return (
    <div
      className={`group flex items-center justify-between py-1.5 px-2 rounded-md text-sm cursor-pointer transition-colors ${
        componentState.hovered ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-gray-100 text-gray-700'
      }`}
      onMouseEnter={() => instance?.highlightLigand(ligand.uniqueKey, true)}
      onMouseLeave={() => instance?.highlightLigand(ligand.uniqueKey, false)}
      onClick={() => instance?.focusLigand(ligand.uniqueKey)}
    >
      <div className="flex items-center gap-2">
         <span className="font-mono font-bold">{ligand.compId}</span>
         <span className="text-xs text-gray-400">
           {ligand.authAsymId}:{ligand.authSeqId}
         </span>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); instance?.focusLigand(ligand.uniqueKey); }}
          className="p-1 text-gray-400 hover:text-emerald-600"
        >
          <Focus size={14} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); instance?.setLigandVisibility(ligand.uniqueKey, !componentState.visible); }}
          className="p-1 text-gray-400 hover:text-gray-700"
        >
          {componentState.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>
    </div>
  );
}