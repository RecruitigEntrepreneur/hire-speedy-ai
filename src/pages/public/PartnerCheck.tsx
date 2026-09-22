import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BadgeCheck, CircleOff, Loader2, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MatchuntLogo } from '@/components/ui/MatchuntLogo';
import { supabase } from '@/integrations/supabase/client';
import { PartnerCard } from '@/components/recruiter/partner/PartnerCard';
import { dayDate, monthYear, normalizeNumber, PARTNER_NUMBER, TIER_LABEL, type PublicPartner } from '../../../supabase/functions/_shared/recruiter-partner';

/**
 * Öffentliche Prüfseite matchunt.ai/partner/<nummer> (Partnerstatus, Etappe 3).
 * Ohne Anmeldung; zeigt nur, was die Function partner-check freigibt. Nicht für
 * Suchmaschinen: Wer prüfen will, kommt über Link, QR-Code oder Abzeichen.
 */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const title = document.title;
    document.title = 'Partnerstatus prüfen · Matchunt';
    return () => { meta.remove(); document.title = title; };
  }, []);
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });

export default function PartnerCheck() {
  useNoIndex();
  const { number: raw } = useParams();
  const navigate = useNavigate();
  const number = normalizeNumber(raw);
  const [result, setResult] = useState<PublicPartner | null>(null);
  const [failed, setFailed] = useState(false);
  const [other, setOther] = useState('');

  useEffect(() => {
    let active = true;
    setResult(null); setFailed(false);
    if (!PARTNER_NUMBER.test(number)) { setResult({ state: 'invalid' }); return; }
    void supabase.functions.invoke('partner-check', { body: { number } }).then(({ data, error }) => {
      if (!active) return;
      if (error || !data || typeof data !== 'object' || !('state' in data)) setFailed(true);
      else setResult(data as PublicPartner);
    });
    return () => { active = false; };
  }, [number]);

  const check = (e: FormEvent) => {
    e.preventDefault();
    const n = normalizeNumber(other);
    if (n) navigate(`/partner/${n}`);
  };

  return <div className="flex min-h-screen flex-col bg-background text-foreground">
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-2 font-semibold"><MatchuntLogo size={32}/>Matchunt</Link>
        <span className="text-sm text-muted-foreground">Partnerstatus prüfen</span>
      </div>
    </header>

    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Card>
        <CardContent className="p-6 sm:p-8">
          {!result && !failed && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Status wird geprüft …</p>}
          {failed && <p role="alert" className="text-sm">Die Prüfung ist gerade nicht erreichbar. Bitte versuche es in ein paar Minuten noch einmal.</p>}

          {result?.state === 'active' && <div className="flex flex-col-reverse gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-medium text-success"><BadgeCheck className="h-5 w-5"/>Verifizierter {TIER_LABEL[result.tier]}</p>
              <div>
                <h1 className="text-2xl font-semibold sm:text-3xl">{result.name || 'Matchunt Partner'}</h1>
                {result.company && <p className="text-muted-foreground">{result.company}</p>}
              </div>
              <p className="text-sm text-muted-foreground">Partner seit {monthYear(result.since)} · Nr. <span className="font-mono">{result.number}</span><br/>
                Status aktiv, geprüft am {dayDate(result.checkedAt)} um {time(result.checkedAt)} Uhr</p>
              {result.expertise && <p className="border-t border-border pt-3 text-sm"><span className="text-muted-foreground">Schwerpunkte: </span>{result.expertise}</p>}
            </div>
            <PartnerCard tier={result.tier} size="lg" className="self-start sm:self-center"/>
          </div>}

          {(result?.state === 'paused' || result?.state === 'ended') && <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><CircleOff className="h-5 w-5"/>Nicht aktiv</p>
            <h1 className="text-xl font-semibold">{result.state === 'ended' ? `Dieser Partnerstatus ist seit ${dayDate(result.endedAt)} nicht mehr aktiv.` : 'Dieser Partnerstatus ist derzeit nicht aktiv.'}</h1>
            <p className="text-sm text-muted-foreground">Nr. <span className="font-mono">{result.number}</span>. Abzeichen oder Hinweise mit dieser Nummer gelten deshalb nicht.</p>
          </div>}

          {result?.state === 'invalid' && <div className="space-y-4">
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><SearchX className="h-5 w-5"/>Unbekannte Nummer</p>
              <h1 className="text-xl font-semibold">Diese Partnernummer ist uns nicht bekannt.</h1>
              <p className="text-sm text-muted-foreground">Partnernummern sehen so aus: MP-XXXX-XXXX. Prüf die Schreibweise oder gib die Nummer hier ein.</p>
            </div>
            <form onSubmit={check} className="flex max-w-sm gap-2">
              <Input value={other} onChange={e => setOther(e.target.value)} placeholder="MP-7K3Q-92XW" aria-label="Partnernummer" className="font-mono"/>
              <Button type="submit" disabled={!other.trim()}>Prüfen</Button>
            </form>
          </div>}
        </CardContent>
      </Card>
      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        Matchunt Partner sind selbstständige Headhunter. Der Status beschreibt eine Vertragsbeziehung mit Matchunt, keine Anstellung und keine Vertretung von Matchunt.
      </p>
    </main>

    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-3xl flex-wrap gap-x-4 gap-y-1 px-4 py-4 text-xs text-muted-foreground">
        <Link to="/" className="hover:underline">Was ist Matchunt?</Link>
        <Link to="/impressum" className="hover:underline">Impressum</Link>
        <Link to="/datenschutz" className="hover:underline">Datenschutz</Link>
      </div>
    </footer>
  </div>;
}
