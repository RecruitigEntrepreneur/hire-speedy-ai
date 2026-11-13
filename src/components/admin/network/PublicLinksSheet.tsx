import { useCallback, useEffect, useState } from 'react';
import { Copy, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { LanguagePicker, LanguageTag } from '@/components/language/LanguagePicker';
import type { LanguageCode } from '@/i18n/languages';
import { onboardingApi } from '@/lib/recruiterOnboardingApi';

export interface PublicLink {
  id: string; key: string; label: string; language: string | null; expires_at: string | null; revoked_at: string | null;
  opened_count: number; started_count: number; signed_count: number; created_at: string;
}

const EMPTY = { label: '', key: '', language: null as LanguageCode | null, expires_at: '' };

/** Adresse des öffentlichen Einstiegs. Die Sprache steckt in der Kennung, ein Zusatz ist nicht nötig. */
export function publicLinkUrl(key: string): string {
  return `${window.location.origin}/recruiter/onboarding?via=${encodeURIComponent(key)}`;
}

/** Kennung aus der Bezeichnung vorschlagen: klein, nur a–z, 0–9 und Bindestrich. */
export function suggestKey(label: string): string {
  return label.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

/**
 * Öffentliche Headhunter-Links: ein Einstieg ohne Personenbezug für LinkedIn,
 * Mails oder Partner, mit Kennung für die Auswertung und fester Startsprache.
 */
export function PublicLinksSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [links, setLinks] = useState<PublicLink[]>([]);
  const [draft, setDraft] = useState(EMPTY);
  const [keyTouched, setKeyTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setLinks((await onboardingApi<{ links: PublicLink[] }>(true, { action: 'links-list' })).links ?? []); }
    catch (e) { setError(e instanceof Error ? e.message : 'Links konnten nicht geladen werden.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!open) return;
    setDraft(EMPTY); setKeyTouched(false); setError(''); setMessage('');
    void load();
  }, [open, load]);

  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Anfrage fehlgeschlagen.'); } finally { setBusy(false); }
  };
  const create = () => run(async () => {
    await onboardingApi(true, { action: 'link-create', label: draft.label.trim(), key: draft.key.trim(), language: draft.language, expires_at: draft.expires_at || null });
    setDraft(EMPTY); setKeyTouched(false);
    setMessage('Link erstellt. Die Adresse steht unten zum Kopieren.');
    await load();
  });
  const revoke = (link: PublicLink) => run(async () => {
    await onboardingApi(true, { action: 'link-revoke', id: link.id });
    setMessage(`„${link.label}“ ist zurückgezogen. Wer den Link öffnet, startet ohne Kennung.`);
    await load();
  });
  const copy = (link: PublicLink) => run(async () => {
    await navigator.clipboard.writeText(publicLinkUrl(link.key));
    setMessage('Adresse kopiert.');
  });

  const keyValid = /^[a-z0-9-]{3,40}$/.test(draft.key);

  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
      <SheetHeader>
        <SheetTitle>Öffentliche Headhunter-Links</SheetTitle>
        <SheetDescription>Ein Link für LinkedIn, Mails oder Partner. Ohne Personenbezug, mit Kennung für die Auswertung. Jeder durchläuft danach denselben Weg wie mit Einladung.</SheetDescription>
      </SheetHeader>
      <div className="mt-6 space-y-5">
        {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</p>}
        {message && <p role="status" className="rounded-md bg-muted p-3 text-sm">{message}</p>}

        <form className="space-y-4 rounded-lg border p-4" onSubmit={e => { e.preventDefault(); void create(); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm"><span>Bezeichnung (intern)</span>
              <Input required maxLength={80} value={draft.label} placeholder="z. B. LinkedIn Schweden"
                onChange={e => setDraft(d => ({ ...d, label: e.target.value, key: keyTouched ? d.key : suggestKey(e.target.value) }))}/>
            </label>
            <label className="block space-y-1 text-sm"><span>Kennung</span>
              <Input required value={draft.key} placeholder="linkedin-se" aria-invalid={!!draft.key && !keyValid}
                onChange={e => { setKeyTouched(true); setDraft(d => ({ ...d, key: e.target.value.toLowerCase() })); }}/>
              {!!draft.key && !keyValid && <span className="block text-xs text-destructive">3 bis 40 Zeichen, nur a–z, 0–9 und Bindestrich.</span>}
            </label>
            <div className="space-y-1 text-sm"><label htmlFor="public-link-language">Sprache</label>
              <LanguagePicker id="public-link-language" allowAuto value={draft.language} onChange={language => setDraft(d => ({ ...d, language }))}/>
            </div>
            <label className="block space-y-1 text-sm"><span>Gültig bis <span className="text-muted-foreground">· optional</span></span>
              <Input type="date" value={draft.expires_at} onChange={e => setDraft(d => ({ ...d, expires_at: e.target.value }))}/>
            </label>
          </div>
          <Button type="submit" disabled={busy || !draft.label.trim() || !keyValid}><Link2 className="mr-2 h-4 w-4"/>Link erstellen</Button>
        </form>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Bestehende Links</h3>
          {loading ? <p className="text-sm text-muted-foreground">Wird geladen …</p>
            : !links.length ? <p className="text-sm text-muted-foreground">Noch kein öffentlicher Link.</p>
            : <ul className="divide-y rounded-lg border">{links.map(link => {
              const ended = !!link.revoked_at || (!!link.expires_at && new Date(link.expires_at) < new Date());
              return <li key={link.id} className="space-y-2 p-3 text-sm" data-testid={`public-link-${link.key}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{link.label}</span>
                  <span className="text-muted-foreground">{link.language ? <LanguageTag code={link.language}/> : 'Automatisch'}</span>
                  {ended && <span className="rounded-full border px-2 text-xs text-muted-foreground">{link.revoked_at ? 'Zurückgezogen' : 'Abgelaufen'}</span>}
                </div>
                <p className="break-all font-mono text-xs text-muted-foreground">{publicLinkUrl(link.key)}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Geöffnet <strong className="text-foreground">{link.opened_count}</strong></span>
                  <span>Begonnen <strong className="text-foreground">{link.started_count}</strong></span>
                  <span>Unterschrieben <strong className="text-foreground">{link.signed_count}</strong></span>
                  <span className="ml-auto flex gap-2">
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void copy(link)}><Copy className="mr-1 h-3.5 w-3.5"/>Kopieren</Button>
                    {!link.revoked_at && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void revoke(link)}>Zurückziehen</Button>}
                  </span>
                </div>
              </li>;
            })}</ul>}
        </section>
      </div>
    </SheetContent>
  </Sheet>;
}
