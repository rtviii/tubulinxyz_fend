'use client';

// Compact table renderer for grounded assistant answers. Used both for the
// structured `data.table` channel (ViewerAssistantPanel) and as the render
// target for a stray markdown pipe-table caught by AssistantAnswer. Matches the
// panel's slate / 11px palette — no antd/shadcn dependency (too heavy for the
// 320px floating panel).

import type { AssistantTableData } from './types';

export function AssistantTable({ table, className = '' }: { table: AssistantTableData; className?: string }) {
  const { columns, rows } = table;
  if (columns.length === 0 || rows.length === 0) return null;
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full border-collapse text-[11px] text-slate-700">
        <thead>
          <tr className="border-b border-slate-200">
            {columns.map((col, i) => (
              <th key={i} className="text-left font-semibold text-slate-600 px-1.5 py-1 align-top">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-slate-100 last:border-0">
              {columns.map((_, ci) => (
                <td key={ci} className="px-1.5 py-1 align-top">
                  {row[ci] == null ? '' : String(row[ci])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
