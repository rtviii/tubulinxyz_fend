'use client';

import { ApiDebugPanel } from '@/components/debug/ApiDebugPanel';
import { LigandDebug } from './LigandDebug';

export default function DebugPage() {
  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <ApiDebugPanel />
      <LigandDebug rcsbId='9YMG' authAsymId='A'/>
    </div>
  );
}