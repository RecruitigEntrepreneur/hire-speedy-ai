import { useState, type ComponentType } from 'react';
import { Building2, Calendar, CheckCircle2, ChevronRight, FileText, Lock, Megaphone, User, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { SaveIndicator } from './SettingsShell';
import { fehlendeAuftrittAngaben, fehlendeFirmendaten, type useCompanyProfile } from './useCompanyProfile';

export type Bereich = 'konto' | 'kalender' | 'auftritt' | 'team' | 'unternehmen' | 'vertrag';

type Tile = { key: Bereich; icon: ComponentType<{ className?: string }>; title: string; text: string; status: string; tone: 'ok' | 'warn' | 'neutral' };

/**
 * Übersicht der Einstellungen: oben „Noch offen“ (immer nur eine Frage), darunter
 * die Bereiche als Kacheln mit Stand. Firmenbereiche nur für den Inhaber des Kontos,
 * weil Firmenprofil, Rechnungen und Vertrag in der Datenbank an ihm hängen.
 */
export function SettingsHub({ company, companyName, isOwner, calendarConnected, contractStatus, onOpen }: {
  company: ReturnType<typeof useCompanyProfile>;
  companyName: string;
  isOwner: boolean;
  calendarConnected: boolean | null;
  contractStatus: string | null;
  onOpen: (b: Bereich) => void;
}) {
  const { profile, update } = company;
  const offen = isOwner ? fehlendeAuftrittAngaben(profile) : [];
  const [spaeter, setSpaeter] = useState<string[]>([]);
  const fragen = offen.filter((f) => !spaeter.includes(f.feld));
  const frage = fragen[0];
  const [antwort, setAntwort] = useState('');
  const firmaFehlt = isOwner ? fehlendeFirmendaten(profile) : [];

  const speichern = () => {
    if (!frage || !antwort.trim()) return;
    update(frage.feld === 'headcount' ? { headcount: parseInt(antwort, 10) || null } : { unique_selling_point: antwort.trim() });
    setAntwort('');
  };

  const tiles: Tile[] = [
    { key: 'konto', icon: User, title: 'Mein Konto', text: 'Name, Passwort, Benachrichtigungen', status: 'Nur für Sie', tone: 'neutral' },
    {
      key: 'kalender', icon: Calendar, title: 'Kalender', text: 'Outlook, Interview-Zeiten',
      status: calendarConnected == null ? 'Wird geprüft …' : calendarConnected ? 'Outlook verbunden' : 'Nicht verbunden', tone: calendarConnected ? 'ok' : 'warn',
    },
    ...(isOwner ? [{
      key: 'auftritt' as const, icon: Megaphone, title: 'Auftritt bei Headhuntern', text: 'Fakten, USP, Arbeitgeberprofil',
      status: offen.length ? `${offen.length} ${offen.length === 1 ? 'Angabe fehlt' : 'Angaben fehlen'}` : 'Vollständig', tone: (offen.length ? 'warn' : 'ok') as Tile['tone'],
    }] : []),
    { key: 'team', icon: Users, title: 'Team', text: 'Kollegen und Rechte', status: 'Öffnet die Team-Seite', tone: 'neutral' },
    ...(isOwner ? [
      {
        key: 'unternehmen' as const, icon: Building2, title: 'Unternehmen', text: 'Name, Logo, Rechnungsanschrift',
        status: firmaFehlt.length ? `Fehlt: ${firmaFehlt.join(', ')}` : 'Vollständig', tone: (firmaFehlt.length ? 'warn' : 'ok') as Tile['tone'],
      },
      {
        key: 'vertrag' as const, icon: FileText, title: 'Vertrag und Rechnungen', text: 'Rahmenvertrag, Rechnungen',
        status: contractStatus ?? 'Noch kein Vertrag', tone: (contractStatus === 'Unterschrieben' ? 'ok' : 'neutral') as Tile['tone'],
      },
    ] : []),
  ];
  const offenGesamt = offen.length + (firmaFehlt.length ? 1 : 0);

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Einstellungen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {companyName}{isOwner ? (offenGesamt ? ` · ${offenGesamt} ${offenGesamt === 1 ? 'Punkt' : 'Punkte'} offen` : ' · alles eingerichtet') : ''}
        </p>
      </div>

      {isOwner && (frage ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-medium">Noch offen</h2><SaveIndicator state={company.saveState} /></div>
          <div className="rounded-xl border border-amber-500/40 bg-card p-5">
            <p className="text-xs text-muted-foreground">Auftritt bei Headhuntern · {offen.indexOf(frage) + 1} von {offen.length}</p>
            <p className="mt-1 text-base font-medium">{frage.frage}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{frage.hilfe}</p>
            <div className="mt-4 flex flex-wrap items-start gap-2">
              {frage.feld === 'headcount'
                ? <Input type="number" className="max-w-48" value={antwort} onChange={(e) => setAntwort(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && speichern()} placeholder="z. B. 400" />
                : <Textarea rows={2} className="min-w-64 flex-1" value={antwort} onChange={(e) => setAntwort(e.target.value)} placeholder="z. B. Weltmarktführer, familiengeführt, 30 Tage Urlaub" />}
              <Button onClick={speichern} disabled={!antwort.trim()}>Speichern</Button>
              <Button variant="ghost" onClick={() => { setSpaeter((s) => [...s, frage.feld]); setAntwort(''); }}>Später</Button>
            </div>
          </div>
          {fragen[1] && <p className="px-1 text-sm text-muted-foreground">Als Nächstes: {fragen[1].frage}</p>}
        </section>
      ) : offenGesamt === 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-card p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          <div><p className="text-sm font-medium">Alles eingerichtet</p><p className="text-sm text-muted-foreground">Sie müssen hier nichts mehr tun. Ändern können Sie alles über die Bereiche unten.</p></div>
        </div>
      ))}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Bereiche</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map(({ key, icon: Icon, title, text, status, tone }) => (
            <button
              key={key}
              type="button"
              onClick={() => onOpen(key)}
              className={cn('group rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/40', tone === 'warn' ? 'border-amber-500/40' : 'border-border')}
            >
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <p className="mt-3 text-sm font-medium">{title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{text}</p>
              <p className={cn('mt-3 text-xs', tone === 'ok' ? 'text-emerald-500' : tone === 'warn' ? 'text-amber-500' : 'text-muted-foreground')}>{status}</p>
            </button>
          ))}
        </div>
        {!isOwner && (
          <p className="flex items-center gap-1.5 px-1 pt-1 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" />Firmendaten, Auftritt bei Headhuntern und Vertrag verwaltet der Inhaber des Kontos.</p>
        )}
      </section>
    </div>
  );
}
