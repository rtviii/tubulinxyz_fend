'use client';

import React from 'react';
import { Card } from '@/components/ui/card'
import TubulinLandingViewer from '@/app/landing/TubulinLandingViewer';

export default function TubulinLandingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-10">
        <div className="mb-8">
          <div className="text-3xl font-semibold tracking-tight">TubulinXYZ</div>
          <div className="mt-2 text-sm text-gray-600 max-w-2xl">
            Interactive tubulin structures, with infrastructure for mapping ligand binding sites.
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-5 lg:col-span-1">
            <div className="text-sm text-gray-700 leading-relaxed">
              <div className="font-medium mb-2">Landing demo</div>
              <ul className="list-disc pl-5 space-y-1">
                <li>Loads 1JFF (α/β-tubulin dimer) from RCSB Model server</li>
                <li>Stylized postprocessing (outline + occlusion)</li>
                <li>Creates an empty <code className="px-1 py-0.5 rounded bg-slate-100">annotations_group</code> for future overlays</li>
              </ul>
            </div>
          </Card>

          <div className="lg:col-span-2 h-[30rem] lg:h-[36rem]">
            <div className="flex justify-center">
              <div className="w-[600px] h-[400px] rounded-xl border border-slate-200 bg-white shadow-inner overflow-hidden">
                <TubulinLandingViewer />
              </div>

            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
