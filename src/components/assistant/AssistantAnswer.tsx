'use client';

// Minimal markdown renderer for grounded assistant answers (emit_answer →
// answer_markdown). Deliberately tiny — handles the subset the model actually
// emits: **bold**, `code`, bullet lists ("- "/"* "), and blank-line paragraphs.
// No external dependency, no dangerouslySetInnerHTML.

import { Fragment, type ReactNode } from 'react';

function renderInline(text: string, keyPrefix: string): ReactNode[] {
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
    return <Fragment key={key}>{tok}</Fragment>;
  });
}

export function AssistantAnswer({ markdown, className = '' }: { markdown: string; className?: string }) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      blocks.push(
        <p key={`p-${blocks.length}`} className="leading-snug">
          {renderInline(para.join(' '), `p${blocks.length}`)}
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
            <li key={i}>{renderInline(b, `u${blocks.length}-${i}`)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
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
