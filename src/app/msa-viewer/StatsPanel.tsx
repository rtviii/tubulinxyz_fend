// components/StatsPanel.tsx
// New file

import { useSequenceStructureRegistry } from "./hooks/useSequenceStructureSync";

interface StatsPanelProps {
  registry: ReturnType<typeof useSequenceStructureRegistry>;
  activeLabel: string | null;
  lastEventLog: string | null;
}

export function StatsPanel({ registry, activeLabel, lastEventLog }: StatsPanelProps) {
  const masterCount = registry.getMasterSequences().length;
  const addedCount = registry.getAddedSequences().length;

  return (
    <div className="border rounded-lg p-2 bg-white text-xs">
      {/* Counts */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <span className="font-semibold text-gray-500 uppercase">Master</span>
          <div className="text-base font-bold text-blue-600">{masterCount}</div>
        </div>
        <div>
          <span className="font-semibold text-gray-500 uppercase">Added</span>
          <div className="text-base font-bold text-green-600">{addedCount}</div>
        </div>
      </div>

      {/* Active Sequence */}
      <div className="mb-1">
        <span className="font-semibold text-gray-600">Active: </span>
        <span className="font-mono text-blue-600 font-bold">
          {activeLabel || "None"}
        </span>
      </div>

      {/* Last Event */}
      <div>
        <span className="font-semibold text-gray-600">Last Event:</span>
        <pre className="text-gray-800 bg-gray-50 p-1 rounded mt-1 overflow-x-auto border">
          {lastEventLog || "No events"}
        </pre>
      </div>
    </div>
  );
}