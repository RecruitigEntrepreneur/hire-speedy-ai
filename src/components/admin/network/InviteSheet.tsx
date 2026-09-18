import { useEffect, useState } from 'react';
import { Building2, Copy, Mail, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { onboardingApi } from '@/lib/recruiterOnboardingApi';

/**
 * Persönliche Einladung vorbereiten, im Seitenpanel statt dauerhaft auf der Seite.
 * Ablauf wie bisher: Angaben eintragen, Link erzeugen, optional eine persönliche
 * Nachricht ergänzen und die Einladung per Mail senden. „Vertrag starten“ bei
 * Altkonten öffnet das Panel mit Name, Adresse und Firma vorbelegt.
 */
export interface InvitePrefill { name?: string; email?: string; company?: string }
const EMPTY = { name: '', email: '', company: '', country: '', specialty: '', region: '', kind: 'individual', days: '7', internal_note: '' };
const FIELDS = { name: 'Kontaktname', email: 'E-Mail-Adresse', company: 'Vertragspartner / Firma', country: 'Sitzland', specialty: 'Recruiting-Schwerpunkt', region: 'Zielregion' } as const;

export function InviteSheet({ open, prefill, onOpenChange, onChanged }: {
  open: boolean; prefill: InvitePrefill | null; onOpenChange: (open: boolean) => void; onChanged: () => void;
}) {
  const [draft, setDraft] = useState(EMPTY);
  const [created, setCreated] = useState<{ id: string; token: string; url: string } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft({ ...EMPTY, name: prefill?.name ?? '', email: prefill?.email ?? '', company: prefill?.company ?? '' });
    setCreated(null); setNote(''); setError(''); setMessage(''); setSent(false);
  }, [open, prefill]);

  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Anfrage fehlgeschlagen.'); } finally { setBusy(false); }
  };
  const create = () => run(async () => {
    const result = await onboardingApi<{ id: string; token: string; url: string }>(true, {
      action: 'create', ...draft, profile: { name: draft.name, company: draft.company, country: draft.country, specialty: draft.specialty, region: draft.region },
    });
    setCreated(result); onChanged();
    setMessage('Einladung angelegt. Der persönliche Link wird nur jetzt angezeigt.');
  });
  const send = () => run(async () => {
    if (!created) return;
    await onboardingApi(true, { action: 'mail', case_id: created.id, token: created.token, message: note });
    setSent(true); onChanged();
    setMessage('Einladung vom E-Mail-Dienst zum Versand angenommen. Den Zustellstatus siehst du in der Akte.');
  });

  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
      <SheetHeader>
        <SheetTitle>Persönliche Einladung</SheetTitle>
        <SheetDescription>Ein Link, ein persönlicher Einstieg. Alle bekannten Angaben sind schon dabei, der Headhunter prüft und ergänzt den Rest.</SheetDescription>
      </SheetHeader>
      <div className="mt-6 space-y-5">
        {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</p>}
        {message && <p role="status" className="rounded-md bg-muted p-3 text-sm">{message}</p>}
        {!created ? <form className="space-y-4" onSubmit={e => { e.preventDefault(); void create(); }}>
          <div className="grid grid-cols-2 gap-2">{([['individual', 'Einzelrecruiter', 'Selbstständiger Partner', UserRound], ['agency', 'Agentur', 'Zusammenarbeit mit einer Agentur', Building2]] as const).map(([value, label, detail, Icon]) =>
            <button key={value} type="button" aria-pressed={draft.kind === value} onClick={() => setDraft({ ...draft, kind: value })}
              className={`flex items-start gap-2 rounded-lg border p-3 text-left text-sm transition ${draft.kind === value ? 'border-primary ring-1 ring-primary' : 'hover:bg-muted'}`}>
              <Icon className="mt-0.5 h-4 w-4 shrink-0"/><span><strong className="block">{label}</strong><span className="text-muted-foreground">{detail}</span></span>
            </button>)}</div>
          {(Object.keys(FIELDS) as (keyof typeof FIELDS)[]).map(key => <label key={key} className="block space-y-1 text-sm">
            <span>{FIELDS[key]}{!['name', 'email'].includes(key) && <span className="text-muted-foreground"> · optional</span>}</span>
            <Input required={['name', 'email'].includes(key)} type={key === 'email' ? 'email' : 'text'} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })}/>
          </label>)}
          <label className="block space-y-1 text-sm"><span>Link gültig für</span>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.days} onChange={e => setDraft({ ...draft, days: e.target.value })}>
              <option value="7">7 Tage</option><option value="14">14 Tage</option><option value="30">30 Tage</option>
            </select>
          </label>
          <label className="block space-y-1 text-sm"><span>Interne Notiz <span className="text-muted-foreground">· optional, nur für euer Team</span></span>
            <Textarea value={draft.internal_note} onChange={e => setDraft({ ...draft, internal_note: e.target.value })}/>
          </label>
          <p className="rounded-md bg-muted p-3 text-sm">Nach Bestätigung der Angaben entsteht automatisch der persönliche Vertrag in Fassung 2.1 mit sechs Anlagen. Matchunt prüft und zeichnet am Ende gegen.</p>
          <Button type="submit" className="w-full" disabled={busy}>Persönlichen Link erstellen</Button>
        </form> : <div className="space-y-4">
          <div className="flex items-start gap-3"><Mail className="mt-0.5 h-5 w-5"/><div><strong>Bereit für den persönlichen Einstieg.</strong><p className="text-sm text-muted-foreground">Empfänger: {draft.email}</p></div></div>
          <label className="block space-y-1 text-sm"><span>Persönlicher Link</span><Input readOnly value={created.url} onFocus={e => e.target.select()}/></label>
          <Button type="button" variant="outline" size="sm" onClick={() => void run(async () => { await navigator.clipboard.writeText(created.url); setMessage('Einladungslink kopiert.'); })}><Copy className="mr-2 h-4 w-4"/>Link kopieren</Button>
          <label className="block space-y-1 text-sm"><span>Persönliche Nachricht <span className="text-muted-foreground">· optional</span></span><Textarea maxLength={1200} value={note} disabled={sent} onChange={e => setNote(e.target.value)}/></label>
          <details className="rounded-lg border p-3 text-sm">
            <summary className="cursor-pointer font-medium">E-Mail-Inhalt ansehen</summary>
            <div className="mt-3 space-y-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Willkommen bei Matchunt</p>
              <p>Guten Tag {draft.name},</p>
              <p>wir freuen uns, die Zusammenarbeit mit Ihnen vorzubereiten.</p>
              {note.trim() && <p className="whitespace-pre-wrap">{note.trim()}</p>}
              <p>Über Ihren persönlichen Link können Sie Ihre bereits hinterlegten Angaben prüfen, ergänzen und den Vertragsprozess starten. Bitte verwenden Sie dafür die E-Mail-Adresse, an die diese Einladung gesendet wurde.</p>
              <p className="font-medium">[ Persönliches Onboarding starten ]</p>
              <p className="text-muted-foreground">Dieser persönliche Link ist {draft.days} Tage gültig. Bitte nicht weiterleiten.</p>
            </div>
          </details>
          <Button type="button" className="w-full" disabled={busy || sent} onClick={() => void send()}><Mail className="mr-2 h-4 w-4"/>{sent ? 'Einladung gesendet' : 'Einladung per E-Mail senden'}</Button>
          <p className="text-xs text-muted-foreground">Der Link wird nach dem Schließen nicht mehr angezeigt. Geht er verloren, schickt „Neuen Link senden“ in der Akte einen frischen.</p>
        </div>}
      </div>
    </SheetContent>
  </Sheet>;
}
