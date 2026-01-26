'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import TubulinLandingViewer from '@/app/landing/TubulinLandingViewer';
import LandingLigandSidebar from '@/components/molstar/landing/LandingLigandsSidebar';

export default function TubulinLandingPage() {
  const [viewer1jff, setViewer1jff] = useState<any | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="max-w-6xl mx-auto px-6 pt-12 pb-10 w-full flex-1">
        {/* Title */}
        <div className="mb-6">
          <div className="text-3xl sm:text-4xl  tracking-tight text-slate-900">
            <span className="inline-block">
              tube.xyz
            </span>
          </div>
          <div className="mt-2 text-sm text-slate-600 max-w-2xl">
            Structures and annotations of tubulin, MTs, their mutations, ligands and modification.
          </div>
        </div>

        {/* Chatbox placeholder */}
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium text-slate-700">Assistant</div>
            <div className="text-xs text-slate-500">(coming soon)</div>
          </div>
          <div className="mt-3 flex gap-3">
            <input
              disabled
              placeholder="Ask about binding sites, ligands, structures…"
              className="flex-1 h-10 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500"
            />
            <button
              disabled
              className="h-10 px-4 rounded-md bg-slate-200 text-slate-600 text-sm"
            >
              Send
            </button>
          </div>
        </Card>

        {/* Clickable runway that outlines both viewers */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            window.location.href = '/structures';
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') window.location.href = '/structures';
          }}
          className="
            group cursor-pointer select-none
            rounded-2xl border border-slate-200
            bg-white/40 backdrop-blur-[2px]
            hover:bg-white/60
            active:bg-white/70
            transition
            p-4
          "
          aria-label="Browse structures"
        >
          {/* Runway button label (compact, centered) */}
          <div className="flex items-center justify-center">
            <div
              className="
                mb-4 w-full max-w-xl
                rounded-xl 
                bg-white/50
                group-hover:bg-white/70
                transition
                px-4 py-3
                flex items-center justify-center gap-2
                text-sm font-medium text-slate-700
              "
            >
              Browse structures <span aria-hidden>→</span>
            </div>
          </div>

          {/* Two equal viewers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1JFF */}
            <div className="flex flex-col">
              <Card className="p-0 h-[28rem] overflow-hidden">
                <div className="w-full h-full rounded-xl border border-slate-200 bg-white shadow-inner overflow-hidden">
                  <TubulinLandingViewer
                    pdbId="1JFF"
                    instanceId="landing_1jff"
                    profileUrl="/landing/1JFF.json"
                    onViewer={setViewer1jff}
                  />
                </div>
              </Card>

              <div className="mt-2 text-[11px] italic text-slate-600">
                1JFF — tubulin <span className="not-italic">dimer</span>.{' '}
                <span className="text-slate-600">
                  Refined structure of alpha-beta tubulin from zinc-induced sheets stabilized with taxol; Lowe et al., 2001
                </span>
              </div>
            </div>

            {/* 9F3B */}
            <div className="flex flex-col">
              <Card className="p-0 h-[28rem] overflow-hidden">
                <div className="w-full h-full rounded-xl border border-slate-200 bg-white shadow-inner overflow-hidden">
                  <TubulinLandingViewer
                    pdbId="9F3B"
                    instanceId="landing_9f3b"
                    profileUrl="/landing/9F3B.json"
                  />
                </div>
              </Card>

              <div className="mt-2 text-[11px] italic text-slate-600">
                9F3B — microtubule <span className="not-italic">lattice</span>.{' '}
                <span className="text-slate-600">
                  Undecorated 13pf E254Q microtubule from recombinant human tubulin; Estevez-Gallego et al.,  2024
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Ligands under 1JFF */}
        <div className="mt-6">
          <Card className="p-4">
            <LandingLigandSidebar viewer={viewer1jff} />
          </Card>
        </div>
      </div>

      {/* Footer with centered compact logos + license */}
      <footer className="border-t bg-gray-50/50">
        <div className="max-w-6xl mx-auto px-6 py-7 text-center text-gray-500 text-xs space-y-3">
          {/* Logos */}
          <div className="flex justify-center items-center gap-6 flex-wrap">
            <div className="flex items-center justify-center">
              <Image
                src="/landing/Logo_Curie.png"
                alt="Institut Curie"
                width={220}
                height={56}
                className="h-7 w-auto opacity-80"
                priority={false}
              />
            </div>
            <div className="flex items-center justify-center">
              <Image
                src="/landing/PSI-Logo.png"
                alt="Paul Scherrer Institute"
                width={220}
                height={56}
                className="h-7 w-auto opacity-80"
                priority={false}
              />
            </div>
            <div className="flex items-center justify-center">
              <Image
                src="/landing/pdb_logo.png"
                alt="RCSB PDB"
                width={220}
                height={56}
                className="h-7 w-auto opacity-80"
                priority={false}
              />
            </div>
          </div>

          <p>Built with structural data from the Protein Data Bank</p>

          <div className="flex justify-center gap-2 flex-wrap">
            <span>Institut Curie</span>
            <span>•</span>
            <span>Paul Scherrer Institute</span>
            <span>•</span>
            <span>RCSB PDB</span>
          </div>

          <div className="text-[10px] text-slate-400">
            Content and code licensed under CC BY 4.0 (unless otherwise noted).
          </div>
        </div>
      </footer>
    </div>
  );
}

