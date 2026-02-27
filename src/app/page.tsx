'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import LandingViewer from '@/app/landing/LandingViewer';

const STRUCTURES = [
  {
    pdbId: '1JFF',
    instanceId: 'landing_1jff' as const,
    type: 'Heterodimer',
    description:
      'Refined structure of alpha-beta tubulin from zinc-induced sheets stabilized with taxol.',
    citation: 'Lowe et al., 2001',
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

export default function Page() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ---- Header ---- */}
      <header className="max-w-6xl w-full mx-auto px-8 pt-14 pb-2">
        <h1 className="text-2xl tracking-wide text-slate-700 font-light">
          <span className="font-mono font-normal text-slate-900">tube</span>
          <span className="font-mono font-light text-slate-400">.xyz</span>
        </h1>
        <p className="mt-2 text-sm text-slate-500 max-w-lg leading-relaxed">
          Structures and annotations of tubulin, microtubules, their mutations, ligands and
          post-translational modifications.
        </p>
      </header>

      {/* ---- Main ---- */}
      <main className="max-w-6xl w-full mx-auto px-8 flex-1 pb-16">
        {/* Assistant placeholder */}
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-sm font-medium text-slate-700">Assistant</span>
            <span className="text-[11px] text-slate-400 tracking-wide">coming soon</span>
          </div>
          <div className="flex gap-2">
            <input
              disabled
              placeholder="Ask about structures, binding sites, ligands, mutations..."
              className="flex-1 h-9 rounded-md border border-slate-200 bg-white px-3 text-sm
                         text-slate-400 placeholder:text-slate-400"
            />
            <button
              disabled
              className="h-9 px-4 rounded-md bg-slate-200 text-slate-500 text-sm font-medium"
            >
              Send
            </button>
          </div>
        </div>

        {/* Structure viewers -- taller panels */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {STRUCTURES.map((s) => (
            <Link
              key={s.pdbId}
              href={`/structures/${s.pdbId}`}
              className="group flex flex-col"
            >
              <div
                className="h-[34rem] rounded-xl border border-slate-200 bg-white overflow-hidden
                           transition-shadow duration-200 group-hover:shadow-md
                           group-hover:border-slate-300"
              >
                <LandingViewer pdbId={s.pdbId} instanceId={s.instanceId} />
              </div>

              <div className="mt-3 space-y-0.5">
                <div
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-800
                             group-hover:text-blue-600 transition-colors"
                >
                  <span className="font-mono">{s.pdbId}</span>
                  <span className="text-slate-300">&mdash;</span>
                  <span>{s.type}</span>
                  <span aria-hidden className="text-slate-400 text-xs ml-0.5">&rarr;</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed max-w-md">
                  {s.description}{' '}
                  <span className="text-slate-400">{s.citation}</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t border-slate-100 bg-slate-50/40">
        <div className="max-w-6xl mx-auto px-8 py-14 flex flex-col items-center gap-8 text-center">
          {/* Logos -- bigger, more breathing room */}
          <div className="flex items-center justify-center gap-14 flex-wrap">
            <Image
              src="/landing/Logo_Curie.png"
              alt="Institut Curie"
              width={300}
              height={80}
              className="h-14 w-auto opacity-60 hover:opacity-100 transition-opacity"
            />
            <Image
              src="/landing/PSI-Logo.png"
              alt="Paul Scherrer Institute"
              width={300}
              height={80}
              className="h-14 w-auto opacity-60 hover:opacity-100 transition-opacity"
            />
            <Image
              src="/landing/pdb_logo.png"
              alt="RCSB PDB"
              width={300}
              height={80}
              className="h-14 w-auto opacity-60 hover:opacity-100 transition-opacity"
            />
          </div>

          <p className="text-xs text-slate-500">
            Built with structural data from the Protein Data Bank
          </p>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>Institut Curie</span>
            <span>&middot;</span>
            <span>Paul Scherrer Institute</span>
            <span>&middot;</span>
            <span>RCSB PDB</span>
          </div>

          <p className="text-[10px] text-slate-300">
            Content and code licensed under CC BY 4.0 unless otherwise noted.
          </p>
        </div>
      </footer>
    </div>
  );
}
