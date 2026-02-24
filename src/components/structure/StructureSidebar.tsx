import { useAppSelector } from '@/store/store';
import { selectComponentState } from '@/components/molstar/state/selectors';
import { getFamilyForChain, StructureProfile } from '@/lib/profile_utils';
import { formatFamilyShort } from '@/lib/formatters';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { PolymerComponent, LigandComponent } from '@/components/molstar/core/types';
import { Eye, EyeOff, Focus, Microscope } from 'lucide-react';

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
  return (
    <div className="h-full bg-white border-r border-gray-200 p-4 overflow-y-auto">
      <h1 className="text-lg font-semibold mb-4">{loadedStructure ?? 'No Structure'}</h1>

      {error && (
        <div className="text-red-500 text-sm mb-4 p-2 bg-red-50 rounded">{error}</div>
      )}

      <section className="mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-2">Chains</h2>
        <div className="space-y-1">
          {polymerComponents.map(chain => (
            <ChainRow
              key={chain.chainId}
              chain={chain}
              instance={instance}
              family={getFamilyForChain(profile, chain.chainId)}
            />
          ))}
        </div>
      </section>

      {ligandComponents.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-gray-700 mb-2">Ligands</h2>
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

function ChainRow({
  chain,
  instance,
  family,
}: {
  chain: PolymerComponent;
  instance: MolstarInstance | null;
  family?: string;
}) {
  const componentState = useAppSelector(state =>
    selectComponentState(state, 'structure', chain.chainId)
  );
  const familyLabel = family ? formatFamilyShort(family) : null;

  return (
    <div
      className={`flex items-center justify-between py-1 px-2 rounded text-sm cursor-pointer transition-colors ${componentState.hovered ? 'bg-blue-100' : 'hover:bg-gray-100'
        }`}
      onMouseEnter={() => instance?.highlightChain(chain.chainId, true)}
      onMouseLeave={() => instance?.highlightChain(chain.chainId, false)}
      onClick={() => instance?.focusChain(chain.chainId)}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono">{chain.chainId}</span>
        {familyLabel && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
            {familyLabel}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={e => { e.stopPropagation(); instance?.enterMonomerView(chain.chainId); }}
          className="p-1 text-gray-400 hover:text-blue-600"
          title="Open monomer view"
        >
          <Microscope size={14} />
        </button>
        <button
          onClick={e => { e.stopPropagation(); instance?.focusChain(chain.chainId); }}
          className="p-1 text-gray-400 hover:text-gray-700"
        >
          <Focus size={14} />
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            instance?.setChainVisibility(chain.chainId, !componentState.visible);
          }}
          className="p-1 text-gray-400 hover:text-gray-700"
        >
          {componentState.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>
    </div>
  );
}

function LigandRow({
  ligand,
  instance,
}: {
  ligand: LigandComponent;
  instance: MolstarInstance | null;
}) {
  const componentState = useAppSelector(state =>
    selectComponentState(state, 'structure', ligand.uniqueKey)
  );

  return (
    <div
      className={`flex items-center justify-between py-1 px-2 rounded text-sm cursor-pointer transition-colors ${componentState.hovered ? 'bg-blue-100' : 'hover:bg-gray-100'
        }`}
      onMouseEnter={() => instance?.highlightLigand(ligand.uniqueKey, true)}
      onMouseLeave={() => instance?.highlightLigand(ligand.uniqueKey, false)}
      onClick={() => instance?.focusLigand(ligand.uniqueKey)}
    >
      <span className="font-mono text-xs">
        {ligand.compId} ({ligand.authAsymId}:{ligand.authSeqId})
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={e => { e.stopPropagation(); instance?.focusLigand(ligand.uniqueKey); }}
          className="p-1 text-gray-400 hover:text-gray-700"
        >
          <Focus size={14} />
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            instance?.setLigandVisibility(ligand.uniqueKey, !componentState.visible);
          }}
          className="p-1 text-gray-400 hover:text-gray-700"
        >
          {componentState.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>
    </div>
  );
}