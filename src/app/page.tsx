'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, ArrowUpRight, Mail, X } from 'lucide-react';
import LandingViewer from '@/app/landing/LandingViewer';
import { useExistingInstance } from '@/components/molstar/services/MolstarInstanceManager';
import { LANDING_DEMOS, DEMO_CATEGORY_LABELS, type DemoCategory, type DemoResult } from '@/app/landing/demos';
import { DemoExplanationCard, type DemoExplanation } from '@/app/landing/DemoExplanationCard';
import { AppPill } from '@/components/ui/AppPill';
import { GlobalNav } from '@/components/ui/GlobalNav';
import { useLandingAssistant } from '@/app/landing/useLandingAssistant';
import { useAssistantPrepaint } from '@/app/landing/useAssistantPrepaint';
import { LandingChatInput, ThinkingShimmer } from '@/app/landing/LandingChatInput';
import { AssistantResultsPanel } from '@/components/assistant/AssistantResultsPanel';

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

// The landing chat's "demo viewer" is always the 9MLF heterodimer (clean
// A=α / B=β). Its identity + chains travel to the backend (so it can ground
// binding residues onto the demo and offer demo-safe actions) and to the
// results panel (the honesty gate for hover-highlighting). Inline residue
// highlighting is scoped to this dimer.
const DEMO_RCSB_ID = '9MLF';
const DEMO_CHAIN_IDS = ['A', 'B'];
const DEMO_PAGE_CONTEXT = {
  demo_rcsb_id: DEMO_RCSB_ID,
  demo_chains: [
    { auth_asym_id: 'A', family: 'tubulin_alpha' },
    { auth_asym_id: 'B', family: 'tubulin_beta' },
  ],
};

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

// Developer credit. TODO(rtviii): confirm the contact email + Artem's link.
const CONTACT_EMAIL = 'rtkushner@gmail.com';
const ARTEM_LINK = 'https://github.com/rtviii';

export default function Page() {
  const [spinning, setSpinning] = useState(true);
  const [demoOpen, setDemoOpen] = useState(false);
  const [activeDemo, setActiveDemo] = useState<string | null>(null);
  const [demoExplanation, setDemoExplanation] = useState<DemoExplanation | null>(null);
  const [activeTab, setActiveTab] = useState(0); // 0 = dimer, 1 = lattice
  const demoRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const assistant = useLandingAssistant();
  const replyOpen = assistant.active;

  // Whether the active demo's annotation card should show for the visible tab.
  const showCard =
    !!demoExplanation &&
    (demoExplanation.target === 'both' ||
      (demoExplanation.target === 'heterodimer' && activeTab === 0) ||
      (demoExplanation.target === 'lattice' && activeTab === 1));

  // Both Molstar demo instances stay mounted; tabs only toggle visibility.
  const heterodimer = useExistingInstance('landing_9mlf');
  const lattice = useExistingInstance('landing_6wvm');

  // When an assistant answer arrives, pre-paint the demo dimer's residues by
  // category (binding/PTM/variant). Gated to the clean dimer tab and off while a
  // manual demo owns the overpaint layer, so the two never fight.
  useAssistantPrepaint(heterodimer, assistant.response, {
    chainIds: DEMO_CHAIN_IDS,
    enabled: activeTab === 0 && activeDemo === null,
  });

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
    <div className="h-[100dvh] flex flex-col bg-white overflow-hidden">
      {/* ---- Top-left: wordmark + nav ---- */}
      <header className="shrink-0 flex items-center gap-4 px-6 pt-4 pb-1">
        <Link href="/" className="flex items-baseline leading-none select-none">
          <span className="text-[22px] font-medium tracking-[-0.02em] text-slate-900">tubulin</span>
          <span className="text-[15px] font-mono font-light text-slate-400 ml-[1px]">.xyz</span>
        </Link>
        <AppPill>
          <GlobalNav />
        </AppPill>
      </header>

      {/* ---- Main: structure stage on top, chatbox below ---- */}
      <main className="flex-1 min-h-0 flex flex-col px-6 pt-[2vh]">
        {/* Stage: structure (hero) + assistant reply sliding in beside it.
            Fixed height (not flex-1) so the structure sits high and the chatbox
            keeps a gap above the footer. Narrow + centered when idle, widening
            to use the full width once a reply is open. */}
        <div
          className="shrink-0 w-full mx-auto flex items-stretch gap-5 transition-[max-width,height] duration-500 ease-out"
          style={{ maxWidth: replyOpen ? '1400px' : '840px', height: replyOpen ? '74vh' : '56vh' }}
        >
          {/* Reply pane — grows in from the left when active */}
          <div
            className={`relative min-w-0 transition-all duration-500 ease-out overflow-hidden
              ${replyOpen ? 'basis-1/2 opacity-100' : 'basis-0 opacity-0 pointer-events-none'}`}
          >
            {/* Grayish inset that appears as soon as thinking starts: shimmer
                skeleton first, then the answer/tables/entity chips. Scrolls
                internally, with an always-reachable close that resets the page. */}
            <div className="h-full rounded-xl border border-slate-200/70 bg-slate-50/70 overflow-y-auto p-3">
              {assistant.response && (
                <div className="sticky top-0 z-10 -mx-3 -mt-3 mb-2.5 px-3 py-1.5 flex items-center justify-between
                                bg-slate-50/85 backdrop-blur-sm border-b border-slate-200/60">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Answer</span>
                  <button
                    onClick={assistant.dismiss}
                    title="Close and return to the home view"
                    className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <X size={12} /> Close
                  </button>
                </div>
              )}
              {assistant.loading && !assistant.response && <ThinkingShimmer />}
              {assistant.response && (
                <AssistantResultsPanel
                  embedded
                  hideDismiss
                  response={assistant.response}
                  onDismiss={assistant.dismiss}
                  instance={heterodimer}
                  demo={{ rcsbId: DEMO_RCSB_ID, chainIds: DEMO_CHAIN_IDS }}
                />
              )}
            </div>
          </div>

          {/* Structure pane — feathered, borderless. Bottom-right holds the
              per-demo annotation card stacked above a compact control cluster. */}
          <div className="relative flex-1 min-w-0">
            {STRUCTURES.map((s, idx) => {
              const hidden = activeTab !== idx;
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
                </div>
              );
            })}

            {/* Bottom-right: annotation card (when a demo is active) stacked
                above the compact control cluster. */}
            <div className="absolute bottom-3 right-3 z-20 flex flex-col items-end gap-2 max-w-[calc(100%-1.5rem)]">
              {showCard && (
                <DemoExplanationCard
                  explanation={demoExplanation!}
                  onDismiss={dismissDemo}
                  instance={activeTab === 0 ? heterodimer : lattice}
                />
              )}

              <div className="flex items-center gap-1.5">
                {/* Unified Dimer/Lattice switch + follow-to-structure */}
                <div className="inline-flex items-center rounded-md border border-slate-200 bg-white/90 backdrop-blur-sm overflow-hidden">
                  {STRUCTURES.map((s, idx) => {
                    const isActive = activeTab === idx;
                    return (
                      <button
                        key={s.pdbId}
                        type="button"
                        onClick={() => setActiveTab(idx)}
                        title={s.type}
                        className={`px-2 py-1 text-[11px] leading-none transition-colors
                          ${isActive ? 'bg-slate-100 text-slate-800 font-semibold' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                      >
                        {s.tab}
                      </button>
                    );
                  })}
                  <Link
                    href={`/structures/${STRUCTURES[activeTab].pdbId}`}
                    title={`Open ${STRUCTURES[activeTab].pdbId}`}
                    className="px-1.5 py-1 border-l border-slate-200 text-slate-300 hover:text-slate-700 transition-colors"
                  >
                    <ArrowUpRight size={11} />
                  </Link>
                </div>

                {/* Spin / Pause — icon only */}
                <button
                  onClick={() => setSpinning(v => !v)}
                  type="button"
                  title={spinning ? 'Pause rotation' : 'Resume rotation'}
                  className="grid place-items-center w-[26px] h-[26px] rounded-md border border-slate-200 bg-white/90 backdrop-blur-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {spinning ? (
                    <svg width="10" height="10" viewBox="0 0 14 14" fill="currentColor">
                      <rect x="3" y="2" width="3" height="10" rx="0.5" />
                      <rect x="8" y="2" width="3" height="10" rx="0.5" />
                    </svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 14 14" fill="currentColor">
                      <path d="M3 1.5v11l9-5.5z" />
                    </svg>
                  )}
                </button>

                {/* Explore demos — collapses upward */}
                <div className="relative" ref={demoRef}>
                  <button
                    onClick={() => setDemoOpen(v => !v)}
                    type="button"
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] leading-none bg-white/90 backdrop-blur-sm transition-colors
                      ${activeDemo
                        ? 'border-slate-300 text-slate-700'
                        : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                      }`}
                  >
                    Demos
                    <ChevronDown size={11} className={`transition-transform ${demoOpen ? '' : 'rotate-180'}`} />
                  </button>

                  {demoOpen && (
                    <div className="absolute bottom-full right-0 mb-1.5 w-56 rounded-md border border-slate-200
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
              </div>
            </div>
          </div>
        </div>

        {/* Chatbox — sits below the structure, with room above the footer */}
        <div className="shrink-0 w-full max-w-2xl mx-auto mt-4">
          {!replyOpen && (
            <div className="mb-2.5 text-center">
              <h2 className="text-[15px] font-semibold text-slate-700">Ask the tubulin assistant</h2>
              <p className="mt-0.5 text-[12px] text-slate-400 font-light">
                Find structures, binding sites, ligands and mutations in plain language.
              </p>
            </div>
          )}
          <LandingChatInput
            text={assistant.text}
            setText={assistant.setText}
            loading={assistant.loading}
            canSend={assistant.canSend}
            note={assistant.note}
            active={assistant.active}
            onSubmit={(t) => assistant.submit(t, DEMO_PAGE_CONTEXT)}
          />
        </div>
      </main>

      {/* ---- Footer: logos · acknowledgement · developer credit ---- */}
      <footer className="shrink-0 border-t border-slate-100">
        <div className="max-w-[1400px] mx-auto px-6 py-2 flex items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {INSTITUTION_LOGOS.map(logo => (
              <a key={logo.src} href={logo.href} target="_blank" rel="noopener noreferrer">
                <Image src={logo.src} alt={logo.alt} width={300} height={80}
                       className="h-7 w-auto grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all" />
              </a>
            ))}
            <div className="w-px h-6 bg-slate-200" />
            {TOOL_LOGOS.map(logo => (
              <a key={logo.src} href={logo.href} target="_blank" rel="noopener noreferrer">
                <Image src={logo.src} alt={logo.alt} width={120} height={40}
                       className="h-5 w-auto grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all" />
              </a>
            ))}
          </div>

          <div className="text-right leading-relaxed">
            <p className="text-[9px] text-slate-400">
              Developed by{' '}
              <a href={ARTEM_LINK} target="_blank" rel="noopener noreferrer"
                 className="hover:text-slate-600 underline-offset-2 hover:underline">
                Artem Kushner
              </a>
              , Maxim Igaev, Michel Steinmetz &amp; Carsten Janke.
              <a href={`mailto:${CONTACT_EMAIL}`}
                 className="inline-flex items-center gap-0.5 ml-1.5 align-middle hover:text-slate-600"
                 title="Get in touch">
                <Mail size={10} />
                Get in touch
              </a>
            </p>
            <p className="text-[9px] text-slate-300">
              Built with structural data from the Protein Data Bank. Content licensed under CC BY 4.0.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
