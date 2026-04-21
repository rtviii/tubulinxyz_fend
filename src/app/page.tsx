'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Home, LayoutGrid, Mail, ChevronDown, Maximize2, Minimize2 } from 'lucide-react';
import LandingViewer from '@/app/landing/LandingViewer';
import { useExistingInstance } from '@/components/molstar/services/MolstarInstanceManager';
import { LANDING_DEMOS, DEMO_CATEGORY_LABELS, type DemoCategory, type DemoResult } from '@/app/landing/demos';
import { DemoExplanationCard, type DemoExplanation } from '@/app/landing/DemoExplanationCard';
import { AppPill, PillDivider, PillSection, PillNavLink, PillAnchor } from '@/components/ui/AppPill';

const STRUCTURES = [
  {
    pdbId: '9MLF',
    instanceId: 'landing_9mlf' as const,
    type: 'Heterodimer',
    description:
      'Alpha-beta tubulin dimer from a stathmin complex, straight conformation.',
    citation: '',
    chainFilter: ['A', 'B'],
  },
  {
    pdbId: '6WVM',
    instanceId: 'landing_6wvm' as const,
    type: 'Microtubule lattice',
    description:
      'Tubulin from a 13-protofilament taxol-stabilized microtubule, protofilament-level refinement.',
    citation: 'Cook et al., 2020',
  },
];

// Group demos by category
const DEMOS_BY_CATEGORY = LANDING_DEMOS.reduce((acc, demo) => {
  (acc[demo.category] ??= []).push(demo);
  return acc;
}, {} as Record<DemoCategory, typeof LANDING_DEMOS>);

export default function Page() {
  const [spinning, setSpinning] = useState(true);
  const [showLigands, setShowLigands] = useState(false);
  const [showNucleotides, setShowNucleotides] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [activeDemo, setActiveDemo] = useState<string | null>(null);
  const [demoExplanation, setDemoExplanation] = useState<DemoExplanation | null>(null);
  const [expandedViewer, setExpandedViewer] = useState<number | null>(null);
  const demoRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Access landing Molstar instances
  const heterodimer = useExistingInstance('landing_9mlf');
  const lattice = useExistingInstance('landing_6wvm');

  // Close dropdown on outside click
  useEffect(() => {
    if (!demoOpen) return;
    const handler = (e: MouseEvent) => {
      if (demoRef.current && !demoRef.current.contains(e.target as Node)) {
        setDemoOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [demoOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, []);

  const dismissDemo = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    setActiveDemo(null);
    setDemoExplanation(null);
  }, []);

  const runDemo = useCallback(async (demoId: string) => {
    // Clean up previous demo
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
      setDemoExplanation(null);
    }

    // Toggle off if same demo
    if (activeDemo === demoId) {
      setActiveDemo(null);
      setDemoOpen(false);
      return;
    }

    const demo = LANDING_DEMOS.find(d => d.id === demoId);
    if (!demo) return;

    const result: DemoResult = await demo.run({ heterodimer, lattice });
    cleanupRef.current = result.cleanup;
    setDemoExplanation(result.explanation);
    setActiveDemo(demoId);
    setDemoOpen(false);
  }, [activeDemo, heterodimer, lattice]);

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* ---- Header ---- */}
      <header className="max-w-[1400px] w-full mx-auto px-6 pt-5 pb-3">
        <h1 className="text-4xl tracking-[0.01em]">
          <span className="font-bold text-slate-800">tube</span>
          <span className="font-light text-slate-400">.xyz</span>
        </h1>
        <p className="mt-1 text-[13px] text-slate-400 font-light tracking-wide">
          Tubulin structures, ligands, mutations &amp; modifications
        </p>
      </header>

      {/* ---- Unified pill: nav | assistant | tools ---- */}
      <div className="max-w-[1400px] w-full mx-auto px-6 pb-4 relative z-20">
        <AppPill>
          {/* ── Left: nav ── */}
          <PillNavLink href="/" icon={Home} title="Home" active />
          <PillNavLink href="/structures" icon={LayoutGrid} label="See All Structures" title="Browse tubulin structure catalogue" />

          <PillDivider />

          {/* ── Center: AI assistant placeholder ── */}
          <PillSection stretch className="px-1">
            <div className="flex-1 min-w-0 relative">
              <input
                disabled
                placeholder="Ask about structures, binding sites, ligands, mutations..."
                className="w-full h-7 rounded-full border border-slate-200/60 bg-white/60
                           px-3 pr-20 text-[11px]
                           text-slate-400 placeholder:text-slate-400"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-300
                               tracking-wider font-medium uppercase">
                coming soon
              </span>
            </div>
          </PillSection>

          <PillDivider />

          {/* ── Right: tools (spin · explore · feedback) ── */}
          <button
            onClick={() => setSpinning(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-medium transition-colors
                       text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            title={spinning ? 'Pause rotation' : 'Resume rotation'}
            type="button"
          >
            {spinning ? (
              <svg width="11" height="11" viewBox="0 0 14 14" fill="currentColor">
                <rect x="3" y="2" width="3" height="10" rx="0.5" />
                <rect x="8" y="2" width="3" height="10" rx="0.5" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 14 14" fill="currentColor">
                <path d="M3 1.5v11l9-5.5z" />
              </svg>
            )}
            {spinning ? 'Pause' : 'Spin'}
          </button>

          {/* Demos dropdown */}
          <div className="relative" ref={demoRef}>
            <button
              onClick={() => setDemoOpen(v => !v)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full font-medium transition-colors
                         ${activeDemo
                  ? 'bg-slate-100 text-slate-700'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              type="button"
            >
              Explore
              <ChevronDown size={11} className={`transition-transform ${demoOpen ? 'rotate-180' : ''}`} />
            </button>

            {demoOpen && (
              <div className="absolute top-full right-0 mt-1.5 w-56 rounded-lg border border-slate-200
                              bg-white shadow-lg z-50 py-1 text-[11px]">
                {(Object.entries(DEMOS_BY_CATEGORY) as [DemoCategory, typeof LANDING_DEMOS][]).map(
                  ([category, demos]) => (
                    <div key={category}>
                      <div className="px-3 pt-2 pb-1 text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                        {DEMO_CATEGORY_LABELS[category]}
                      </div>
                      {demos.map(demo => (
                        <button
                          key={demo.id}
                          onClick={() => runDemo(demo.id)}
                          className={`w-full text-left px-3 py-1.5 flex items-center justify-between
                                     hover:bg-slate-50 transition-colors
                                     ${activeDemo === demo.id ? 'text-slate-800 bg-slate-50' : 'text-slate-600'}`}
                        >
                          <span className="font-medium">{demo.label}</span>
                          {demo.target && (
                            <span className="text-[9px] text-slate-400 font-mono">{demo.target}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          <PillDivider />

          <PillAnchor
            href="mailto:feedback@tube.xyz?subject=tube.xyz%20feedback"
            icon={Mail}
            title="Send feedback"
          />
        </AppPill>
      </div>

      {/* ---- Viewers ---- */}
      <main className="max-w-[1400px] w-full mx-auto px-6 flex-1 min-h-0 pb-2">
        <div className={`grid gap-3 h-full ${expandedViewer === null ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {STRUCTURES.map((s, idx) => {
            const isHidden = expandedViewer !== null && expandedViewer !== idx;
            const isExpanded = expandedViewer === idx;

            return (
              <div
                key={s.pdbId}
                className={`relative rounded-xl border border-slate-200/60 bg-white overflow-hidden transition-all duration-200
                  ${isHidden ? 'hidden' : ''}
                  ${isExpanded ? 'h-full' : ''}`}
              >
                <LandingViewer
                  pdbId={s.pdbId}
                  instanceId={s.instanceId}
                  type={s.type}
                  description={s.description}
                  citation={s.citation}
                  spinning={spinning}
                  showLigands={showLigands}
                  showNucleotides={showNucleotides}
                  {...(s.chainFilter ? { chainFilter: s.chainFilter } : {})}
                />

                {/* Fullscreen toggle */}
                <button
                  onClick={() => setExpandedViewer(isExpanded ? null : idx)}
                  className="absolute top-2 right-2 z-10 p-1.5 rounded-md
                             bg-white/40 backdrop-blur-sm border border-slate-200/30
                             text-slate-400/60 hover:text-slate-600 hover:bg-white/70
                             transition-all"
                  title={isExpanded ? 'Exit fullscreen' : 'Expand viewer'}
                >
                  {isExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                </button>

                {/* Explanation card overlay */}
                {demoExplanation && (
                  (demoExplanation.target === 'both' ||
                   (demoExplanation.target === 'heterodimer' && idx === 0) ||
                   (demoExplanation.target === 'lattice' && idx === 1)) && (
                    <DemoExplanationCard
                      explanation={demoExplanation}
                      onDismiss={dismissDemo}
                      instance={idx === 0 ? heterodimer : lattice}
                    />
                  )
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t border-slate-100">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex flex-col items-center gap-2">
          <div className="flex items-center gap-6">
            <a href="https://institut-curie.org" target="_blank" rel="noopener noreferrer">
              <Image src="/landing/Logo_Curie.png" alt="Institut Curie" width={300} height={80}
                     className="h-11 w-auto opacity-60 hover:opacity-100 transition-opacity" />
            </a>
            <a href="https://www.psi.ch" target="_blank" rel="noopener noreferrer">
              <Image src="/landing/PSI-Logo.png" alt="Paul Scherrer Institute" width={300} height={80}
                     className="h-11 w-auto opacity-60 hover:opacity-100 transition-opacity" />
            </a>
            <div className="w-px h-9 bg-slate-200" />
            <a href="https://www.rcsb.org" target="_blank" rel="noopener noreferrer">
              <Image src="/landing/pdb_logo.png" alt="RCSB PDB" width={120} height={40}
                     className="h-6 w-auto opacity-40 hover:opacity-80 transition-opacity" />
            </a>
            <a href="https://www.uniprot.org" target="_blank" rel="noopener noreferrer">
              <Image src="/landing/uniprot.png" alt="UniProt" width={120} height={40}
                     className="h-6 w-auto opacity-40 hover:opacity-80 transition-opacity" />
            </a>
            <a href="http://hmmer.org" target="_blank" rel="noopener noreferrer">
              <Image src="/landing/logo_hmmer.png" alt="HMMER" width={120} height={40}
                     className="h-6 w-auto opacity-40 hover:opacity-80 transition-opacity" />
            </a>
            <a href="https://molstar.org" target="_blank" rel="noopener noreferrer">
              <Image src="/landing/logo_molstar.png" alt="Mol*" width={120} height={40}
                     className="h-6 w-auto opacity-40 hover:opacity-80 transition-opacity" />
            </a>
            <a href="https://neo4j.com" target="_blank" rel="noopener noreferrer">
              <Image src="/landing/logo_neo4j.png" alt="Neo4j" width={120} height={40}
                     className="h-6 w-auto opacity-40 hover:opacity-80 transition-opacity" />
            </a>
          </div>
          <p className="text-[9px] text-slate-300 tracking-wide">
            Built with structural data from the Protein Data Bank. Content licensed under CC BY 4.0.
          </p>
        </div>
      </footer>
    </div>
  );
}
