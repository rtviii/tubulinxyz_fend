'use client';

// Minimal markdown renderer for grounded assistant answers (respond →
// answer_markdown). Deliberately tiny — handles the subset the model actually
// emits: **bold**, `code`, bullet lists ("- "/"* "), blank-line paragraphs, and
// (defensively) a GitHub-style pipe table. No external dependency, no
// dangerouslySetInnerHTML.
//
// Tables SHOULD arrive via the structured `data.table` channel (rendered by
// ViewerAssistantPanel). The pipe-table parsing here is a fallback so a model
// that ignores that instruction never shows raw `|` pipes.

import { Fragment, type ReactNode } from 'react';
import { AssistantTable } from './AssistantTable';
import type { AssistantTableData } from './types';

// Optional hook to transform plain-text runs (everything that isn't **bold** or
// `code`). The landing page passes one that wraps entity tokens in
// hover-to-highlight spans; structure-page callers omit it. Bold/code/tables are
// never touched by it.
export type RenderText = (text: string, key: string) => ReactNode;

function renderInline(text: string, keyPrefix: string, renderText?: RenderText): ReactNode[] {
  // Split on **bold** and `code`, keeping the delimiters' content.
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.filter(Boolean).map((tok, i) => {
    const key = `${keyPrefix}-${i}`;
    if (tok.startsWith('**') && tok.endsWith('**')) {
      return <strong key={key} className="font-semibold text-slate-800">{tok.slice(2, -2)}</strong>;
    }
    if (tok.startsWith('`') && tok.endsWith('`')) {
      return <code key={key} className="font-mono text-[11px] bg-slate-100 rounded px-1 py-px">{tok.slice(1, -1)}</code>;
    }
    if (renderText) return <Fragment key={key}>{renderText(tok, key)}</Fragment>;
    return <Fragment key={key}>{tok}</Fragment>;
  });
}

const ROW_RE = /^\s*\|.*\|\s*$/;                  // a | cell | cell | row
const SEPARATOR_RE = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/; // a | --- | --- | divider

// Split a markdown table row into trimmed cells, dropping the optional
// leading/trailing pipe.
function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

// If lines[i] begins a GitHub-style pipe table (header + `---` separator + rows),
// parse it. Returns the table and the index just past it, or null.
function parsePipeTable(lines: string[], i: number): { table: AssistantTableData; next: number } | null {
  if (!ROW_RE.test(lines[i] ?? '')) return null;
  const sep = lines[i + 1] ?? '';
  if (!SEPARATOR_RE.test(sep) || !sep.includes('-')) return null;
  const columns = splitRow(lines[i]);
  const rows: string[][] = [];
  let j = i + 2;
  for (; j < lines.length; j++) {
    if (!ROW_RE.test(lines[j])) break;
    rows.push(splitRow(lines[j]));
  }
  return { table: { columns, rows }, next: j };
}

export function AssistantAnswer({
  markdown,
  className = '',
  renderText,
}: {
  markdown: string;
  className?: string;
  renderText?: RenderText;
}) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      blocks.push(
        <p key={`p-${blocks.length}`} className="leading-snug">
          {renderInline(para.join(' '), `p${blocks.length}`, renderText)}
        </p>,
      );
      para = [];
    }
  };
  const flushBullets = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={`u-${blocks.length}`} className="list-disc pl-4 space-y-0.5">
          {bullets.map((b, i) => (
            <li key={i}>{renderInline(b, `u${blocks.length}-${i}`, renderText)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trimEnd();

    const parsed = parsePipeTable(lines, idx);
    if (parsed) {
      flushPara();
      flushBullets();
      blocks.push(<AssistantTable key={`t-${blocks.length}`} table={parsed.table} />);
      idx = parsed.next - 1; // for-loop ++ advances past the consumed table
      continue;
    }

    // Markdown ATX headings (#, ##, ###…). The card UI is small, so render them
    // as a compact bold lead-in (slightly larger for top levels) rather than huge
    // browser-default headings — and never leak literal `##` into the prose.
    const heading = line.match(/^\s*(#{1,6})\s+(.*)$/);
    if (heading) {
      flushPara();
      flushBullets();
      const level = heading[1].length;
      blocks.push(
        <p
          key={`h-${blocks.length}`}
          className={
            level <= 2
              ? 'font-semibold text-slate-800 text-[12.5px] mt-1 first:mt-0'
              : 'font-semibold text-slate-700 mt-0.5'
          }
        >
          {renderInline(heading[2], `h${blocks.length}`, renderText)}
        </p>,
      );
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      flushPara();
      bullets.push(bullet[1]);
    } else if (line.trim() === '') {
      flushPara();
      flushBullets();
    } else {
      flushBullets();
      para.push(line.trim());
    }
  }
  flushPara();
  flushBullets();

  return <div className={`text-[12px] text-slate-700 space-y-1.5 ${className}`}>{blocks}</div>;
}
