'use client';
import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, ChevronRight } from 'lucide-react';

// Ligand data for the new section
const popularLigands = [
    {
        name: "Taxol (Paclitaxel)",
        chemicalId: "TA1",
        type: "Stabilizer",
        description: "Microtubule stabilizing agent used in cancer therapy",
        mechanism: "Promotes polymerization",
        color: "bg-emerald-50 border-emerald-200 text-emerald-800"
    },
    {
        name: "Colchicine",
        chemicalId: "COL",
        type: "Inhibitor",
        description: "Classical tubulin polymerization inhibitor",
        mechanism: "Prevents assembly",
        color: "bg-rose-50 border-rose-200 text-rose-800"
    },
    {
        name: "Vinblastine",
        chemicalId: "VLB",
        type: "Inhibitor",
        description: "Vinca alkaloid that disrupts microtubules",
        mechanism: "Depolymerizes MT",
        color: "bg-rose-50 border-rose-200 text-rose-800"
    },
    {
        name: "Docetaxel",
        chemicalId: "TXL",
        type: "Stabilizer",
        description: "Semi-synthetic taxane derivative",
        mechanism: "Stabilizes microtubules",
        color: "bg-emerald-50 border-emerald-200 text-emerald-800"
    }
];

// Ligand card component
const LigandCard = ({ ligand }: { ligand: typeof popularLigands[0] }) => {
    return (
        <div className={`p-5 rounded-lg border transition-all duration-200 hover:shadow-md ${ligand.color} min-h-[220px]`}>
            <div className="flex items-start justify-between mb-4">
                <h3 className="font-medium text-sm">{ligand.name}</h3>
                <span className="text-xs px-2 py-1 rounded-full bg-white/70 font-mono">
                    {ligand.type}
                </span>
            </div>

            <div className="flex flex-col items-center mb-4">
                <div className="w-24 h-24 bg-white border border-gray-200 rounded-lg overflow-hidden mb-3 flex items-center justify-center">
                    <img
                        src={`https://cdn.rcsb.org/images/ccd/labeled/${ligand.chemicalId.toUpperCase()[0]
                            }/${ligand.chemicalId.toUpperCase()}.svg`}
                        alt={`${ligand.chemicalId} chemical structure`}
                        className="w-full h-full object-contain p-1"
                    />
                </div>
            </div>

            <div className="space-y-2 text-center">
                <p className="text-xs leading-relaxed">{ligand.description}</p>
                <p className="text-xs opacity-75 italic font-medium">{ligand.mechanism}</p>
            </div>
        </div>
    );
};

// Simple choice card with better button styling
const ChoiceCard = ({
    title,
    description,
    pdbId,
    linkUrl
}: {
    title: string,
    description: string,
    pdbId: string,
    linkUrl: string
}) => {
    return (
        <Link
            href={linkUrl}
            className="group relative block rounded-xl overflow-hidden shadow-sm hover:shadow-md transform transition-all duration-300 hover:scale-[1.01] border border-gray-200 cursor-pointer bg-white h-64"
        >
            <div className="relative w-full h-full bg-white">
                <img
                    src={`/thumbnails/${pdbId}_movie.gif`}
                    alt={title}
                    className="w-full h-full object-contain transition-opacity duration-300"
                />

                {/* Content overlay - only at the bottom */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-xl font-medium text-white">{title}</h3>
                                <span className="text-xs font-mono text-gray-300 bg-black/40 px-2 py-1 rounded">
                                    {pdbId}
                                </span>
                            </div>
                            <p className="text-gray-200 text-sm leading-relaxed">{description}</p>
                        </div>
                    </div>
                </div>

                {/* Hover arrow indicator */}
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                    <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                        <ChevronRight className="h-4 w-4 text-white" />
                    </div>
                </div>
            </div>
        </Link>
    );
};

// Section header component
const SectionHeader = ({ title, children }: { title: string, children: React.ReactNode }) => {
    return (
        <div className="space-y-4">
            <div className="text-center">
                <h2 className="text-lg font-medium text-gray-900 mb-1">{title}</h2>
            </div>
            {children}
        </div>
    );
};

// Todo placeholder component
const TodoSection = () => {
    return (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
            <div className="text-gray-400 space-y-3">
                <div className="w-16 h-16 mx-auto bg-gray-100 rounded-lg flex items-center justify-center">
                    <ChevronRight className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium">Comparative Analyses</h3>
                <p className="text-sm max-w-md mx-auto">
                    Cross-structure comparisons, conformational analysis tools, and interactive comparison interfaces will be available here.
                </p>
                <div className="text-xs text-gray-400 font-mono bg-gray-50 px-3 py-1 rounded-full inline-block">
                    TODO: Implementation pending
                </div>
            </div>
        </div>
    );
};

// Simplified footer
const PageFooter = () => {
    return (
        <footer className="w-full border-t mt-16 py-8 bg-gray-50/50">
            <div className="max-w-4xl mx-auto px-6 text-center text-gray-500">
                <p className="text-xs">
                    Built with structural data from the Protein Data Bank and powered by modern web technologies.
                </p>
                <div className="mt-4 flex justify-center space-x-6 text-xs">
                    <span>University of British Columbia</span>
                    <span>•</span>
                    <span>Mol* Project</span>
                    <span>•</span>
                    <span>RCSB PDB</span>
                </div>
            </div>
        </footer>
    );
};

export default function HomePage() {
    return (
        <div className="min-h-screen bg-white font-['IBM_Plex_Sans',_sans-serif]">
            <main>
                {/* Hero Section */}
                <div className="relative pt-20 pb-16 flex items-center justify-center text-center bg-gray-50">
                    <div className="relative z-10 px-6">
                        <h1 className="text-3xl md:text-4xl font-mono font-light tracking-tight mb-3 text-gray-900">tubulin.xyz</h1>
                        <p className="text-sm md:text-base text-gray-600 max-w-2xl mx-auto mb-6 font-light">
                            An interactive interface for the atomic structure of the tubulin dimer and the microtubule lattice.
                        </p>
                        <form className="max-w-lg mx-auto" onSubmit={(e) => e.preventDefault()}>
                            <div className="relative">
                                <input
                                    type="search"
                                    placeholder="Search structures, proteins, or ligands..."
                                    className="w-full p-3 pl-10 text-sm text-gray-900 bg-white rounded-full shadow-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                                />
                                <div className="absolute top-0 left-0 h-full flex items-center pl-3">
                                    <Search className="h-4 w-4 text-gray-400" />
                                </div>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Main Content Container */}
                <div className="max-w-4xl mx-auto px-6 py-8 space-y-12">

                    {/* Structure Selection - Updated to use grid and match section width */}
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <ChoiceCard
                                title="Curved Structures"
                                description="Explore tubulin in its soluble, unpolymerized state."
                                linkUrl="/structures?conformation=curved"
                                pdbId="4O2B"
                            />
                            <ChoiceCard
                                title="Straight Structures"
                                description="Analyze tubulin conformation within microtubule lattices."
                                linkUrl="/structures?conformation=straight"
                                pdbId="5SYF"
                            />
                        </div>
                    </div>

                    {/* Ligands Section */}
                    <SectionHeader title="Popular Tubulin-Targeting Compounds">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {popularLigands.map((ligand, index) => (
                                <LigandCard key={index} ligand={ligand} />
                            ))}
                        </div>
                        <div className="text-center mt-6">
                            <Link
                                href="/ligands"
                                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                            >
                                View all ligands
                                <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </SectionHeader>

                    {/* Comparative Analyses Section */}
                    <SectionHeader title="Comparative Analyses">
                        <TodoSection />
                    </SectionHeader>

                </div>
            </main>

            <PageFooter />
        </div>
    );
}