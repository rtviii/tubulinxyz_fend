'use client';
import React, { useState } from 'react';
import { FlaskConical, Dna, Zap } from 'lucide-react';
import { researchDummyData } from './data';

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

const StructurePill = ({ pdbId, color }: { pdbId: string; color: string }) => (
  <span
    className={`inline-block px-2 py-0.5 text-xs font-mono font-semibold rounded-full text-white ${color}`}
  >
    {pdbId}
  </span>
);

const LigandRow = ({ ligand }: { ligand: typeof researchDummyData.ligands[0] }) => (
  <div className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-sm transition-colors">
    <div className="flex items-center space-x-3">
      <div className="text-lg font-bold text-gray-800 font-mono">
        {ligand.code}
      </div>
      <div className="flex flex-col space-y-1">
        <StructurePill pdbId={ligand.parentStructure} color={ligand.structureColor} />
        <span className="text-xs text-gray-600">{ligand.description}</span>
      </div>
    </div>
  </div>
);

const MutationRow = ({ mutation }: { mutation: typeof researchDummyData.mutations[0] }) => (
  <div className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-sm transition-colors">
    <div className="flex items-center space-x-3">
      <div className="text-sm font-bold text-gray-800 font-mono">
        {mutation.positions.join(', ')}
      </div>
      <div className="flex flex-col space-y-1">
        <StructurePill pdbId={mutation.parentStructure} color={mutation.structureColor} />
        <span className="text-xs text-gray-600">{mutation.description}</span>
      </div>
    </div>
  </div>
);

const PTMRow = ({ ptm }: { ptm: typeof researchDummyData.ptms[0] }) => (
  <div className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-sm transition-colors">
    <div className="flex items-center space-x-3">
      <div className="text-sm font-semibold text-gray-800">
        {ptm.type}
      </div>
      <div className="flex flex-col space-y-1">
        <StructurePill pdbId={ptm.parentStructure} color={ptm.structureColor} />
        <span className="text-xs text-gray-600">{ptm.description}</span>
      </div>
    </div>
  </div>
);

export const ResearchPanel = () => {
  const [activeTab, setActiveTab] = useState<TabType>('ligands');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'ligands':
        return (
          <div className="space-y-1">
            {researchDummyData.ligands.map((ligand, index) => (
              <LigandRow key={index} ligand={ligand} />
            ))}
          </div>
        );
      case 'mutations':
        return (
          <div className="space-y-1">
            {researchDummyData.mutations.map((mutation, index) => (
              <MutationRow key={index} mutation={mutation} />
            ))}
          </div>
        );
      case 'ptms':
        return (
          <div className="space-y-1">
            {researchDummyData.ptms.map((ptm, index) => (
              <PTMRow key={index} ptm={ptm} />
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-80 h-full bg-gray-50 border-l border-gray-200 flex flex-col">
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
            {activeTab === 'ligands' && 'Known Ligands'}
            {activeTab === 'mutations' && 'Known Mutations'}
            {activeTab === 'ptms' && 'Post-Translational Modifications'}
          </h3>
          {renderTabContent()}
        </div>
      </div>

      {/* Footer with count */}
      <div className="px-3 py-2 bg-gray-100 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          {activeTab === 'ligands' && `${researchDummyData.ligands.length} ligands`}
          {activeTab === 'mutations' && `${researchDummyData.mutations.length} mutations`}
          {activeTab === 'ptms' && `${researchDummyData.ptms.length} modifications`}
        </p>
      </div>
    </div>
  );
};