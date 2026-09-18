import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { RecruiterAccount } from '@/lib/recruiterNetwork';
import { clearLegacyFees } from './accounts';

/**
 * Konditionen einmal für alle statt einer Gebühr je Recruiter. Der Text kommt
 * direkt aus Anlage 2 der Vertragsvorlage, damit Seite und Vertrag nie
 * auseinanderlaufen. Die Vorlage wird erst beim Öffnen geladen.
 */

type Block = { kind: 'h' | 'p' | 'li'; text: string } | { kind: 'table'; rows: string[][] };

function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('|')) {
      if (/^\|[\s|:-]+\|$/.test(line)) continue;
      const cells = line.slice(1, -1).split('|').map(c => c.trim());
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'table') last.rows.push(cells); else blocks.push({ kind: 'table', rows: [cells] });
    } else if (line.startsWith('#')) blocks.push({ kind: 'h', text: line.replace(/^#+\s*/, '') });
    else if (/^[-*]\s/.test(line)) blocks.push({ kind: 'li', text: line.replace(/^[-*]\s+/, '') });
    else blocks.push({ kind: 'p', text: line });
  }
  return blocks;
}

const Inline = ({ text }: { text: string }) => <>{text.split(/\*\*(.+?)\*\*/g).map((part, i) => i % 2 ? <strong key={i}>{part}</strong> : part)}</>;

export function ConditionsDialog({ open, legacy, onOpenChange, onChanged }: {
  open: boolean; legacy: RecruiterAccount[]; onOpenChange: (open: boolean) => void; onChanged: () => void;
}) {
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || blocks) return;
    import('../../../../supabase/functions/_shared/recruiter-contract-templates')
      .then(m => setBlocks(parseMarkdown(m.CONTRACT_TEMPLATES.find(t => t.role === 'pricing')?.text ?? '')))
      .catch(() => setBlocks([{ kind: 'p', text: 'Das Konditionenblatt konnte nicht geladen werden.' }]));
  }, [open, blocks]);

  const clean = async () => {
    if (!window.confirm(`${legacy.length} Altwerte löschen? Sie wirken nirgends; maßgeblich bleibt das Konditionenblatt.`)) return;
    setBusy(true); setError('');
    try { await clearLegacyFees(legacy.map(a => a.userId)); onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Löschen fehlgeschlagen.'); }
    finally { setBusy(false); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Konditionen für alle Partner</DialogTitle>
        <DialogDescription>Einheitlich aus dem Rahmenvertrag. Eine eigene Gebühr je Recruiter gibt es nicht.</DialogDescription>
      </DialogHeader>
      {legacy.length > 0 && <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
        <p><strong>{legacy.length} Altwerte ohne Wirkung.</strong> Im früheren Feld „Custom Fee“ stehen noch Einzelwerte. Gerechnet wird damit nirgends.</p>
        <ul className="list-disc pl-5">{legacy.map(a => <li key={a.userId}>{a.name || a.email}: {a.customFee} %</li>)}</ul>
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void clean()}>Altwerte löschen</Button>
      </div>}
      {!blocks ? <p className="text-sm text-muted-foreground">Konditionenblatt wird geladen …</p> : <div className="space-y-3 text-sm">
        {blocks.map((b, i) => b.kind === 'table'
          ? <div key={i} className="overflow-x-auto rounded-md border"><table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-muted/50"><tr>{b.rows[0].map((cell, j) => <th key={j} className="px-3 py-2 font-medium"><Inline text={cell}/></th>)}</tr></thead>
              <tbody>{b.rows.slice(1).map((row, r) => <tr key={r} className="border-t">{row.map((cell, j) => <td key={j} className="px-3 py-2"><Inline text={cell}/></td>)}</tr>)}</tbody>
            </table></div>
          : b.kind === 'h' ? <h3 key={i} className="pt-2 text-base font-semibold">{b.text}</h3>
          : b.kind === 'li' ? <p key={i} className="pl-4 before:-ml-4 before:mr-2 before:content-['•']"><Inline text={b.text}/></p>
          : <p key={i}><Inline text={b.text}/></p>)}
      </div>}
    </DialogContent>
  </Dialog>;
}
