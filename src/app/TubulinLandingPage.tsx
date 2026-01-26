'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import TubulinLandingViewer from '@/app/landing/TubulinLandingViewer';
import LandingLigandSidebar from '@/components/molstar/landing/LandingLigandsSidebar';

export default function TubulinLandingPage() {
  const [viewer1jff, setViewer1jff] = useState<any | null>(null);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-10">
        <div className="mb-8">
          <div className="text-3xl font-semibold tracking-tight">TubulinXYZ</div>
          <div className="mt-2 text-sm text-gray-600 max-w-2xl">
            Interactive tubulin structures, with ligand binding sites mapped onto 1JFF.
          </div>
        </div>

        {/* Two viewers side-by-side on lg, stacked on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: 1JFF viewer + ligand catalogue underneath */}
          <div className="flex flex-col gap-6">
            <Card className="p-0 h-[28rem] overflow-hidden">
              <div className="w-full h-full border border-slate-200 bg-white shadow-inner overflow-hidden rounded-xl">
                <TubulinLandingViewer
                  pdbId="1JFF"
                  instanceId="landing_1jff"
                  onViewer={setViewer1jff}
                />
              </div>
            </Card>

            <Card className="p-5 h-[28rem]">
              <LandingLigandSidebar viewer={viewer1jff} />
            </Card>
          </div>

          {/* Right column: 9G0T viewer */}
          <Card className="p-0 h-[56rem] overflow-hidden">
            <div className="w-full h-full border border-slate-200 bg-white shadow-inner overflow-hidden rounded-xl">
              <TubulinLandingViewer pdbId="9G0T" instanceId="landing_9g0t" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

