import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, Clock, FileDown, FileSignature, Loader2, Mail, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicInterviewShell, StatusIcon } from '@/components/interview/PublicInterviewShell';
import { dateDe, euro, signLinkApi, timeDe, type SignPageView } from '@/lib/contractApi';

/*
 * Unterschrift über Matchunt (23.10.2026): /unterschrift/:token, ohne Anmeldung.
 * Der persönliche Link aus der Matchunt-Mail ist der Zugang. Für den Unterzeichner
 * der Firma ohne Konto und für den Kandidaten. „Ansehen und unterschreiben“ führt
 * zu DocuSign; danach springt DocuSign mit ?zurueck=1&event=… hierher zurück.
 * Der Server liefert eine fertige Sicht; die Seite rechnet nichts aus.
 */

/** Nach dem Rücksprung nachfragen (DocuSign erlaubt eine Abfrage erst nach 20 s) */
const RETURN_CHECKS_MS = [0, 21_000, 60_000, 120_000];

export default function SignLinkPage() {
  const { token = '' } = useParams<{ token: string }>();
  const [params] = useSearchParams();
  const returned = params.get('zurueck') === '1';
  const event = params.get('event');

  const [view, setView] = useState<SignPageView | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  // checking = Bestätigung wird geholt, late = DocuSign meldet sich noch nicht, left = ohne Unterschrift zurück
  const [back, setBack] = useState<null | 'checking' | 'late' | 'left'>(returned ? (event === 'signing_complete' ? 'checking' : 'left') : null);
  const [renewedTo, setRenewedTo] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => { document.title = 'Arbeitsvertrag unterschreiben · Matchunt'; }, []);

  useEffect(() => {
    let cancelled = false;
    // Adresse ohne ?zurueck=…, damit ein Neuladen nicht erneut „zurück“ auswertet
    if (returned) window.history.replaceState(null, '', `/unterschrift/${token}`);
    if (returned && event === 'signing_complete') {
      let done = false;
      RETURN_CHECKS_MS.forEach((ms, i) => {
        timers.current.push(window.setTimeout(async () => {
          if (done || cancelled) return;
          try {
            const v = await signLinkApi.returned(token);
            setView(v);
            if (v.state !== 'ready') { done = true; setBack(null); }
            else if (i === RETURN_CHECKS_MS.length - 1) setBack('late');
          } catch {
            if (i === RETURN_CHECKS_MS.length - 1) setBack('late');
          }
        }, ms));
      });
    } else {
      // Abgelehnt in DocuSign: Stand holen, damit „abgelehnt“ sofort sichtbar ist
      (returned && event === 'decline' ? signLinkApi.returned(token) : signLinkApi.peek(token))
        .then((v) => { if (!cancelled) setView(v); })
        .catch(() => { if (!cancelled) setFailed(true); });
    }
    return () => { cancelled = true; timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const start = async () => {
    setBusy(true);
    try {
      const { url } = await signLinkApi.start(token);
      window.location.assign(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Die Unterschrift lässt sich gerade nicht starten.');
      setBusy(false);
    }
  };
  const renew = async () => {
    setBusy(true);
    try { const r = await signLinkApi.renew(token); setRenewedTo(r.email); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Das hat nicht geklappt.'); }
    finally { setBusy(false); }
  };
  const download = async () => {
    try { const { url } = await signLinkApi.document(token); window.open(url, '_blank', 'noopener'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Die Kopie ist gerade nicht abrufbar.'); }
  };

  if (failed) {
    return <Shell><Status icon={AlertCircle} tone="warning" title="Die Seite lädt gerade nicht">Bitte versuchen Sie es in einem Moment noch einmal.</Status></Shell>;
  }
  if (!view || (back === 'checking' && (!view || view.state === 'ready'))) {
    return (
      <Shell>
        <div className="flex flex-col items-center py-16 text-center text-sm text-muted-foreground">
          <Loader2 className="mb-3 h-6 w-6 animate-spin" />
          {back === 'checking' ? 'Wir holen die Bestätigung bei DocuSign …' : 'wird geladen …'}
        </div>
      </Shell>
    );
  }

  const v = view;
  const company = v.role === 'company';
  const candidateFirst = (v.candidateName ?? '').split(' ')[0] || 'der Kandidat';
  const facts = (
    <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1.5 rounded-xl border border-border bg-card p-4 text-sm">
      {company && <><dt className="text-muted-foreground">Arbeitnehmer/in</dt><dd>{v.candidateName}</dd></>}
      {!company && <><dt className="text-muted-foreground">Arbeitgeber</dt><dd>{v.companyName}</dd></>}
      <dt className="text-muted-foreground">Stelle</dt><dd>{v.jobTitle}</dd>
      {v.startDate && <><dt className="text-muted-foreground">Beginn</dt><dd>{dateDe(v.startDate)}</dd></>}
      {v.salary ? <><dt className="text-muted-foreground">Gehalt</dt><dd>{euro(v.salary)}{v.variable ? ` + ${euro(v.variable)} variabel` : ''} pro Jahr</dd></> : null}
      {company && v.uploadedBy && <><dt className="text-muted-foreground">Hochgeladen von</dt><dd>{v.uploadedBy}</dd></>}
    </dl>
  );
  const demo = v.demo ? <p className="text-xs text-muted-foreground">Testbetrieb: Diese Unterschrift ist noch nicht rechtsverbindlich.</p> : null;

  switch (v.state) {
    case 'invalid':
      return <Shell><Status icon={XCircle} tone="destructive" title="Dieser Link ist nicht gültig">Bitte öffnen Sie den Link direkt aus der Mail von Matchunt. Vielleicht wurde er beim Kopieren abgeschnitten.</Status></Shell>;
    case 'withdrawn':
      return <Shell><Status icon={AlertCircle} tone="warning" title="Hier ist nichts mehr zu unterschreiben">{company ? 'Der Vertrag wurde zurückgezogen oder neu angelegt.' : `${v.companyName} hat den Vertrag zurückgezogen. Ihr Headhunter${v.recruiterName ? ` ${v.recruiterName}` : ''} meldet sich bei Ihnen.`}</Status></Shell>;
    case 'revoked':
      return <Shell><Status icon={Mail} tone="muted" title="Es gibt einen neueren Link">Für diesen Vertrag ist eine neuere Mail unterwegs. Bitte nutzen Sie den Link aus der neuesten Mail von Matchunt.</Status></Shell>;
    case 'expired':
      return (
        <Shell>
          <Status icon={Clock} tone="warning" title="Der Link ist abgelaufen">
            {renewedTo ? `Ein neuer Link ist unterwegs an ${renewedTo}.` : 'Aus Sicherheitsgründen gilt jeder Link 14 Tage. Wir schicken Ihnen gern einen neuen an dieselbe Adresse.'}
          </Status>
          {!renewedTo && <Button className="w-full" disabled={busy} onClick={renew}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Neuen Link an {v.email} senden</Button>}
        </Shell>
      );
    case 'not_yet':
      return (
        <Shell>
          <Status icon={Clock} tone="muted" title="Erst unterschreibt die Firma">{v.companyName} unterschreibt Ihren Vertrag zuerst. Sobald Sie dran sind, bekommen Sie eine Mail von Matchunt.</Status>
          {facts}
        </Shell>
      );
    case 'signed':
      return (
        <Shell>
          <Status icon={CheckCircle2} tone="success" title={company ? 'Unterschrieben. Danke!' : 'Ihre Unterschrift ist da. Danke!'}>
            {company
              ? `Sie haben am ${timeDe(v.companySignedAt)} für die ${v.companyName} unterschrieben. Jetzt ist ${candidateFirst} dran und bekommt einen Link per Mail.`
              : `Sie haben am ${timeDe(v.candidateSignedAt)} unterschrieben. Sobald alles abgeschlossen ist, bekommen Sie Ihre Kopie per Mail.`}
          </Status>
          {facts}
        </Shell>
      );
    case 'done':
      return (
        <Shell>
          <Status icon={CheckCircle2} tone="success" title={company ? 'Der Vertrag ist von beiden unterschrieben' : 'Geschafft! Ihr Arbeitsvertrag ist unterschrieben'}>
            {company ? `${v.candidateName} hat ebenfalls unterschrieben.` : `Beide Seiten haben unterschrieben${v.startDate ? `. Ihr erster Arbeitstag: ${dateDe(v.startDate)}` : ''}.`}
          </Status>
          {facts}
          {v.canDownload && <Button variant="outline" className="w-full gap-1.5" onClick={download}><FileDown className="h-4 w-4" />Kopie herunterladen (PDF)</Button>}
          {!v.canDownload && !company && <p className="text-xs text-muted-foreground">Ihre Kopie kommt mit einer eigenen Mail von Matchunt.</p>}
        </Shell>
      );
    case 'ready':
    default:
      return (
        <Shell>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{company ? `Für die ${v.companyName}` : 'Ihr Arbeitsvertrag'}</p>
            <h1 className="text-xl font-semibold">{company ? `Arbeitsvertrag für ${v.candidateName}` : `Ihr Arbeitsvertrag mit ${v.companyName}`}</h1>
            <p className="text-sm text-muted-foreground">
              {company
                ? `Guten Tag ${v.signerName}, Sie unterschreiben für die ${v.companyName}. Danach ist ${candidateFirst} dran.`
                : `Hallo ${(v.signerName ?? '').split(' ')[0]}, ${v.companyName} hat bereits unterschrieben${v.companySignedAt ? ` (${dateDe(v.companySignedAt)})` : ''}. Jetzt fehlt nur noch Ihre Unterschrift.`}
            </p>
          </div>
          {back === 'left' && <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">Sie haben DocuSign ohne Unterschrift verlassen. Sie können jederzeit weitermachen.</p>}
          {back === 'late' && <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">DocuSign hat Ihre Unterschrift noch nicht gemeldet. Laden Sie die Seite in ein paar Minuten neu.</p>}
          {facts}
          <Button className="w-full gap-1.5" size="lg" disabled={busy} onClick={start}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}
            {back === 'left' ? 'Weiter unterschreiben' : 'Vertrag ansehen und unterschreiben'}
          </Button>
          <p className="text-xs text-muted-foreground">Sie sehen den ganzen Vertrag bei DocuSign, bevor Sie unterschreiben. Danach kommen Sie hierher zurück.</p>
          {!company && v.recruiterName && <p className="text-xs text-muted-foreground">Fragen zum Vertrag? Antworten Sie einfach auf die Mail, sie geht an Ihren Headhunter {v.recruiterName}.</p>}
          {demo}
        </Shell>
      );
  }
}

function Shell({ children }: { children: ReactNode }) {
  return <PublicInterviewShell><div className="space-y-4">{children}</div></PublicInterviewShell>;
}

function Status({ icon, tone, title, children }: { icon: Parameters<typeof StatusIcon>[0]['icon']; tone: 'success' | 'muted' | 'warning' | 'destructive'; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <StatusIcon icon={icon} tone={tone} />
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
