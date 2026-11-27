import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { applyLinkLanguage } from '@/i18n';
import { useTheme } from '@/hooks/useTheme';
import { intlLocale } from '@/i18n/languages';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, Clock, FileSignature, Inbox, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { M3Kopf, M3Seite } from '@/components/intake/guest/m3';
import { AenderungenProvider, AufgeteiltBlatt, DankeBlatt, EinladenBlatt, hinweiseAus, MitarbeitZeilen, useAufnahmeLive, WartenBlatt, type Felder, type HelferStand, type Hinweis, type Ort } from '@/components/intake/guest/mitarbeit';
import { applyOps, diffOps, opSchluessel } from '../../../supabase/functions/_shared/aufnahme-ops';
import { MatchuntWordmark } from '@/components/ui/MatchuntWordmark';
import { IntakeShell, IntakeFailurePage, type StepDef } from '@/components/intake/guest/IntakeShell';
import { CaptureStep, emptyCapture, captureBriefingText, type CaptureState } from '@/components/intake/guest/CaptureStep';
import { ContactStep, kontaktVollstaendig } from '@/components/intake/guest/ContactStep';
import { VerifyStep } from '@/components/intake/guest/VerifyStep';
import { PackageStep } from '@/components/intake/guest/PackageStep';
import { SignFrame } from '@/components/intake/guest/SignFrame';
import { SignerChoice } from '@/components/intake/guest/SignerChoice';
import { SummaryStep } from '@/components/intake/guest/SummaryStep';
import { ForwardDialog, ResumeDialog } from '@/components/intake/guest/IntakeDialogs';
import { buildIntakePayload, remoteLabel, levelLabel } from '@/lib/intakeMapping';
import { completeness as katalogCompleteness, knownFromForm } from '@/lib/briefCatalog';
import { useGuestIntake, isFailure } from '@/hooks/useGuestIntake';
import { RETURN_CHECKS_MS } from '@/lib/recruiterSignatureReturn';
import { toast } from 'sonner';

/**
 * Jobaufnahme ohne Login — /start/:token und /aufnahme/:draftToken.
 *
 * Fünf Schritte, ein Autosave, ein Statusmodell. Der Kunde kann jederzeit
 * aufhören und später weitermachen; nichts hängt an einem Konto.
 *
 * Die Reihenfolge ist bewusst so: erst die Arbeit an der Position (dort
 * entsteht der Wert), dann Kontakt und Verifizierung, dann die Konditionen,
 * dann die Anfrage. Konditionen stehen trotzdem ab der ersten Sekunde im Kopf
 * der Seite — was AGB § 9 zusagt und heute nirgends passiert.
 */

// Die Beschriftungen stehen in den Sprachdateien (clientFunnel: shell.steps.*).
// Seit 26.11.2026: „verify“ ist das Kapitel „Start“ (Art der Besetzung + E-Mail-Code) und steht vorn.
const STEP_KEYS = ['verify', 'capture', 'contact', 'packages', 'summary'] as const;

type StepKey = StepDef['key'];

export default function GuestIntake() {
  const { token, draftToken } = useParams<{ token?: string; draftToken?: string }>();
  // Zuerst die Texte: Die Seite wartet, bis die Sprachdatei geladen ist, erst dann startet die Aufnahme.
  const { t, i18n } = useTranslation('clientFunnel');
  const bold = { bold: <strong className="text-foreground" /> };
  // Hell als Vorgabe schon beim Laden, nicht erst wenn der Rahmen mit dem Schalter steht.
  useTheme('light');
  const intake = useGuestIntake(token, draftToken);
  const { state, save, sendCode, confirmCode, openSession, loadPackages, selectPackage, sendContract, checkSignature, submit, forward,
          askAi, parseText, parseUrl, parsePdf, enrichCompany, verbinde, holeStand, zurueckziehen, zurueckgeben } = intake;

  const [step, setStep] = useState<StepKey>('capture');
  // Zurück aus dem Code-Schritt zur Wahl der Art (CaptureStep zählt mit).
  const [artZeigen, setArtZeigen] = useState(0);
  // Die Art ist in dieser Sitzung gewählt: nach dem Code-Schritt nicht noch einmal fragen.
  const [artGewaehlt, setArtGewaehlt] = useState(false);
  const [capture, setCapture] = useState<CaptureState | null>(null);
  const [forwardOpen, setForwardOpen] = useState(false);
  // Die im Rahmenvertrag vereinbarte Kondition, sobald der Paketschritt sie kennt.
  const [rahmenvertrag, setRahmenvertrag] = useState<any>(null);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [knownCompany, setKnownCompany] = useState<{ name: string } | null>(null);
  const [submitted, setSubmitted] = useState<{ mandate: string; requiresSignature: boolean; mailSent: boolean } | null>(null);
  const [signed, setSigned] = useState(false);
  // Der Unterschriftslauf nach dem Absenden: erst fragen, dann versenden.
  const [signUrl, setSignUrl] = useState<string | null>(null);
  const [signerSentTo, setSignerSentTo] = useState<string | null>(null);
  const [signBusy, setSignBusy] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  // „Ihr Vertrag wird vorbereitet“: vom Absenden bis der Vertrag offen ist, ohne Zwischenseite.
  const [vorbereitung, setVorbereitung] = useState(false);
  // Nach der Unterschrift: bestätigen, dann ins Dashboard. `mail`: ohne Anmeldung geht der Zugang per Mail raus.
  const [abschluss, setAbschluss] = useState<'pruefen' | 'spaet' | 'mail'>('pruefen');
  const [pruefLauf, setPruefLauf] = useState(0);

  // ---- Mitarbeit (26.11.2026): Kollegin einladen, gleichzeitig arbeiten -------
  const mitarbeit = state.mitarbeit;
  const helfer = mitarbeit?.ich.rolle === 'beschreiben';
  // Server-Stand der Stelle (je Antwort), der zuletzt gesendete eigene Stand, der aktuelle eigene Stand.
  const basis = useRef<Felder | null>(null);
  const gesendet = useRef<Felder | null>(null);
  const lokal = useRef<CaptureState | null>(null);
  const [hinweise, setHinweise] = useState<Hinweis[]>([]);
  const [ort, setOrt] = useState<Ort | null>(null);
  const [zurueckVon, setZurueckVon] = useState<string | null>(null);
  // Gerade eingeladen (V1): an diese Adresse; das Blatt „Arbeitsteilung“ sagt es einmal dazu.
  const [frischAn, setFrischAn] = useState<string | null>(null);
  const hinweiseRef = useRef<Hinweis[]>([]);
  hinweiseRef.current = hinweise;

  const zumDashboard = () => window.location.assign('/dashboard');

  const waehlen = async (args: { self: boolean; name?: string; email?: string }) => {
    setSignBusy(true);
    setSignError(null);
    const res = await sendContract(args);
    if (isFailure(res)) {
      setSignBusy(false);
      setSignError(res.message);
      return;
    }
    // Vor dem Vertrag anmelden: Schließt er danach das Fenster, ist sein Zugang trotzdem da.
    const angemeldet = await openSession(state.draft?.contact_email);
    setSignBusy(false);
    if (res.customer_signed) setSigned(true);
    else if (res.sign_url) setSignUrl(res.sign_url);
    else {
      setSignerSentTo(res.signer?.email ?? null);
      // Jemand anderes unterschreibt: Die Kontaktperson wartet im Dashboard, nicht auf einer Endseite.
      if (angemeldet) zumDashboard();
    }
  };

  const draft = state.draft;

  // Contracting hat keine Paketwahl: die drei Pakete sind Festanstellung. Die
  // eine Kondition steht auf der Seite "Anfragen" (Live-Befund 25.09.2026,
  // Kanna Medics: Contracting bekam Festanstellungs-Konditionen angeboten).
  const contracting = (capture?.type ?? draft?.contract_type) === 'freelance';
  const steps = useMemo<StepDef[]>(
    () => STEP_KEYS.filter((key) => !(contracting && key === 'packages') && (!helfer || key === 'verify' || key === 'capture'))
      .map((key) => ({ key, label: t(`shell.steps.${key}`) })),
    [contracting, t, helfer],
  );
  // Sprache des Links (Einladung): greift nur, solange die Person nicht selbst gewählt hat.
  const linkLanguage = state.link?.language;
  useEffect(() => { void applyLinkLanguage(linkLanguage); }, [linkLanguage]);
  useEffect(() => {
    if (contracting && step === 'packages') setStep('summary');
  }, [contracting, step]);

  // ---- Zustand aus dem Entwurf herstellen ---------------------------------
  // Gebunden an die Entwurfs-ID, nicht an "schon mal gelaufen": ein Wechsel des
  // Entwurfs (anderer Token, weitergeleiteter Zugang) muss den lokalen Zustand
  // ersetzen, sonst zeigt die Seite weiter die vorige Aufnahme.
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!draft || hydratedFor.current === draft.id) return;
    hydratedFor.current = draft.id;
    basis.current = felderAusDraft(draft);
    setCapture(lokal.current = {
      type: draft.contract_type,
      built: (draft.built as any) ?? null,
      answers: (draft.answers as any) ?? {},
      dyn: draft.dyn
        // available: null erzwingt eine frische KI-Runde beim Fortsetzen;
        // Spannungshinweise sind an die alte Sitzung gebunden.
        ? { ...emptyCapture(draft.contract_type).dyn, ...(draft.dyn as any), available: null, tensionFlags: [] }
        : emptyCapture(draft.contract_type).dyn,
      freelance: (draft.freelance as any) ?? emptyCapture(draft.contract_type).freelance,
      flexibility: (draft.flexibility as any) ?? {},
      revealSetup: (draft.reveal_setup as any) ?? { descriptor: '', trigger: 'after_first_interview' },
    });

    // Beim Fortsetzen dort einsteigen, wo es weitergeht.
    // Eingeladene Kollegin: nur Start und Stelle.
    if (state.mitarbeit?.ich.rolle === 'beschreiben') setStep(state.mitarbeit.ich.bestaetigt ? 'capture' : 'verify');
    // Eine Kollegin beschreibt gerade die Stelle: zurück auf die Arbeitsteilung.
    else if (draft.states.identity === 'email_verified' && !['pending_admin', 'accepted'].includes(draft.states.review)
      && state.mitarbeit?.helfer.some((h) => !h.zurueckgegeben_am)) setStep('aufgeteilt');
    else if (draft.states.review === 'pending_admin' || draft.states.review === 'accepted') setStep('summary');
    else if (draft.states.identity === 'email_verified') {
      // Seit die E-Mail am Anfang steht: ohne Kontaktangaben ist die Stelle noch in Arbeit.
      if (!draft.contact_name) setStep('capture');
      else setStep(draft.contract_type === 'freelance' || draft.states.commercial === 'confirmed' ? 'summary' : 'packages');
    }
    else if (draft.states.identity === 'contact_provided') setStep('verify');
    else if (draft.built) setStep('capture');
  }, [draft]);

  // ---- Zurück zu einem offenen Vertrag --------------------------------------
  // Nach einem Neuladen weiß nur DocuSign, ob schon unterschrieben ist. Ohne diese
  // Frage kam wieder „Wer unterschreibt?“, obwohl der Umschlag längst unterwegs ist.
  const wiederaufnahme = useRef<string | null>(null);
  useEffect(() => {
    if (!draft || wiederaufnahme.current === draft.id) return;
    wiederaufnahme.current = draft.id;
    const vertrag = draft.contract;
    if (!vertrag?.has_envelope || vertrag.customer_signed || vertrag.ordered) return;
    if (draft.states.review !== 'pending_admin' && draft.states.review !== 'accepted') return;
    const selbst = !vertrag.signer_email || vertrag.signer_email.toLowerCase() === (draft.contact_email ?? '').toLowerCase();
    setVorbereitung(true);
    void (async () => {
      const res = await checkSignature();
      if (!isFailure(res) && res.customer_signed) setSigned(true);
      else if (selbst) await waehlen({ self: true });
      else if (await openSession(draft.contact_email)) zumDashboard();
      setVorbereitung(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id]);

  // ---- Nach der Unterschrift: bestätigen und ins Dashboard ------------------
  // Die Rückmeldung aus dem Rahmen ist kein Beweis. Erst wenn der Server die Unterschrift
  // bei DocuSign gesehen hat, geht es weiter; Konto und Vertrag hängen dann zusammen.
  const unterschrieben = signed || Boolean(draft?.contract?.customer_signed);
  useEffect(() => {
    if (!unterschrieben) return;
    let aktiv = true;
    setAbschluss('pruefen');
    void (async () => {
      const angemeldet = await openSession(draft?.contact_email);
      let vorher = 0;
      for (const warten of RETURN_CHECKS_MS) {
        await new Promise((r) => setTimeout(r, warten - vorher));
        vorher = warten;
        if (!aktiv) return;
        const res = draft?.contract?.customer_signed ? null : await checkSignature();
        if (!aktiv) return;
        if (res === null || (!isFailure(res) && res.customer_signed)) {
          if (angemeldet) zumDashboard(); else setAbschluss('mail');
          return;
        }
      }
      setAbschluss('spaet');
    })();
    return () => { aktiv = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unterschrieben, pruefLauf]);

  // ---- Aufnahme-Zustand fortlaufend sichern -------------------------------
  const updateCapture = useCallback(
    (updater: (prev: CaptureState) => CaptureState) => {
      setCapture((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        lokal.current = next;
        // Wer ein Feld selbst ändert, hat die Marke daran gesehen: sie geht weg.
        if (hinweiseRef.current.length) {
          const selbst = new Set(diffOps(felderAusCapture(prev), felderAusCapture(next)).map(opSchluessel));
          if (hinweiseRef.current.some((h) => selbst.has(h.schluessel))) setHinweise((hs) => hs.filter((h) => !selbst.has(h.schluessel)));
        }
        // Die Stelle selbst (built, answers, dyn, freelance, flexibility) geht als Änderungen je
        // Antwort raus (opsQuelle unten); hier nur, was sich daraus ableitet.
        save({
          ...(helfer ? {} : { contract_type: next.type }),
          reveal_setup: next.revealSetup,
          skill_requirements: next.dyn.skillRequirements,
          completeness: next.dyn.available ? next.dyn.completeness : undefined,
          title: next.built?.title ?? null,
          // Ohne Profil gibt es nichts zu erzeugen. Vorher wurde hier ein
          // leeres Objekt mit `as any` durchgereicht -- der Cast stellte den
          // Typecheck still, und zur Laufzeit fehlten die Listen.
          intake_payload: next.built ? buildIntakePayload({
            source: 'guest_intake',
            state: {
              type: next.type,
              built: next.built,
              answers: next.answers,
              freelance: next.freelance,
              flexibility: next.flexibility,
              revealSetup: next.revealSetup,
              dyn: next.dyn,
            },
            briefingText: captureBriefingText(next.answers),
          }) : undefined,
        }, false, true);
        return next;
      });
    },
    [save, helfer],
  );

  // Speichern je Antwort: was hat sich seit dem Serverstand geändert? Und was kam von anderen?
  const echtzeit = useRef<{ sende: (e: 'gespeichert' | 'tippt' | 'zurueck', p?: Record<string, unknown>) => void } | null>(null);
  useEffect(() => {
    verbinde(
      () => {
        const lok = lokal.current ? felderAusCapture(lokal.current) : {};
        gesendet.current = lok;
        return { ops: basis.current ? diffOps(basis.current, lok) : [] };
      },
      (d, eigeneOps) => {
        const S = felderAusDraft(d);
        if (eigeneOps.length) echtzeit.current?.sende('gespeichert');
        if (!basis.current || !lokal.current) { basis.current = S; gesendet.current = null; return; }
        const lok = felderAusCapture(lokal.current);
        const eigeneNeu = diffOps(gesendet.current ?? basis.current, lok);
        const eigene = new Set(eigeneOps.map(opSchluessel));
        const fremd = diffOps(basis.current, S).filter((o) => !eigene.has(opSchluessel(o)));
        const alt = basis.current;
        basis.current = S;
        gesendet.current = null;
        if (!fremd.length) return;
        const neu = applyOps(S, eigeneNeu);
        const next = { ...lokal.current, ...(neu as Partial<CaptureState>) } as CaptureState;
        lokal.current = next;
        setCapture(next);
        // Je Antwort eine Marke. Ändert die Kollegin dieselbe Antwort noch einmal, bleibt
        // „vorher“ der eigene Wert -- Rückgängig führt dorthin zurück.
        const dazu = hinweiseAus(fremd, alt, S);
        if (dazu.length) {
          setHinweise((hs) => {
            const out = [...hs];
            for (const n of dazu) {
              const i = out.findIndex((x) => x.schluessel === n.schluessel);
              if (i >= 0) out[i] = { ...n, id: out[i].id, alt: out[i].alt, rueck: out[i].rueck };
              else out.push(n);
            }
            return out.slice(-30);
          });
        }
      },
    );
    return () => verbinde(null, null);
  }, [verbinde]);

  const live = useAufnahmeLive({
    live: mitarbeit?.live ?? null,
    ich: mitarbeit ? { kuerzel: mitarbeit.ich.kuerzel, name: mitarbeit.ich.name, rolle: mitarbeit.ich.rolle } : null,
    ort,
    onGespeichert: () => { void holeStand(); },
    onZurueck: (name) => { setZurueckVon(name ?? '?'); void holeStand(); },
  });
  echtzeit.current = live;
  // Wieder online: Liegengebliebenes speichern, neuen Stand holen.
  useEffect(() => { if (live.online) { void intake.flush(); void holeStand(); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [live.online]);
  // Tippen anzeigen, gedrosselt.
  const zuletztGetippt = useRef(0);
  const beimTippen = () => {
    if (Date.now() - zuletztGetippt.current < 1500) return;
    zuletztGetippt.current = Date.now();
    live.sende('tippt');
  };
  const rueckgaengig = (hs: Hinweis[]) => {
    const ids = new Set(hs.map((h) => h.id));
    setHinweise((x) => x.filter((y) => !ids.has(y.id)));
    updateCapture((prev) => ({ ...prev, ...(applyOps(felderAusCapture(prev), hs.flatMap((h) => h.rueck)) as Partial<CaptureState>) }));
  };

  // „Einladung ist unterwegs“ steht nur direkt nach dem Senden da.
  useEffect(() => { if (step !== 'aufgeteilt') setFrischAn(null); }, [step]);

  // Wo ich bin, für die anderen: außerhalb der Stelle der Schritt selbst.
  useEffect(() => {
    if (step !== 'capture') setOrt({ id: step, label: ({ verify: t('mitarbeit.ortStart'), contact: t('mitarbeit.ortKontakt'), packages: t('mitarbeit.ortPaket'), summary: t('mitarbeit.ortAnfragen'), einladen: t('mitarbeit.ortEinstieg'), danke: '', aufgeteilt: t('mitarbeit.ortUebersicht') } as Record<string, string>)[step] ?? '' });
  }, [step, t]);

  // ---- Abgeleitetes -------------------------------------------------------
  const reachable = useMemo(() => {
    if (!draft) return ['capture'];
    // Vor der Bestätigung gibt es nur das Kapitel „Start“; danach ist es erledigt.
    if (draft.states.identity !== 'email_verified') return ['verify'];
    const out: string[] = ['capture'];
    // Nicht "existiert ein Entwurf", sondern "steht etwas drin". Nach
    // "Von Hand beschreiben" existierte built als leeres Geruest -- damit
    // liess sich Schritt 1 ueberspringen und man kam mit einer voellig leeren
    // Position bis zur Anfrage. Der Jobtitel ist die kleinste Angabe, mit der
    // ein Recruiter etwas anfangen kann.
    const hatPosition = Boolean(
      String(draft.built?.title ?? draft.title ?? '').trim()
    );
    if (hatPosition || draft.contact_name) out.push('contact');
    if (draft.contact_name) out.push(contracting ? 'summary' : 'packages');
    if (!contracting && draft.states.commercial === 'confirmed') out.push('summary');
    return out;
  }, [draft, contracting]);

  const summaryRows = useMemo(() => {
    if (!capture?.built || !draft) return [];
    const b = capture.built;
    const isFreelance = capture.type === 'freelance';
    const locale = intlLocale(i18n.language);
    const money = (min: number | null, max: number | null, suffix: string) => {
      if (min == null && max == null) return '—';
      if (min != null && max != null) return `${min.toLocaleString(locale)}–${max.toLocaleString(locale)} ${suffix}`;
      return `${(min ?? max)!.toLocaleString(locale)} ${suffix}`;
    };
    return [
      { label: t('summary.rowPosition'), value: b.title || '—' },
      { label: t('summary.rowCompany'), value: draft.company_legal_name || draft.company_name || '—' },
      { label: t('summary.rowLocation'), value: b.location || '—' },
      // remoteLabel und levelLabel kommen aus intakeMapping (Fragen-Kern) und sind vorerst deutsch.
      { label: t('summary.rowWorkModel'), value: remoteLabel(b.remote_type) },
      { label: t('summary.rowExperience'), value: levelLabel(b.experience_level) },
      {
        // Contracting: das Budget des Kunden, alles inklusive -- nicht der Satz
        // des Spezialisten (Marge ist Innenseite, Entscheidung 25.09.2026).
        label: isFreelance ? t('summary.rowDayBudget') : t('summary.rowSalaryBand'),
        value: isFreelance
          ? money(capture.freelance.dayRateMin, capture.freelance.dayRateMax, t('summary.valueAllInclusive'))
          : money(b.salary_min, b.salary_max, t('summary.valuePerYear')),
      },
      { label: t('summary.rowMustHaves'), value: b.must_haves.length ? b.must_haves.join(' · ') : '—' },
      { label: t('summary.rowNiceToHaves'), value: b.nice_to_haves.length ? b.nice_to_haves.join(' · ') : '—' },
      { label: t('summary.rowContractType'), value: isFreelance ? t('summary.valueContracting') : t('summary.valuePermanent') },
      { label: t('summary.rowContact'), value: [draft.contact_name, draft.contact_email].filter(Boolean).join(' · ') || '—' },
    ];
  }, [capture, draft, t, i18n.language]);

  /**
   * Was in der Zusammenfassung als "noch offen" steht.
   *
   * BEFUND (09.09.2026, vom Kunden gefunden): Die Aufnahme meldete unten
   * "26 von 26 Angaben · 100 %", und die Zusammenfassung schrieb daneben
   * "24 Fragen sind noch offen". Gezaehlt wurde gegen `capture.answers` --
   * den Speicher des alten 36-Fragen-Katalogs, in dem seit dem Umbau auf den
   * Briefing-Katalog nur noch fuenf Eintraege liegen, weil niemand mehr
   * hineinschreibt. Und `chapterProgress` gehoerte zu DynamicBriefing, das
   * es nicht mehr gibt.
   *
   * Zwei Zaehler ueber dieselbe Sache, und der sichtbarere war der falsche:
   * er steht direkt ueber dem Absenden-Knopf und sagt dem Kunden, seine
   * Aufnahme sei zu drei Vierteln leer.
   *
   * Gezaehlt wird jetzt derselbe Katalog wie unten in der Fussleiste --
   * einschliesslich dessen, was das Formular links beisteuert.
   */
  const openQuestionCount = useMemo(() => {
    if (!capture?.built) return 0;
    const known = {
      ...knownFromForm({
        built: capture.built,
        freelance: capture.freelance,
        contract: capture.type,
        flexibility: capture.flexibility,
      }),
      ...(capture.dyn.catalog?.known ?? {}),
    };
    return katalogCompleteness(known, capture.type).feldOffen;
  }, [capture]);

  // ---- Zustände der Seite -------------------------------------------------
  if (state.status === 'loading') {
    return (
      <div className="mk3 flex min-h-screen items-center justify-center">
        <div className="text-center">
          <MatchuntWordmark size="sm" className="mb-6 justify-center" />
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (state.status === 'failed' || !draft) {
    const f = state.failure;
    const title =
      f?.reason === 'expired' ? t('failure.expired')
      : f?.reason === 'revoked' ? t('failure.revoked')
      : f?.reason === 'exhausted' ? t('failure.exhausted')
      : f?.reason === 'not_deployed' ? t('failure.notDeployed')
      : t('failure.invalid');
    return (
      <IntakeFailurePage
        title={title}
        message={f?.message ?? t('failure.fallbackMessage')}
        action={
          <Button asChild variant="outline">
            <Link to="/">{t('failure.home')}</Link>
          </Button>
        }
      />
    );
  }

  if (submitted || draft.states.review === 'pending_admin' || draft.states.review === 'accepted') {
    // Nach einem Neuladen ist submitted leer -- dann traegt der Entwurf die
    // Nummer. Ohne das stand dort "Vorgang ." ohne Nummer.
    const mandate = submitted?.mandate ?? draft.contract?.number ?? null;
    // Unterschrieben wird nur beim ERSTEN Vorgang eines Kunden -- da entsteht
    // der Rahmenvertrag. Jede weitere Position wird unter ihm beauftragt; der
    // Vertragstext regelt, dass die Auftragserteilung ueber dieses System
    // erfolgt. `ordered` traegt den Stand auch ueber ein Neuladen.
    const unterRahmenvertrag =
      submitted?.requiresSignature === false || Boolean(draft.contract?.ordered);
    // Seit dem Vertragswerk v4 (25.09.2026) gilt das auch fuer Contracting:
    // Rahmenvertrag und Auftragsbestaetigung gehen per DocuSign raus.
    const requiresSignature = !unterRahmenvertrag;

    // Was der Server ueber den Vertragslauf weiss. Entscheidend nach einem
    // Neuladen: ohne das saehe ein Kunde, der den Tab geschlossen hat, nur
    // eine Bestaetigung -- und keinen Weg mehr zur Unterschrift.
    const vertrag = draft.contract;
    const bereitsUnterschrieben = signed || Boolean(vertrag?.customer_signed);
    const anDrittenVersandt = signerSentTo
      ?? (vertrag?.has_envelope && !vertrag.customer_signed && vertrag.signer_email
          && vertrag.signer_email !== draft.contact_email
          ? vertrag.signer_email : null);

    // Vom Absenden bis der Vertrag offen ist: keine Zwischenseite.
    const kehrtZurueck = !!vertrag?.has_envelope && !bereitsUnterschrieben && wiederaufnahme.current !== draft.id;
    if (requiresSignature && (vorbereitung || kehrtZurueck) && !signUrl) {
      return (
        <M3Seite>
          <M3Kopf
            icon={Dreht}
            titel={t('finish.preparingTitle')}
            lead={mandate ? <Trans t={t} i18nKey="finish.preparingTextMandate" values={{ mandate }} components={{ b: <strong className="text-foreground" /> }} /> : t('finish.preparingText')}
          />
        </M3Seite>
      );
    }

    // Unterschrieben: Funnel zu Ende, es geht ins Dashboard. Hier bleibt nur, wer warten muss.
    if (requiresSignature && bereitsUnterschrieben) {
      return (
        <M3Seite>
          <div role="status">
            {abschluss === 'pruefen' && <M3Kopf icon={Dreht} titel={t('finish.signedTitle')} lead={t('finish.opening')} />}
            {abschluss === 'spaet' && <>
              {/* Grau statt Gelb: es ist nichts zu tun, nur Geduld. */}
              <M3Kopf icon={Clock} titel={t('finish.lateTitle')} lead={t('finish.lateText')} />
              <button type="button" className="mx-auto block text-sm font-medium text-klick hover:underline" onClick={() => setPruefLauf((n) => n + 1)}>{t('finish.recheck')}</button>
            </>}
            {abschluss === 'mail' && <>
              {/* Grün bleibt: hier ist wirklich unterschrieben. */}
              <M3Kopf icon={Unterschrieben} titel={t('finish.signedTitle')} lead={t('finish.mailText', { email: draft.contact_email })} />
              <Button asChild size="lg" className="w-full rounded-full"><Link to="/anmelden">{t('finish.toLogin')}</Link></Button>
            </>}
          </div>
        </M3Seite>
      );
    }

    // (1) Die Frage: wer unterschreibt. Solange sie offen ist, ist SIE die
    //     Seite -- der Kunde soll den Lauf abschliessen, solange er hier ist.
    //     Greift auch nach einem Neuladen, solange nichts unterschrieben und
    //     nichts an einen Dritten unterwegs ist.
    if (requiresSignature && !signUrl && !anDrittenVersandt && !bereitsUnterschrieben) {
      return (
        <M3Seite>
          <SignerChoice
            contactName={draft.contact_name}
            busy={signBusy}
            error={signError}
            onChoose={waehlen}
            eingang={mandate
              ? <Trans t={t} i18nKey="submitted.receivedNumber" values={{ number: mandate }} components={bold} />
              : t('submitted.received')}
          />
        </M3Seite>
      );
    }

    // (2) Eigenhaendig: der Vertrag im Rahmen, auf unserer Seite.
    if (requiresSignature && signUrl && !signed) {
      return (
        <M3Seite breit>
          <M3Kopf
            icon={FileSignature}
            titel={t('submitted.signTitle')}
            lead={mandate
              ? <Trans t={t} i18nKey="submitted.signLeadNumber" values={{ number: mandate }} components={bold} />
              : t('submitted.signLead')}
          />
          <SignFrame
            url={signUrl}
            onDone={() => setSigned(true)}
            /* Eine FRISCHE Adresse fuer den Weg im eigenen Fenster. Die alte
               ist verbraucht, sobald der Rahmen sie einmal geladen hat --
               auch dann, wenn er nichts anzeigen durfte. docusign-send stellt
               zum bestehenden Umschlag eine neue Ansicht aus, solange nicht
               unterschrieben ist; ein zweiter Vertrag entsteht dabei nicht. */
            onNeuerLink={async () => {
              const res = await sendContract({ self: true });
              return isFailure(res) ? null : res.sign_url;
            }}
            /* Die Wahrheit steht beim Server, nicht im Rahmen. */
            onPruefen={async () => {
              const res = await checkSignature();
              if (isFailure(res)) return 'offen';
              return res.declined ? 'abgelehnt'
                   : res.customer_signed ? 'unterschrieben'
                   : 'offen';
            }}
            onAbbruch={async (ev) => {
              /* Wer schon unterschrieben hat und den Vertrag noch einmal öffnet,
                 kommt mit `viewing_complete` zurück: erst nachfragen (FB-0015). */
              if (ev === 'viewing_complete') {
                const res = await checkSignature();
                if (!isFailure(res) && res.customer_signed) { setSigned(true); return; }
              }
              /* Die alte Adresse ist verbraucht. Sie stehen zu lassen hiesse,
                 den Kunden vor einem toten Rahmen sitzen zu lassen -- die
                 Frage "wer unterschreibt" erscheint nur, solange keine
                 Adresse gesetzt ist. */
              setSignUrl(null);
              setSignError(
                ev === 'decline' ? t('submitted.declinedError') : t('submitted.expiredError'),
              );
            }}
          />
        </M3Seite>
      );
    }

    return (
      <M3Seite>
        {/* Grau statt Grün: unterschrieben ist hier noch nichts. */}
        <M3Kopf
          icon={Inbox}
          titel={t('submitted.title')}
          lead={<Trans
            t={t}
            i18nKey={mandate ? 'submitted.reviewingNumber' : 'submitted.reviewing'}
            values={{ number: mandate ?? '', title: capture?.built?.title ?? draft.title ?? t('submitted.yourPosition') }}
            components={bold}
          />}
        />
        {/* Liegt eine Unterschriftsansicht vor, ist sie der naechste
            Schritt — nicht eine Mail, die vielleicht im Spam landet.
            Fehlt sie (DocuSign nicht erreichbar), sagt die Seite das
            ehrlich, statt auf etwas zu verweisen, das nicht kommt. */}
        <div className="space-y-3">
          <Step icon={Mail} title={t('submitted.mailTitle')}
            text={t('submitted.mailText', { email: draft.contact_email })} />
          <Step icon={FileSignature} title={t('submitted.signatureTitle')}
            text={bereitsUnterschrieben
              ? t('submitted.signatureDone')
              : anDrittenVersandt
              ? t('submitted.signatureThird', { email: anDrittenVersandt })
              : t('submitted.signaturePending')} />
          <p className="pt-2 text-center text-xs leading-relaxed text-muted-foreground">{t('submitted.notice')}</p>
        </div>
      </M3Seite>
    );
  }

  // ---- Der Flow -----------------------------------------------------------
  const link = state.link;
  // „‹ Zurück“ oben links: der vorige Schritt. In der Stellen-Aufnahme melden die Seiten ihr eigenes Zurück an.
  // Bestätigt ist bei der Kollegin ihr Zugang, sonst der Ansprechpartner.
  const verified = helfer ? Boolean(mitarbeit?.ich.bestaetigt) : draft.states.identity === 'email_verified';
  const stepIdx = steps.findIndex((x) => x.key === step);
  // Die Stelle meldet ihr eigenes Zurück an; vor ihr liegt der Code-Schritt, nicht „zurück“.
  const vorheriger = step === 'capture' || stepIdx <= 0 ? null : (steps[stepIdx - 1].key as StepKey);
  const zurueck = step === 'verify'
    ? (verified || helfer ? undefined : () => { setArtGewaehlt(false); setStep('capture'); setArtZeigen((n) => n + 1); })
    : step === 'einladen' ? () => setStep('capture')
    : step === 'danke' || step === 'aufgeteilt' ? undefined
    : vorheriger ? () => setStep(vorheriger) : undefined;
  const einladenderName = mitarbeit?.einladender?.name ?? t('mitarbeit.einerSie');
  const anwesend = mitarbeit
    // Wer fertig ist und nur noch das Danke-Blatt offen hat, zählt nicht mehr mit.
    ? [{ kuerzel: mitarbeit.ich.kuerzel, name: mitarbeit.ich.name, ich: true }, ...live.anwesend.filter((a) => a.ort !== 'danke').map((a) => ({ kuerzel: a.kuerzel, name: a.name }))]
    : undefined;
  const offeneEinladungen = !helfer && mitarbeit
    ? mitarbeit.helfer.filter((h) => !h.zurueckgegeben_am).map((h) => ({ id: h.id, name: h.name }))
    : [];
  // Die Kollegin, um die es auf der Arbeitsteilung geht: die offene Einladung, sonst die letzte.
  const helferEintrag = !helfer && mitarbeit
    ? [...mitarbeit.helfer].reverse().find((h) => !h.zurueckgegeben_am) ?? mitarbeit.helfer[mitarbeit.helfer.length - 1] ?? null
    : null;
  const helferDa = helferEintrag ? live.anwesend.find((a) => a.rolle === 'beschreiben' && a.name === helferEintrag.name && a.ort !== 'danke') : undefined;
  const helferStand: HelferStand | null = helferEintrag ? {
    id: helferEintrag.id,
    name: helferEintrag.name,
    zustand: helferEintrag.zurueckgegeben_am ? 'fertig' : helferDa ? 'da' : helferEintrag.bestaetigt ? 'pause' : 'offen',
    ortLabel: helferDa?.ortLabel ?? null,
    etappe: helferDa?.etappe ?? null,
    zuletzt: helferEintrag.zuletzt,
  } : null;
  const kontaktFertig = kontaktVollstaendig(draft);
  const oben = (
    <MitarbeitZeilen
      anwesend={live.anwesend}
      tippt={live.tippt}
      online={live.online}
      ort={ort}
      eingeladen={step === 'aufgeteilt' || step === 'summary' ? [] : offeneEinladungen}
      onZurueckziehen={(id) => { void zurueckziehen(id); }}
      zurueck={zurueckVon}
      onZurueckGesehen={() => setZurueckVon(null)}
    />
  );
  // Der erste Punkt („Start“) gilt auch, solange vor der Bestätigung die Art gewählt wird.
  // Punkt „Start“ nur bis die Art gewählt ist; danach ist man in der Stelle (E-Mail kommt vor den Fragen).
  const punkt = step === 'capture' && !verified && !artGewaehlt ? 'verify' : step === 'einladen' || step === 'danke' || step === 'aufgeteilt' ? 'capture' : step;
  const artLabel = t(`kind.${(capture?.type ?? draft.contract_type) === 'freelance' ? 'contracting' : 'permanent'}Title`);
  const freemailBlocked = link?.link_type === 'public' && link?.allow_freemail === false;

  return (
    <IntakeShell
      steps={steps}
      activeStep={punkt}
      reachable={reachable}
      onStep={(k) => setStep(k as StepKey)}
      packages={state.packages}
      contracting={contracting}
      ownerName={link?.owner_name}
      saving={state.saving}
      saveError={state.saveError}
      lastSavedAt={state.lastSavedAt}
      onResumeLater={helfer ? undefined : () => setResumeOpen(true)}
      onBack={zurueck}
      anwesend={anwesend}
      // Auf der Arbeitsteilung und beim Warten steht der Stand der Kollegin schon im Blatt.
      oben={step === 'danke' || step === 'aufgeteilt' || (step === 'summary' && offeneEinladungen.length > 0) ? null : oben}
    >
      <AenderungenProvider value={{ hinweise, type: capture?.type ?? 'full-time', onRueck: rueckgaengig, onWeg: (ids) => setHinweise((x) => x.filter((y) => !ids.includes(y.id))) }}>
      <div onInput={beimTippen}>
      {state.saveError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription className="text-sm">
            {state.saveError} {t('flow.saveErrorNote')}
          </AlertDescription>
        </Alert>
      )}

      {knownCompany && step === 'packages' && (
        <Alert className="mb-4">
          <AlertDescription className="text-sm">
            {t('flow.knownCompany', { name: knownCompany.name })}
          </AlertDescription>
        </Alert>
      )}

      {step === 'capture' && capture && (
        <CaptureStep
          state={capture}
          onState={updateCapture}
          seedTitle={link?.prefill?.seed_title ?? null}
          seedText={link?.prefill?.seed_text ?? null}
          contactName={firstName(draft.contact_name ?? link?.prefill?.contact_name ?? null)}
          companyDefaults={{
            industry: draft.company_industry ?? link?.prefill?.industry ?? null,
            size: draft.company_size ?? link?.prefill?.company_size ?? null,
            company_name: draft.company_name ?? link?.prefill?.company_name ?? null,
            location: link?.prefill?.location ?? null,
          }}
          company={{
            company_name: draft.company_name ?? '',
            company_legal_name: draft.company_legal_name ?? '',
            company_website: draft.company_website ?? '',
            company_industry: draft.company_industry ?? '',
            company_street: draft.company_street ?? '',
            company_postal_code: draft.company_postal_code ?? '',
            company_city: draft.company_city ?? '',
            company_vat_id: draft.company_vat_id ?? '',
            company_registration_number: draft.company_registration_number ?? '',
          }}
          onCompany={(patch) => save(patch)}
          onEnrich={enrichCompany}
          askAi={askAi}
          parseText={parseText}
          parseUrl={parseUrl}
          parsePdf={parsePdf}
          onNext={() => setStep('contact')}
          onResumeLater={() => setResumeOpen(true)}
          sperreBisBestaetigt={!verified}
          onArt={() => setArtGewaehlt(true)}
          // E-Mail vor den Fragen (27.11.2026): der Code-Schritt an der Stelle, an der der Weg ihn braucht.
          bestaetigung={(weiter, ziel, status) => (
            <VerifyStep
              draft={draft}
              titel={ziel === 'einladen' ? t('verify.vorEinladenTitle') : t('verify.vorFragenTitle')}
              status={status}
              weiterLabel={ziel === 'einladen' ? t('verify.zurEinladung') : ziel === 'anzeige' ? t('verify.zurAnzeige') : t('verify.zuDenFragen')}
              art={draft.contact_name ? null : { label: artLabel, onChange: () => { setArtGewaehlt(false); setArtZeigen((n) => n + 1); } }}
              freemailBlocked={Boolean(freemailBlocked)}
              onSend={sendCode}
              onConfirm={confirmCode}
              mitFirma={!draft.contact_name}
              onEnrich={enrichCompany}
              onCompany={(patch) => save(patch)}
              onVerified={(company) => { setKnownCompany(company); weiter(); }}
            />
          )}
          artZeigen={artZeigen}
          nachWahl={artGewaehlt || helfer}
          onKollegen={!helfer ? () => setStep('einladen') : undefined}
          onOrt={setOrt}
          artFest={helfer}
          {...(helfer ? {
            nextLabel: t('mitarbeit.zurueckButton', { name: einladenderName }),
            onNext: () => { void (async () => {
              const res = await zurueckgeben();
              if (!isFailure(res)) { live.sende('zurueck'); setStep('danke'); }
            })(); },
          } : {})}
        />
      )}

      {step === 'contact' && !helfer && (
        <ContactStep
          draft={draft}
          freemailBlocked={Boolean(freemailBlocked)}
          onChange={(patch) => save(patch)}
          onNext={() => setStep(verified ? (contracting ? 'summary' : 'packages') : 'verify')}
          onEnrich={enrichCompany}
          verifiedEmail={verified ? draft.contact_email : null}
        />
      )}

      {step === 'verify' && (
        <VerifyStep
          draft={draft}
          {...(helfer ? {
            festeAdresse: mitarbeit?.ich.email ?? null,
            bestaetigt: Boolean(mitarbeit?.ich.bestaetigt),
            titel: t('mitarbeit.helferTitle'),
            ortText: t('mitarbeit.helferOrt', { name: einladenderName }),
          } : {})}
          art={helfer || draft.contact_name ? null : { label: artLabel, onChange: () => { setArtGewaehlt(false); setStep('capture'); setArtZeigen((n) => n + 1); } }}
          freemailBlocked={Boolean(freemailBlocked)}
          onSend={sendCode}
          onConfirm={confirmCode}
          mitFirma={!helfer && !draft.contact_name}
          onEnrich={enrichCompany}
          onCompany={(patch) => save(patch)}
          onVerified={(company) => {
            setKnownCompany(company);
            // Am Anfang geht es zur Stelle; kam die Bestätigung erst nach dem Kontakt, zum Paket.
            setStep(helfer || !draft.contact_name ? 'capture' : contracting ? 'summary' : 'packages');
          }}
        />
      )}

      {step === 'packages' && !helfer && (
        <PackageStep
          load={loadPackages}
          onSelect={selectPackage}
          onNext={() => setStep('summary')}
          onTerms={setRahmenvertrag}
        />
      )}

      {step === 'summary' && !helfer && offeneEinladungen.length > 0 && helferStand && (
        <WartenBlatt
          helfer={helferStand}
          etappen={[
            ...(['eckdaten', contracting ? 'konditionen' : 'verguetung', 'anforderungen', 'rahmendaten'] as const).map((e) => t(`intake:etappen.stage.${e}`)),
            t('intake:etappen.review'),
          ]}
          onSelbst={() => setStep('capture')}
          onZurueckziehen={() => { void zurueckziehen(helferStand.id); }}
        />
      )}

      {step === 'summary' && !helfer && offeneEinladungen.length === 0 && (
        <SummaryStep
          draft={draft}
          packages={state.packages}
          framework={rahmenvertrag}
          contracting={contracting
            ? { dayRateMin: capture?.freelance.dayRateMin ?? null, dayRateMax: capture?.freelance.dayRateMax ?? null }
            : null}
          summary={summaryRows}
          openQuestions={openQuestionCount}
          onBack={() => setStep('capture')}
          onForward={() => setForwardOpen(true)}
          onRecheckCompany={intake.recheckCompany}
          onRefreshDraft={intake.refreshDraft}
          onSubmit={async (signerName, unterzeichner) => {
            const res = await submit(signerName);
            if (!isFailure(res)) {
              if (res.requires_signature) setVorbereitung(true);
              setSubmitted({
                mandate: res.mandate_number ?? '',
                requiresSignature: res.requires_signature,
                mailSent: res.confirmation_sent,
              });
              if (!res.confirmation_sent) {
                toast.warning(t('flow.mailFailedToast'));
              }
              // Ohne Zwischenseite weiter zum Vertrag. Scheitert das, fragt die Seite wie bisher nach.
              if (res.requires_signature) {
                await waehlen(unterzeichner);
                setVorbereitung(false);
              }
            }
            return res;
          }}
        />
      )}

      {step === 'einladen' && !helfer && (
        <EinladenBlatt
          meineEmail={draft.contact_email}
          meinName={draft.contact_name}
          onSenden={async (email, name, nachricht, meinName) => {
            // Der eigene Name muss vor der Einladung am Entwurf stehen (er steht in der Mail).
            if (meinName && meinName !== draft.contact_name) { save({ contact_name: meinName }); await intake.flush(); }
            return forward(email, name, nachricht, 'beschreiben');
          }}
          onGesendet={(email) => { setFrischAn(email); setStep('aufgeteilt'); }}
        />
      )}

      {step === 'danke' && helfer && <DankeBlatt name={einladenderName} onWeiter={() => setStep('capture')} />}

      {step === 'aufgeteilt' && !helfer && helferStand && (
        <AufgeteiltBlatt
          helfer={helferStand}
          frischAn={frischAn}
          kontaktFertig={kontaktFertig}
          weiter={!kontaktFertig
            ? { label: t('mitarbeit.firmendaten'), onClick: () => setStep('contact') }
            : !contracting && draft.states.commercial !== 'confirmed'
              ? { label: t('mitarbeit.zumPaket'), onClick: () => setStep('packages') }
              // Sein Teil ist erledigt: anfragen erst, wenn die Kollegin zurückgegeben hat.
              : helferStand.zustand === 'fertig' ? { label: t('mitarbeit.zumAnfragen'), onClick: () => setStep('summary') } : null}
          onSelbst={() => setStep('capture')}
          onZurueckziehen={() => { void zurueckziehen(helferStand.id); setStep('capture'); }}
        />
      )}
      </div>
      </AenderungenProvider>

      <ForwardDialog open={forwardOpen} onOpenChange={setForwardOpen} onForward={forward} />
      <ResumeDialog
        open={resumeOpen}
        onOpenChange={setResumeOpen}
        defaultEmail={draft.contact_email}
        verified={draft.states.identity === 'email_verified'}
      />
    </IntakeShell>
  );
}

/**
 * Anrede aus dem, was der Link mitbringt.
 *
 * „Frau Weber" bleibt „Frau Weber", „Sabine Weber" wird zu „Frau Weber"? Nein —
 * das Geschlecht ist aus einem Namen nicht ableitbar, und ein falscher Griff
 * wiegt schwerer als gar keine Anrede. Deshalb: enthält die Vorbelegung bereits
 * eine Anrede, wird sie übernommen; sonst der vollständige Name.
 */
function firstName(name: string | null): string | null {
  if (!name) return null;
  return name.trim() || null;
}

function Step({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-[14px] bg-secondary p-4">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

/** Drehendes Symbol für M3Kopf (Vorbereitung, Prüfung). */
function Dreht({ className }: { className?: string }) {
  return <Loader2 className={cn(className, 'animate-spin text-muted-foreground')} />;
}

/** Grünes Häkchen: nur wo wirklich unterschrieben ist. */
function Unterschrieben({ className }: { className?: string }) {
  return <CheckCircle2 className={cn(className, 'text-emerald-600')} />;
}

/** Die Stelle (je Antwort zusammenführbar) aus dem lokalen Zustand. */
function felderAusCapture(c: CaptureState): Felder {
  return { built: c.built, answers: c.answers, dyn: c.dyn, freelance: c.freelance, flexibility: c.flexibility };
}

/** Dieselben Felder aus dem Serverstand. */
function felderAusDraft(d: { built?: unknown; answers?: unknown; dyn?: unknown; freelance?: unknown; flexibility?: unknown }): Felder {
  return { built: d.built ?? null, answers: d.answers ?? {}, dyn: d.dyn ?? null, freelance: d.freelance ?? null, flexibility: d.flexibility ?? {} };
}
