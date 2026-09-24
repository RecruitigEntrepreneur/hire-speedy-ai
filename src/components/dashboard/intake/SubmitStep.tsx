import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { ArrowLeft, ChevronDown, ChevronUp, Loader2, Plus, Send, ShieldCheck, Users } from 'lucide-react';
import { CONSENT_TEXT } from '@/components/intake/guest/consentText';
import type { ClientFramework, CommercialChoice, PublicPackage } from '@/hooks/useClientIntake';

/**
 * Einreichen im Dashboard.
 *
 * Mit Rahmenvertrag stehen die Konditionen fest: keine Paketwahl, keine
 * Haekchen, keine Unterschrift. Aufstocken ist die einzige Wahl -- nur nach
 * oben, nur fuer diese Position, mit EINER Bestaetigung in Textform.
 *
 * Ohne Rahmenvertrag (einmalig je Kunde) waehlt der Kunde ein Paket und fragt
 * die Beauftragung an, mit demselben Einwilligungstext wie beim Link.
 */

interface Row { label: string; value: string }

interface Props {
  rows: Row[];
  framework: ClientFramework | null;
  frameworkLoading: boolean;
  /** Der Inhaber sieht den Rahmenvertrag; HR/Admin (noch) nicht -- RLS. */
  frameworkReadable: boolean;
  packages: PublicPackage[];
  isFreelance: boolean;
  /** Fachbereich mit interner Freigabe: geht an HR statt an Matchunt. */
  needsInternalApproval: boolean;
  /** Mitte des Gehaltsbands, fuer die Beispielrechnung. */
  exampleSalary: number | null;
  openQuestions: number;
  signerName: string;
  onBack: () => void;
  onDelegate: () => void;
  onSubmit: (choice: CommercialChoice | null) => Promise<void>;
}

const eur = (n: number) => `${Math.round(n).toLocaleString('de-DE')} €`;

export function SubmitStep({
  rows, framework, frameworkLoading, frameworkReadable, packages, isFreelance, needsInternalApproval,
  exampleSalary, openQuestions, signerName, onBack, onDelegate, onSubmit,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [upOpen, setUpOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [upgradeConfirmed, setUpgradeConfirmed] = useState(false);
  const [consent, setConsent] = useState(false);

  const basePkg = framework?.package_key ?? null;
  const upgrades = useMemo(
    () =>
      framework
        ? packages.filter((p) => p.client_fee_pct > framework.fee_percent && p.continuity_days)
        : [],
    [packages, framework],
  );
  const selectedKey = chosen ?? basePkg;
  const isUpgrade = !!framework && !!chosen && chosen !== basePkg;
  const selectedPkg = packages.find((p) => p.package_key === selectedKey) ?? null;

  const run = async (choice: CommercialChoice | null) => {
    setBusy(true);
    try {
      await onSubmit(choice);
    } finally {
      setBusy(false);
    }
  };

  const summary = (
    <div className="rounded-xl border bg-card p-4">
      <dl className="grid grid-cols-[8.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="min-w-0 break-words">{r.value}</dd>
          </div>
        ))}
      </dl>
      {openQuestions > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {openQuestions} Angaben sind noch offen. Sie können trotzdem einreichen, Lücken lassen sich später ergänzen.{' '}
          <button type="button" onClick={onBack} className="underline underline-offset-2">Zurück zur Position</button>
        </p>
      )}
    </div>
  );

  // ---- Fachbereich mit interner Freigabe ----------------------------------
  if (needsInternalApproval) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Zur Freigabe an Ihre Personalabteilung</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            In Ihrem Unternehmen gibt HR neue Positionen frei, bevor sie an Matchunt gehen. Konditionen und
            Aufstocken entscheidet HR beim Freigeben.
          </p>
        </div>
        {summary}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onBack} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Zurück</Button>
          <Button onClick={() => run(null)} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Zur Freigabe senden
          </Button>
        </div>
      </div>
    );
  }

  // ---- Mit Rahmenvertrag ---------------------------------------------------
  if (framework || (!frameworkReadable && !frameworkLoading)) {
    const canUpgrade = !!framework && !isFreelance && upgrades.length > 0;
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Prüfen und einreichen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            So bekommen die Headhunter die Position, ohne Ihren Firmennamen.
          </p>
        </div>
        {summary}

        <div className="rounded-xl border p-4">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 text-sm">
              <p className="font-medium">Ihre Konditionen</p>
              {framework ? (
                <>
                  <p className="mt-0.5">
                    {framework.name} · {framework.fee_percent.toLocaleString('de-DE')} % des Bruttojahreszielgehalts · nur bei Einstellung
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    aus Rahmenvertrag {framework.agreement_number}
                    {framework.agreed_at ? ` · vereinbart am ${new Date(framework.agreed_at).toLocaleDateString('de-DE')}` : ''}
                  </p>
                </>
              ) : (
                <p className="mt-0.5 text-muted-foreground">
                  Es gelten die Konditionen aus dem Rahmenvertrag Ihres Unternehmens.
                </p>
              )}
            </div>
          </div>

          {canUpgrade && (
            <div className="mt-3 border-t pt-3">
              <button
                type="button"
                onClick={() => setUpOpen((o) => !o)}
                className="flex w-full items-center gap-1.5 text-left text-sm font-medium text-primary"
              >
                {upOpen ? <ChevronUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                Diese Position zusätzlich absichern
                <span className="font-normal text-muted-foreground">· erneuter Suchlauf, falls die Person früh geht</span>
                {!upOpen && <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />}
              </button>

              {upOpen && (
                <div className="mt-3 space-y-2">
                  {[
                    { key: basePkg!, label: `Wie im Rahmenvertrag · ${framework!.name}`, pct: framework!.fee_percent, hint: framework!.continuity_days ? `erneuter Suchlauf ${framework!.continuity_days} Tage` : 'ohne erneuten Suchlauf' },
                    ...upgrades.map((p) => ({
                      key: p.package_key,
                      label: p.public_name,
                      pct: p.client_fee_pct,
                      hint: `erneuter Suchlauf, wenn die Person in den ersten ${p.continuity_days} Tagen geht${p.claim_notice_days ? ` · Meldung binnen ${p.claim_notice_days} Tagen` : ''}`,
                    })),
                  ].map((o) => {
                    const on = selectedKey === o.key;
                    return (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => { setChosen(o.key); setUpgradeConfirmed(false); }}
                        className={cn(
                          'grid w-full grid-cols-[1rem_1fr_auto] items-start gap-2.5 rounded-lg border p-3 text-left transition-colors',
                          on ? 'border-primary ring-1 ring-primary' : 'hover:bg-muted/40',
                        )}
                      >
                        <span className={cn('mt-1 h-3 w-3 rounded-full border', on && 'border-primary bg-primary')} />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{o.label} · {o.pct.toLocaleString('de-DE')} %</span>
                          <span className="block text-xs text-muted-foreground">{o.hint}</span>
                        </span>
                        {exampleSalary ? (
                          <span className="whitespace-nowrap text-sm tabular-nums">{eur((exampleSalary * o.pct) / 100)}</span>
                        ) : null}
                      </button>
                    );
                  })}
                  <p className="text-xs text-muted-foreground">
                    {exampleSalary ? `Beispiel bei ${eur(exampleSalary)} Zielgehalt, ` : ''}fällig nur bei Einstellung. Ihr
                    Rahmenvertrag bleibt unverändert.
                  </p>
                  {isUpgrade && selectedPkg && (
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                      <Checkbox checked={upgradeConfirmed} onCheckedChange={(v) => setUpgradeConfirmed(v === true)} className="mt-0.5" />
                      <span>
                        Ich vereinbare für diese Position {selectedPkg.public_name} ({selectedPkg.client_fee_pct.toLocaleString('de-DE')} %)
                        abweichend vom Rahmenvertrag.
                      </span>
                    </label>
                  )}
                  <p className="text-[11px] text-amber-600">
                    Vorschau: Aufstocken braucht noch die Vertragsanpassung (§ 8 Abs. 10) und den Konditionen-Snapshot je Position.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onBack} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Zurück</Button>
          <Button
            onClick={() => run({ package_key: selectedKey ?? 'core', upgraded: isUpgrade })}
            disabled={busy || (isUpgrade && !upgradeConfirmed)}
            className="gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isUpgrade && selectedPkg ? `Mit ${selectedPkg.public_name} einreichen` : 'Position einreichen'}
          </Button>
          <Button variant="ghost" onClick={onDelegate} className="gap-1.5 text-muted-foreground">
            <Users className="h-4 w-4" /> An Kollegen weitergeben
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Keine Unterschrift nötig. Matchunt prüft die Position und gibt sie frei.
        </p>
      </div>
    );
  }

  // ---- Ohne Rahmenvertrag (einmalig) --------------------------------------
  if (frameworkLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Konditionen werden geladen …
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Wie möchten Sie zusammenarbeiten?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Alle drei Pakete sind reine Erfolgshonorare. Kein Retainer, keine Fixkosten. Das Paket gilt danach für
          alle Positionen, einzelne Positionen können Sie später aufstocken.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {packages.map((p) => {
          const on = chosen === p.package_key;
          return (
            <button
              key={p.package_key}
              type="button"
              onClick={() => setChosen(p.package_key)}
              className={cn('rounded-xl border p-4 text-left transition-colors', on ? 'border-primary ring-1 ring-primary' : 'hover:bg-muted/40')}
            >
              <p className="font-medium">{p.public_name}</p>
              <p className="mt-1 text-2xl font-bold">{p.client_fee_pct.toLocaleString('de-DE')} %</p>
              <p className="text-xs text-muted-foreground">des Bruttojahreszielgehalts</p>
              {p.summary && <p className="mt-2 text-xs text-muted-foreground">{p.summary}</p>}
            </button>
          );
        })}
      </div>
      {summary}
      <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm">
        <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
        <span className="space-y-1">
          {CONSENT_TEXT.map((t) => <span key={t} className="block">{t}</span>)}
          <span className="block text-xs text-muted-foreground">Ihr Name: {signerName} · <Link to="/agb" className="underline">AGB</Link></span>
        </span>
      </label>
      <Alert>
        <AlertDescription className="text-xs">
          Vorschau: Für Kunden ohne Rahmenvertrag folgt danach der Rahmenvertrag zur Unterschrift (DocuSign). Im
          Dashboard ist dieser Schritt noch nicht angeschlossen.
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onBack} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Zurück</Button>
        <Button
          onClick={() => run({ package_key: chosen!, upgraded: false })}
          disabled={busy || !chosen || !consent}
          className="gap-2"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Beauftragung anfragen
        </Button>
      </div>
    </div>
  );
}
