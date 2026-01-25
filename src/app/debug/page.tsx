'use client';

import { ApiDebugPanel } from '@/components/debug/ApiDebugPanel';

export default function DebugPage() {
  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <ApiDebugPanel />
    </div>
  );
}