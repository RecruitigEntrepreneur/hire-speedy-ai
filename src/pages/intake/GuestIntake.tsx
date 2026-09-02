import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, FileSignature, Mail } from 'lucide-react';
import { MatchuntWordmark } from '@/components/ui/MatchuntWordmark';
import { IntakeShell, IntakeFailurePage, type StepDef } from '@/components/intake/guest/IntakeShell';
import { CaptureStep, emptyCapture, captureBriefingText, type CaptureState } from '@/components/intake/guest/CaptureStep';
import { ContactStep } from '@/components/intake/guest/ContactStep';
import { VerifyStep } from '@/components/intake/guest/VerifyStep';
import { PackageStep } from '@/components/intake/guest/PackageStep';
import { SignFrame } from '@/components/intake/guest/SignFrame';
import { SignerChoice } from '@/components/intake/guest/SignerChoice';
import { SummaryStep } from '@/components/intake/guest/SummaryStep';
import { ForwardDialog, ResumeDialog } from '@/components/intake/guest/IntakeDialogs';
import { buildIntakePayload, remoteLabel, levelLabel } from '@/lib/intakeMapping';
import { openBriefingQuestions } from '@/components/dashboard/IntakeBriefing';
import { useGuestIntake, isFailure } from '@/hooks/useGuestIntake';
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

const STEPS: StepDef[] = [
  { key: 'capture', label: 'Position' },
  { key: 'contact', label: 'Kontakt' },
  { key: 'verify', label: 'Bestätigen' },
  { key: 'packages', label: 'Paket' },
  { key: 'summary', label: 'Anfragen' },
];

type StepKey = (typeof STEPS)[number]['key'];

export default function GuestIntake() {
  const { token, draftToken } = useParams<{ token?: string; draftToken?: string }>();
  const intake = useGuestIntake(token, draftToken);
  const { state, save, sendCode, confirmCode, loadPackages, selectPackage, sendContract, submit, forward,
          askAi, parseText, parseUrl, parsePdf } = intake;

  const [step, setStep] = useState<StepKey>('capture');
  const [capture, setCapture] = useState<CaptureState | null>(null);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [knownCompany, setKnownCompany] = useState<{ name: string } | null>(null);
  const [submitted, setSubmitted] = useState<{ mandate: string; requiresSignature: boolean; mailSent: boolean } | null>(null);
  const [signed, setSigned] = useState(false);
  // Der Unterschriftslauf nach dem Absenden: erst fragen, dann versenden.
  const [signUrl, setSignUrl] = useState<string | null>(null);
  const [signerSentTo, setSignerSentTo] = useState<string | null>(null);
  const [signBusy, setSignBusy] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  const draft = state.draft;

  // ---- Zustand aus dem Entwurf herstellen ---------------------------------
  // Gebunden an die Entwurfs-ID, nicht an "schon mal gelaufen": ein Wechsel des
  // Entwurfs (anderer Token, weitergeleiteter Zugang) muss den lokalen Zustand
  // ersetzen, sonst zeigt die Seite weiter die vorige Aufnahme.
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!draft || hydratedFor.current === draft.id) return;
    hydratedFor.current = draft.id;
    setCapture({
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
    if (draft.states.review === 'pending_admin' || draft.states.review === 'accepted') setStep('summary');
    else if (draft.states.identity === 'email_verified') setStep(draft.states.commercial === 'confirmed' ? 'summary' : 'packages');
    else if (draft.states.identity === 'contact_provided') setStep('verify');
    else if (draft.built) setStep('capture');
  }, [draft]);

  // ---- Aufnahme-Zustand fortlaufend sichern -------------------------------
  const updateCapture = useCallback(
    (updater: (prev: CaptureState) => CaptureState) => {
      setCapture((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        save({
          contract_type: next.type,
          built: next.built,
          answers: next.answers,
          dyn: next.dyn,
          freelance: next.freelance,
          flexibility: next.flexibility,
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
        });
        return next;
      });
    },
    [save],
  );

  // ---- Abgeleitetes -------------------------------------------------------
  const reachable = useMemo(() => {
    if (!draft) return ['capture'];
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
    if (draft.states.identity !== 'anonymous') out.push('verify');
    if (draft.states.identity === 'email_verified') out.push('packages');
    if (draft.states.commercial === 'confirmed') out.push('summary');
    return out;
  }, [draft]);

  const summaryRows = useMemo(() => {
    if (!capture?.built || !draft) return [];
    const b = capture.built;
    const isFreelance = capture.type === 'freelance';
    const money = (min: number | null, max: number | null, suffix: string) => {
      if (min == null && max == null) return '—';
      if (min != null && max != null) return `${min.toLocaleString('de-DE')}–${max.toLocaleString('de-DE')} ${suffix}`;
      return `${(min ?? max)!.toLocaleString('de-DE')} ${suffix}`;
    };
    return [
      { label: 'Position', value: b.title || '—' },
      { label: 'Unternehmen', value: draft.company_legal_name || draft.company_name || '—' },
      { label: 'Standort', value: b.location || '—' },
      { label: 'Arbeitsmodell', value: remoteLabel(b.remote_type) },
      { label: 'Erfahrung', value: levelLabel(b.experience_level) },
      {
        label: isFreelance ? 'Tagessatz' : 'Gehaltsband',
        value: isFreelance
          ? money(capture.freelance.dayRateMin, capture.freelance.dayRateMax, '€ / Tag')
          : money(b.salary_min, b.salary_max, '€ p. a.'),
      },
      { label: 'Muss-Kriterien', value: b.must_haves.length ? b.must_haves.join(' · ') : '—' },
      { label: 'Kann-Kriterien', value: b.nice_to_haves.length ? b.nice_to_haves.join(' · ') : '—' },
      { label: 'Vertragsart', value: isFreelance ? 'Contracting / Freiberuflich' : 'Festanstellung' },
      { label: 'Ansprechpartner', value: [draft.contact_name, draft.contact_email].filter(Boolean).join(' · ') || '—' },
    ];
  }, [capture, draft]);

  const openQuestionCount = useMemo(() => {
    if (!capture?.built) return 0;
    if (capture.dyn.available) return capture.dyn.chapterProgress.filter((c) => c.state === 'open').length;
    return openBriefingQuestions(capture.type, { remote_type: capture.built.remote_type }, capture.answers).length;
  }, [capture]);

  // ---- Zustände der Seite -------------------------------------------------
  if (state.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
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
      f?.reason === 'expired' ? 'Dieser Link ist abgelaufen'
      : f?.reason === 'revoked' ? 'Dieser Link wurde deaktiviert'
      : f?.reason === 'exhausted' ? 'Dieser Link wurde bereits verwendet'
      : f?.reason === 'not_deployed' ? 'Noch nicht freigeschaltet'
      : 'Dieser Link ist nicht gültig';
    return (
      <IntakeFailurePage
        title={title}
        message={f?.message ?? 'Bitte wenden Sie sich an Ihren Ansprechpartner bei Matchunt.'}
        action={
          <Button asChild variant="outline">
            <Link to="/">Zur Startseite</Link>
          </Button>
        }
      />
    );
  }

  // ---- Eingereicht --------------------------------------------------------
  if (submitted || draft.states.review === 'pending_admin' || draft.states.review === 'accepted') {
    // Nach einem Neuladen ist submitted leer -- dann traegt der Entwurf die
    // Nummer. Ohne das stand dort "Vorgang ." ohne Nummer.
    const mandate = submitted?.mandate ?? draft.contract?.number ?? null;
    // Unterschrieben wird immer -- der Vertrag geht nach der Pruefung raus.
    const requiresSignature = true;

    const waehlen = async (args: { self: boolean; name?: string; email?: string }) => {
      setSignBusy(true);
      setSignError(null);
      const res = await sendContract(args);
      setSignBusy(false);
      if (isFailure(res)) {
        setSignError(res.message);
        return;
      }
      if (res.customer_signed) setSigned(true);
      else if (res.sign_url) setSignUrl(res.sign_url);
      else setSignerSentTo(res.signer?.email ?? null);
    };

    // Was der Server ueber den Vertragslauf weiss. Entscheidend nach einem
    // Neuladen: ohne das saehe ein Kunde, der den Tab geschlossen hat, nur
    // eine Bestaetigung -- und keinen Weg mehr zur Unterschrift.
    const vertrag = draft.contract;
    const bereitsUnterschrieben = signed || Boolean(vertrag?.customer_signed);
    const anDrittenVersandt = signerSentTo
      ?? (vertrag?.has_envelope && !vertrag.customer_signed && vertrag.signer_email
          && vertrag.signer_email !== draft.contact_email
          ? vertrag.signer_email : null);

    // (1) Die Frage: wer unterschreibt. Solange sie offen ist, ist SIE die
    //     Seite -- der Kunde soll den Lauf abschliessen, solange er hier ist.
    //     Greift auch nach einem Neuladen, solange nichts unterschrieben und
    //     nichts an einen Dritten unterwegs ist.
    if (!signUrl && !anDrittenVersandt && !bereitsUnterschrieben) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
          <div className="w-full max-w-lg space-y-6">
            <MatchuntWordmark size="sm" className="justify-center" />
            <p className="text-center text-sm text-muted-foreground">
              Ihre Anfrage ist eingegangen{mandate ? <> — Vorgang <strong className="text-foreground">{mandate}</strong></> : null}.
            </p>
            <SignerChoice
              contactName={draft.contact_name}
              busy={signBusy}
              error={signError}
              onChoose={waehlen}
            />
          </div>
        </div>
      );
    }

    // (2) Eigenhaendig: der Vertrag im Rahmen, auf unserer Seite.
    if (signUrl && !signed) {
      return (
        <div className="min-h-screen bg-background px-4 py-8">
          <div className="mx-auto w-full max-w-4xl space-y-4">
            <MatchuntWordmark size="sm" className="justify-center" />
            <div className="text-center">
              <h1 className="text-xl font-bold tracking-tight">Vertrag unterzeichnen</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Rahmenvertrag und Einzelauftrag in einem Durchgang{mandate ? <>, Vorgang <strong className="text-foreground">{mandate}</strong></> : null}.
                Sie unterschreiben zuerst, danach zeichnet Matchunt gegen.
              </p>
            </div>
            <SignFrame url={signUrl} onDone={() => setSigned(true)} />
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-lg">
          <MatchuntWordmark size="sm" className="mb-8 justify-center" />
          <Card>
            <CardContent className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">Ihre Anfrage ist bei uns</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {mandate ? <>Vorgangsnummer <strong className="text-foreground">{mandate}</strong>. </> : null}
                Wir prüfen Ihre Beauftragungsanfrage für{' '}
                <strong className="text-foreground">{capture?.built?.title ?? draft.title ?? 'Ihre Position'}</strong>.
              </p>

              {/* Liegt eine Unterschriftsansicht vor, ist sie der naechste
                  Schritt — nicht eine Mail, die vielleicht im Spam landet.
                  Fehlt sie (DocuSign nicht erreichbar), sagt die Seite das
                  ehrlich, statt auf etwas zu verweisen, das nicht kommt. */}
              <div className="mt-6 space-y-3 text-left">
                <Step icon={Mail} title="Bestätigung per E-Mail"
                  text={`Eine Übersicht Ihrer Anfrage samt Konditionen ist an ${draft.contact_email} unterwegs.`} />
                <Step icon={FileSignature} title="Unterschrift"
                  text={bereitsUnterschrieben
                    ? 'Ihre Unterschrift liegt vor. Matchunt zeichnet gegen — danach starten wir die Suche.'
                    : anDrittenVersandt
                    ? `Der Vertrag ist an ${anDrittenVersandt} unterwegs. Sobald dort unterschrieben ist, zeichnet Matchunt gegen und wir starten die Suche.`
                    : 'Sie erhalten den Vertrag zur digitalen Unterschrift. Sie unterschreiben zuerst, danach zeichnet Matchunt gegen — erst dann starten wir die Suche.'} />
              </div>

              <Alert className="mt-6 text-left">
                <AlertDescription className="text-xs">
                  Mit dieser Anfrage ist noch kein Vertrag zustande gekommen und es sind Ihnen keine
                  Kosten entstanden. Ein Vertrag entsteht erst mit unserer ausdrücklichen Annahme.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ---- Der Flow -----------------------------------------------------------
  const link = state.link;
  const freemailBlocked = link?.link_type === 'public' && link?.allow_freemail === false;

  return (
    <IntakeShell
      steps={STEPS}
      activeStep={step}
      reachable={reachable}
      onStep={(k) => setStep(k as StepKey)}
      packages={state.packages}
      ownerName={link?.owner_name}
      saving={state.saving}
      saveError={state.saveError}
      lastSavedAt={state.lastSavedAt}
      onResumeLater={() => setResumeOpen(true)}
    >
      {state.saveError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription className="text-sm">
            {state.saveError} Ihre Eingaben sind noch im Browser und werden beim nächsten Versuch
            mitgeschickt — bitte schließen Sie das Fenster noch nicht.
          </AlertDescription>
        </Alert>
      )}

      {knownCompany && step === 'packages' && (
        <Alert className="mb-4">
          <AlertDescription className="text-sm">
            Wir kennen {knownCompany.name} bereits. Ihr Ansprechpartner prüft, ob eine bestehende
            Vereinbarung greift.
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
          askAi={askAi}
          parseText={parseText}
          parseUrl={parseUrl}
          parsePdf={parsePdf}
          onNext={() => setStep('contact')}
        />
      )}

      {step === 'contact' && (
        <ContactStep
          draft={draft}
          freemailBlocked={Boolean(freemailBlocked)}
          onChange={(patch) => save(patch)}
          onNext={() => setStep('verify')}
        />
      )}

      {step === 'verify' && (
        <VerifyStep
          draft={draft}
          onSend={sendCode}
          onConfirm={confirmCode}
          onEditEmail={() => setStep('contact')}
          onVerified={(company) => {
            setKnownCompany(company);
            setStep('packages');
          }}
        />
      )}

      {step === 'packages' && (
        <PackageStep
          load={loadPackages}
          onSelect={selectPackage}
          onNext={() => setStep('summary')}
        />
      )}

      {step === 'summary' && (
        <SummaryStep
          draft={draft}
          packages={state.packages}
          summary={summaryRows}
          openQuestions={openQuestionCount}
          onBack={() => setStep('capture')}
          onForward={() => setForwardOpen(true)}
          onSubmit={async (signerName) => {
            const res = await submit(signerName);
            if (!isFailure(res)) {
              setSubmitted({
                mandate: res.mandate_number,
                requiresSignature: res.requires_signature,
                mailSent: res.confirmation_sent,
              });
              if (!res.confirmation_sent) {
                toast.warning('Ihre Anfrage ist eingegangen, die Bestätigungsmail konnte aber nicht zugestellt werden.');
              }
            }
            return res;
          }}
        />
      )}

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
    <div className="flex gap-3 rounded-lg border p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
