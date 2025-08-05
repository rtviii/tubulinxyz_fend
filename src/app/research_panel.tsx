'use client';
import React, { useState, useContext } from 'react';
import { FlaskConical, Dna, Zap, Info } from 'lucide-react';
import { processResearchData, ProcessedLigandData, ProcessedMutationData, ProcessedPTMData } from './research_panel_tubdb_processor';
import { MolstarContext } from '@/components/molstar/molstar_service';
import { useAppDispatch } from '@/store/store';
import { selectStructure, setLoading, setError } from '@/store/slices/tubulin_structures';
import { fetchRcsbGraphQlData } from '@/services/rcsb_graphql_service';
import { createTubulinClassificationMap } from '@/services/gql_parser';

type TabType = 'ligands' | 'mutations' | 'ptms';

interface TabButtonProps {
  id: TabType;
  active: boolean;
  onClick: (id: TabType) => void;
  children: React.ReactNode;
}

const TabButton = ({ id, active, onClick, children }: TabButtonProps) => (
  <button
    onClick={() => onClick(id)}
    className={`flex items-center space-x-1 px-3 py-2 text-xs font-medium rounded-t-md transition-colors ${active
        ? 'bg-white text-gray-900 border-t border-l border-r border-gray-200'
        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
  >
    {children}
  </button>
);

interface ClickablePDBPillProps {
  pdbId: string;
  onLoadStructure: (pdbId: string) => void;
}

const ClickablePDBPill = ({ pdbId, onLoadStructure }: ClickablePDBPillProps) => {
  if (pdbId === 'N/A') {
    return (
      <span className="inline-block px-1.5 py-0.5 text-xs font-mono font-medium rounded bg-gray-200 text-gray-500">
        N/A
      </span>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onLoadStructure(pdbId);
      }}
      className="inline-block px-1.5 py-0.5 text-xs font-mono font-semibold rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors cursor-pointer"
      title={`Load structure ${pdbId}`}
    >
      {pdbId}
    </button>
  );
};

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
}

const Tooltip = ({ children, content }: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>
      {isVisible && (
        <div className="absolute bottom-full left-0 mb-2 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-50 w-64 pointer-events-none">
          {content}
          <div className="absolute top-full left-2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};

const LigandRow = ({ ligand, onLoadStructure }: { ligand: ProcessedLigandData; onLoadStructure: (pdbId: string) => void }) => (
  <div className="py-2 px-3 hover:bg-gray-50 rounded-sm transition-colors">
    <div className="flex items-start justify-between">
      <div className="flex items-center space-x-3 flex-1">
        <div className="flex flex-col items-center">
          <div className="text-lg font-bold text-blue-700 font-mono">
            {ligand.ligandName}
          </div>
          <div className="text-xs text-gray-500 font-mono">
            {ligand.positions.join(', ')}
          </div>
        </div>
        <div className="flex flex-col space-y-1 flex-1">
          <div className="flex items-center space-x-2">
            <ClickablePDBPill pdbId={ligand.pdbId} onLoadStructure={onLoadStructure} />
            <span className="text-xs text-gray-600 italic">{ligand.species}</span>
          </div>
          <span className="text-xs text-gray-700 line-clamp-2">{ligand.description}</span>
        </div>
      </div>
      <Tooltip
        content={
          <div className="space-y-2">
            <div><strong>Positions:</strong> {ligand.aa3Notation.join(', ')}</div>
            <div><strong>Species:</strong> {ligand.species}</div>
            <div><strong>Reference:</strong> {ligand.reference}</div>
            <div><strong>Keywords:</strong> {ligand.keywords}</div>
            {ligand.notes && <div><strong>Notes:</strong> {ligand.notes}</div>}
          </div>
        }
      >
        <Info size={14} className="text-gray-400 hover:text-gray-600 cursor-help flex-shrink-0" />
      </Tooltip>
    </div>
  </div>
);

const MutationRow = ({ mutation, onLoadStructure }: { mutation: ProcessedMutationData; onLoadStructure: (pdbId: string) => void }) => (
  <div className="py-2 px-3 hover:bg-gray-50 rounded-sm transition-colors">
    <div className="flex items-start justify-between">
      <div className="flex items-center space-x-3 flex-1">
        <div className="flex flex-col items-center">
          <div className="text-sm font-bold text-red-700 font-mono">
            {mutation.positions.map((pos, idx) => `${mutation.originalAA[idx]}${pos}${mutation.mutatedAA[idx]}`).join(', ')}
          </div>
          <div className="text-xs text-gray-500">
            {mutation.positions.join(', ')}
          </div>
        </div>
        <div className="flex flex-col space-y-1 flex-1">
          <div className="flex items-center space-x-2">
            <ClickablePDBPill pdbId={mutation.pdbId} onLoadStructure={onLoadStructure} />
            <span className="text-xs text-gray-600 italic">{mutation.species}</span>
          </div>
          <span className="text-xs text-gray-700 line-clamp-2">{mutation.phenotype}</span>
        </div>
      </div>
      <Tooltip
        content={
          <div className="space-y-2">
            <div><strong>Positions:</strong> {mutation.aa3Notation.join(', ')}</div>
            <div><strong>Species:</strong> {mutation.species}</div>
            <div><strong>Phenotype:</strong> {mutation.phenotype}</div>
            <div><strong>Reference:</strong> {mutation.reference}</div>
            <div><strong>Keywords:</strong> {mutation.keywords}</div>
            {mutation.uniprotId && <div><strong>UniProt:</strong> {mutation.uniprotId}</div>}
            {mutation.notes && <div><strong>Notes:</strong> {mutation.notes}</div>}
          </div>
        }
      >
        <Info size={14} className="text-gray-400 hover:text-gray-600 cursor-help flex-shrink-0" />
      </Tooltip>
    </div>
  </div>
);

const PTMRow = ({ ptm, onLoadStructure }: { ptm: ProcessedPTMData; onLoadStructure: (pdbId: string) => void }) => (
  <div className="py-2 px-3 hover:bg-gray-50 rounded-sm transition-colors">
    <div className="flex items-start justify-between">
      <div className="flex items-center space-x-3 flex-1">
        <div className="flex flex-col items-center">
          <div className="text-sm font-bold text-purple-700">
            {ptm.modificationName}
          </div>
          <div className="text-xs text-gray-500 font-mono">
            {ptm.positions.map((pos, idx) => `${ptm.originalAA[idx]}${pos}`).join(', ')}
          </div>
        </div>
        <div className="flex flex-col space-y-1 flex-1">
          <div className="flex items-center space-x-2">
            <ClickablePDBPill pdbId={ptm.pdbId} onLoadStructure={onLoadStructure} />
            <span className="text-xs text-gray-600 italic">{ptm.species}</span>
          </div>
          <span className="text-xs text-gray-700 line-clamp-2">{ptm.phenotype}</span>
        </div>
      </div>
      <Tooltip
        content={
          <div className="space-y-2">
            <div><strong>Type:</strong> {ptm.modificationName} ({ptm.modificationType})</div>
            <div><strong>Positions:</strong> {ptm.aa3Notation.join(', ')}</div>
            <div><strong>Species:</strong> {ptm.species}</div>
            <div><strong>Phenotype:</strong> {ptm.phenotype}</div>
            {ptm.database && <div><strong>Database:</strong> {ptm.database}</div>}
            {ptm.reference && <div><strong>Reference:</strong> {ptm.reference}</div>}
            <div><strong>Keywords:</strong> {ptm.keywords}</div>
            {ptm.uniprotId && <div><strong>UniProt:</strong> {ptm.uniprotId}</div>}
            {ptm.notes && <div><strong>Notes:</strong> {ptm.notes}</div>}
          </div>
        }
      >
        <Info size={14} className="text-gray-400 hover:text-gray-600 cursor-help flex-shrink-0" />
      </Tooltip>
    </div>
  </div>
);

export const ResearchPanel = () => {
  const [activeTab, setActiveTab] = useState<TabType>('ligands');
  const molstarService = useContext(MolstarContext)?.getService('main');
  const dispatch = useAppDispatch();

  // Process the research data
  const researchData = processResearchData();

  const handleLoadStructure = async (pdbId: string) => {
    if (!molstarService?.controller || pdbId === 'N/A') return;

    dispatch(selectStructure(pdbId));
    dispatch(setLoading(true));
    dispatch(setError(null));

    try {
      const gqlData = await fetchRcsbGraphQlData(pdbId);
      const classificationMap = createTubulinClassificationMap(gqlData);
      await molstarService.controller.loadStructure(pdbId, classificationMap);
      await molstarService.viewer.representations.stylized_lighting();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      dispatch(setError(errorMessage));
    } finally {
      dispatch(setLoading(false));
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'ligands':
        return (
          <div className="space-y-1">
            {researchData.ligands.map((ligand) => (
              <LigandRow key={ligand.id} ligand={ligand} onLoadStructure={handleLoadStructure} />
            ))}
          </div>
        );
      case 'mutations':
        return (
          <div className="space-y-1">
            {researchData.mutations.map((mutation) => (
              <MutationRow key={mutation.id} mutation={mutation} onLoadStructure={handleLoadStructure} />
            ))}
          </div>
        );
      case 'ptms':
        return (
          <div className="space-y-1">
            {researchData.ptms.map((ptm) => (
              <PTMRow key={ptm.id} ptm={ptm} onLoadStructure={handleLoadStructure} />
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-96 h-full bg-gray-50 border-l border-gray-200 flex flex-col">
      {/* Tab Headers */}
      <div className="flex border-b border-gray-200 bg-gray-100 px-2 pt-2">
        <TabButton
          id="ligands"
          active={activeTab === 'ligands'}
          onClick={setActiveTab}
        >
          <FlaskConical size={12} />
          <span>Ligands</span>
        </TabButton>
        <TabButton
          id="mutations"
          active={activeTab === 'mutations'}
          onClick={setActiveTab}
        >
          <Dna size={12} />
          <span>Mutations</span>
        </TabButton>
        <TabButton
          id="ptms"
          active={activeTab === 'ptms'}
          onClick={setActiveTab}
        >
          <Zap size={12} />
          <span>PTMs</span>
        </TabButton>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="p-2">
          <h3 className="text-sm font-semibold text-gray-800 mb-3 px-1">
            {activeTab === 'ligands' && 'Known Ligand Interactions'}
            {activeTab === 'mutations' && 'Disease Mutations'}
            {activeTab === 'ptms' && 'Post-Translational Modifications'}
          </h3>
          {renderTabContent()}
        </div>
      </div>

      {/* Footer with count and instructions */}
      <div className="px-3 py-2 bg-gray-100 border-t border-gray-200">
        <p className="text-xs text-gray-500 mb-1">
          {activeTab === 'ligands' && `${researchData.ligands.length} ligand interactions`}
          {activeTab === 'mutations' && `${researchData.mutations.length} mutations`}
          {activeTab === 'ptms' && `${researchData.ptms.length} modifications`}
        </p>
        <p className="text-xs text-gray-400">
          <Info size={10} className="inline mr-1" />
          Hover for details • Click PDB ID to load
        </p>
      </div>
    </div>
  );
};;