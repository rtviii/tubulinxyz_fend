'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { ChevronDown } from 'lucide-react';
import LandingViewer from '@/app/landing/LandingViewer';
import { useExistingInstance } from '@/components/molstar/services/MolstarInstanceManager';
import { LANDING_DEMOS, DEMO_CATEGORY_LABELS, type DemoCategory, type DemoResult } from '@/app/landing/demos';
import { DemoExplanationCard, type DemoExplanation } from '@/app/landing/DemoExplanationCard';
import { AppPill } from '@/components/ui/AppPill';
import { GlobalNav } from '@/components/ui/GlobalNav';
import { LandingChatPanel } from '@/app/landing/LandingChatPanel';

const STRUCTURES = [
  {
    pdbId: '9MLF',
    instanceId: 'landing_9mlf' as const,
    type: 'Heterodimer',
    tab: 'Dimer',
    description:
      'Alpha-beta tubulin dimer from a stathmin complex, straight conformation.',
    citation: '',
    chainFilter: ['A', 'B'],
  },
  {
    pdbId: '6WVM',
    instanceId: 'landing_6wvm' as const,
    type: 'Microtubule lattice',
    tab: 'Lattice',
    description:
      'Tubulin from a 13-protofilament taxol-stabilized microtubule, protofilament-level refinement.',
    citation: 'Cook et al., 2020',
  },
];

// Group demos by category for the Explore dropdown.
const DEMOS_BY_CATEGORY = LANDING_DEMOS.reduce((acc, demo) => {
  (acc[demo.category] ??= []).push(demo);
  return acc;
}, {} as Record<DemoCategory, typeof LANDING_DEMOS>);

const INSTITUTION_LOGOS = [
  { href: 'https://institut-curie.org', src: '/landing/Logo_Curie.png', alt: 'Institut Curie' },
  { href: 'https://www.psi.ch', src: '/landing/PSI-Logo.png', alt: 'Paul Scherrer Institute' },
  { href: 'https://www.birkbeck.ac.uk', src: '/landing/birkbeck_log.png', alt: 'Birkbeck, University of London' },
];

const TOOL_LOGOS = [
  { href: 'https://www.rcsb.org', src: '/landing/pdb_logo.png', alt: 'RCSB PDB' },
  { href: 'https://www.uniprot.org', src: '/landing/uniprot.png', alt: 'UniProt' },
  { href: 'http://hmmer.org', src: '/landing/logo_hmmer.png', alt: 'HMMER' },
  { href: 'https://molstar.org', src: '/landing/logo_molstar.png', alt: 'Mol*' },
  { href: 'https://neo4j.com', src: '/landing/logo_neo4j.png', alt: 'Neo4j' },
];

export default function Page() {
  const [spinning, setSpinning] = useState(true);
  const [demoOpen, setDemoOpen] = useState(false);
  const [activeDemo, setActiveDemo] = useState<string | null>(null);
  const [demoExplanation, setDemoExplanation] = useState<DemoExplanation | null>(null);
  const [activeTab, setActiveTab] = useState(0); // 0 = dimer, 1 = lattice
  const demoRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Both Molstar demo instances stay mounted; tabs only toggle visibility.
  const heterodimer = useExistingInstance('landing_9mlf');
  const lattice = useExistingInstance('landing_6wvm');

  // Close the Explore dropdown on outside click.
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

  // Clean up any active demo on unmount.
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
    // Clean up previous demo.
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
      setDemoExplanation(null);
    }

    // Toggle off if the same demo is picked again.
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

    // Bring the demo's target viewer into view so its explanation card shows.
    const target = result.explanation?.target;
    if (target === 'heterodimer') setActiveTab(0);
    else if (target === 'lattice') setActiveTab(1);
  }, [activeDemo, heterodimer, lattice]);

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* ---- Header ---- */}
      <header className="max-w-[1400px] w-full mx-auto px-6 pt-5 pb-2">
        <h1 className="text-4xl tracking-[0.01em]">
          <span className="font-bold text-slate-800">tube</span>
          <span className="font-light text-slate-400">.xyz</span>
        </h1>
        <p className="mt-1 text-[13px] text-slate-400 font-light tracking-wide">
          Tubulin structures, ligands, mutations &amp; modifications
        </p>
      </header>

      {/* ---- Global navigation ---- */}
      <div className="max-w-[1400px] w-full mx-auto px-6 pb-3 relative z-20">
        <div className="flex justify-center lg:justify-start">
          <AppPill>
            <GlobalNav />
          </AppPill>
        </div>
      </div>

      {/* ---- Two-column body: chat (left) · demos (right) ---- */}
      <main className="max-w-[1400px] w-full mx-auto px-6 flex-1 min-h-0 pb-2">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full min-h-0">
          {/* LEFT — assistant */}
          <section className="min-h-0 flex flex-col">
            <LandingChatPanel />
          </section>

          {/* RIGHT — demos */}
          <section className="min-h-0 flex flex-col">
            {/* Tabs */}
            <div className="flex-none flex items-center justify-center gap-1.5 mb-3">
              {STRUCTURES.map((s, idx) => {
                const active = activeTab === idx;
                return (
                  <button
                    key={s.pdbId}
                    type="button"
                    onClick={() => setActiveTab(idx)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] transition-colors
                      ${active
                        ? 'border-slate-300 text-slate-800 font-semibold'
                        : 'border-transparent text-slate-400 font-medium hover:text-slate-600 hover:border-slate-200'
                      }`}
                  >
                    {s.tab}
                    <span className={`font-mono text-[10px] ${active ? 'text-slate-400' : 'text-slate-300'}`}>
                      {s.pdbId}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Viewer area — both render, inactive is hidden. Borderless: the
                structure floats on the white page. */}
            <div className="relative flex-1 min-h-0">
              {STRUCTURES.map((s, idx) => {
                const hidden = activeTab !== idx;
                const showCard =
                  demoExplanation &&
                  (demoExplanation.target === 'both' ||
                    (demoExplanation.target === 'heterodimer' && idx === 0) ||
                    (demoExplanation.target === 'lattice' && idx === 1));
                return (
                  <div key={s.pdbId} className={`absolute inset-0 ${hidden ? 'hidden' : ''}`}>
                    <LandingViewer
                      pdbId={s.pdbId}
                      instanceId={s.instanceId}
                      type={s.type}
                      description={s.description}
                      citation={s.citation}
                      spinning={spinning}
                      {...(s.chainFilter ? { chainFilter: s.chainFilter } : {})}
                    />
                    {showCard && (
                      <DemoExplanationCard
                        explanation={demoExplanation!}
                        onDismiss={dismissDemo}
                        instance={idx === 0 ? heterodimer : lattice}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Demo controls — underneath the viewer */}
            <div className="flex-none flex items-center justify-center gap-2 mt-3">
              <button
                onClick={() => setSpinning(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium
                           border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
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

              {/* Explore demos dropdown (opens upward) */}
              <div className="relative" ref={demoRef}>
                <button
                  onClick={() => setDemoOpen(v => !v)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border transition-colors
                    ${activeDemo
                      ? 'border-slate-300 text-slate-700'
                      : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  type="button"
                >
                  Explore demos
                  <ChevronDown size={11} className={`transition-transform ${demoOpen ? 'rotate-180' : ''}`} />
                </button>

                {demoOpen && (
                  <div className="absolute bottom-full left-0 mb-1.5 w-60 rounded-lg border border-slate-200
                                  bg-white shadow-lg z-50 py-1 text-[11px] max-h-[50vh] overflow-y-auto">
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

              {activeDemo && (
                <button
                  onClick={dismissDemo}
                  className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-slate-400
                             hover:text-slate-600 hover:bg-slate-50 transition-colors"
                  type="button"
                >
                  Clear
                </button>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t border-slate-100">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex flex-col items-center gap-2">
          <div className="flex items-center gap-6">
            {INSTITUTION_LOGOS.map(logo => (
              <a key={logo.src} href={logo.href} target="_blank" rel="noopener noreferrer">
                <Image src={logo.src} alt={logo.alt} width={300} height={80}
                       className="h-11 w-auto grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all" />
              </a>
            ))}
            <div className="w-px h-9 bg-slate-200" />
            {TOOL_LOGOS.map(logo => (
              <a key={logo.src} href={logo.href} target="_blank" rel="noopener noreferrer">
                <Image src={logo.src} alt={logo.alt} width={120} height={40}
                       className="h-6 w-auto grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all" />
              </a>
            ))}
          </div>
          <p className="text-[9px] text-slate-300 tracking-wide">
            Built with structural data from the Protein Data Bank. Content licensed under CC BY 4.0.
          </p>
        </div>
      </footer>
    </div>
  );
}
