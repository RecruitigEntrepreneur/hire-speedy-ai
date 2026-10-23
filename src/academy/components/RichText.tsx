import { Fragment, ReactNode } from 'react';

/** Kursiv-freies Mini-Format der Lerntexte: Absätze, „## Überschrift“, „- Punkt“, **fett**. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-[hsl(40_20%_95%)]">{part.slice(2, -2)}</strong>
      : <Fragment key={i}>{part}</Fragment>,
  );
}

export function RichText({ text, className = '' }: { text: string; className?: string }) {
  const blocks = text.replace(/\r/g, '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={`space-y-4 text-[17px] leading-[1.7] text-[hsl(36_10%_82%)] ${className}`}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        const nodes: ReactNode[] = [];
        let list: string[] = [];
        const flush = () => {
          if (list.length) {
            nodes.push(
              <ul key={`ul-${nodes.length}`} className="list-disc space-y-1.5 pl-5 marker:text-[hsl(var(--acad-gold))]">
                {list.map((li, i) => <li key={i}>{inline(li)}</li>)}
              </ul>,
            );
            list = [];
          }
        };
        lines.forEach((line, li) => {
          if (line.startsWith('## ')) {
            flush();
            nodes.push(<h3 key={`h-${li}`} className="font-display pt-2 text-[22px] leading-tight text-[hsl(40_20%_95%)]">{line.slice(3)}</h3>);
          } else if (line.startsWith('- ')) {
            list.push(line.slice(2));
          } else {
            flush();
            nodes.push(<p key={`p-${li}`}>{inline(line)}</p>);
          }
        });
        flush();
        return <Fragment key={bi}>{nodes}</Fragment>;
      })}
    </div>
  );
}
