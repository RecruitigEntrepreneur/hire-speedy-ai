import { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { intlLocale } from '@/i18n/languages';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { ArrowLeft, ChevronDown, ChevronUp, Loader2, Plus, Send, ShieldCheck, Users } from 'lucide-react';
import { ContractingKarte } from '@/components/intake/guest/SummaryStep';
import { CONTRACTING_ZUSTIMMUNG } from '../../../../supabase/functions/_shared/contracting-konditionen';
import { contractingUnterRahmen, type ClientFramework, type CommercialChoice, type PublicPackage } from '@/hooks/useClientIntake';

/**
 * Einreichen im Dashboard.
 *
 * Mit Rahmenvertrag stehen die Konditionen fest: keine Paketwahl, keine
 * Haekchen, keine Unterschrift. Aufstocken ist die einzige Wahl -- nur nach
 * oben, nur fuer diese Position, mit EINER Bestaetigung in Textform.
 *
 * Ohne Rahmenvertrag (einmalig je Kunde) waehlt der Kunde ein Paket und fragt
 * die Beauftragung an, mit demselben Einwilligungstext wie beim Link.
 *
 * Contracting kennt weder Pakete noch Prozente: dieselbe Karte "Konditionen
 * Contracting" wie auf /start. Ohne Unterschrift nur unter einem Rahmenvertrag
 * ab Fassung 2, sonst Anfrage mit der Zustimmung fuer Contracting.
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
  /** Gesetzt bei Contracting: das Budget aus der Aufnahme fuer die Konditionen-Karte. */
  contracting?: { dayRateMin: number | null; dayRateMax: number | null } | null;
  /** Fachbereich mit interner Freigabe: geht an HR statt an Matchunt. */
  needsInternalApproval: boolean;
  /** Mitte des Gehaltsbands, fuer die Beispielrechnung. */
  exampleSalary: number | null;
  openQuestions: number;
  signerName: string;
  onBack: () => void;
  onDelegate: () => void;
  onSubmit: (choice: CommercialChoice | null) => Promise<void>;
  /** Warum noch nicht eingereicht werden kann (Firma nicht verifiziert) -- oder null. */
  sperre?: string | null;
}


export function SubmitStep({
  rows, framework, frameworkLoading, frameworkReadable, packages, isFreelance, contracting = null, needsInternalApproval,
  exampleSalary, openQuestions, signerName, onBack, onDelegate, onSubmit, sperre = null,
}: Props) {
  // clientFunnel wird nur gelesen: die drei Sätze der Zustimmung stehen dort (summary.consent1…3),
  // deutsch zeichengleich mit consentText.ts.
  const { t, i18n } = useTranslation(['intake', 'intakeCatalog', 'clientFunnel']);
  const locale = intlLocale(i18n.language);
  const eur = (n: number) => `${Math.round(n).toLocaleString(locale)} €`;
  const pct = (n: number) => n.toLocaleString(locale);
  const datum = (iso: string) => new Date(iso).toLocaleDateString(locale);
  const consentLines = [t('clientFunnel:summary.consent1'), t('clientFunnel:summary.consent2'), t('clientFunnel:summary.consent3')];
  const signerLine = (
    <span className="block text-xs text-muted-foreground">
      <Trans t={t} i18nKey="submit.signerLine" values={{ name: signerName }} components={{ agb: <Link to="/agb" className="underline" /> }} />
    </span>
  );
  const ausRahmenvertrag = (f: ClientFramework) =>
    f.agreed_at
      ? t('submit.fromFrameworkDate', { number: f.agreement_number, date: datum(f.agreed_at) })
      : t('submit.fromFramework', { number: f.agreement_number });
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
      {sperre && (
        <p className="mt-3 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">{sperre}</p>
      )}
      {openQuestions > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          <Trans
            t={t}
            i18nKey="submit.openItems"
            count={openQuestions}
            components={{ back: <button type="button" onClick={onBack} className="underline underline-offset-2" /> }}
          />
        </p>
      )}
    </div>
  );

  // ---- Fachbereich mit interner Freigabe ----------------------------------
  if (needsInternalApproval) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('submit.approvalTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {contracting ? t('submit.approvalLeadContracting') : t('submit.approvalLead')}
          </p>
        </div>
        {summary}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onBack} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> {t('shared.back')}</Button>
          <Button onClick={() => run(null)} disabled={busy || !!sperre} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t('submit.sendForApproval')}
          </Button>
        </div>
      </div>
    );
  }

  // ---- Contracting ---------------------------------------------------------
  if (contracting) {
    if (frameworkLoading && frameworkReadable) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('submit.termsLoading')}
        </div>
      );
    }
    const unterRv = contractingUnterRahmen(framework);
    // HR/Admin sehen den Rahmenvertrag nicht (RLS): einreichen, Matchunt prueft.
    const ohneEinsicht = !framework && !frameworkReadable;
    const direkt = unterRv || ohneEinsicht;
    const schluss = unterRv
      ? t('submit.closeNoSignature')
      : ohneEinsicht
        ? t('submit.closeNoInsight')
        : framework
          ? t('submit.closeOldFramework', { number: framework.agreement_number })
          : t('submit.closeNoFramework');
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{direkt ? t('submit.titleSubmit') : t('submit.titleRequest')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('submit.lead')}
          </p>
        </div>
        {summary}
        <ContractingKarte budget={contracting} />
        {unterRv && framework && (
          <p className="-mt-2 text-xs text-muted-foreground">
            {ausRahmenvertrag(framework)}
          </p>
        )}
        {!direkt && (
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
            <span className="space-y-1">
              {/* Wortlaut aus _shared/contracting-konditionen.ts (derselbe wie im Nachweis), vorerst nur deutsch. */}
              <span className="block">{CONTRACTING_ZUSTIMMUNG}</span>
              {signerLine}
            </span>
          </label>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onBack} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> {t('shared.back')}</Button>
          <Button
            onClick={() => run({ package_key: null, upgraded: false })}
            disabled={busy || !!sperre || (!direkt && !consent)}
            className="gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {direkt ? t('submit.submitPosition') : t('submit.requestOrder')}
          </Button>
          {direkt && (
            <Button variant="ghost" onClick={onDelegate} className="gap-1.5 text-muted-foreground">
              <Users className="h-4 w-4" /> {t('submit.delegate')}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{schluss}</p>
      </div>
    );
  }

  // ---- Mit Rahmenvertrag ---------------------------------------------------
  if (framework || (!frameworkReadable && !frameworkLoading)) {
    const canUpgrade = !!framework && !isFreelance && upgrades.length > 0;
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('submit.titleSubmit')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('submit.lead')}
          </p>
        </div>
        {summary}

        <div className="rounded-xl border p-4">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 text-sm">
              <p className="font-medium">{t('submit.yourTerms')}</p>
              {framework ? (
                <>
                  <p className="mt-0.5">
                    {t('submit.termsLine', { name: framework.name, percent: pct(framework.fee_percent) })}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {ausRahmenvertrag(framework)}
                  </p>
                </>
              ) : (
                <p className="mt-0.5 text-muted-foreground">
                  {t('submit.termsFromCompany')}
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
                {t('submit.upgradeToggle')}
                <span className="font-normal text-muted-foreground">{t('submit.upgradeToggleHint')}</span>
                {!upOpen && <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />}
              </button>

              {upOpen && (
                <div className="mt-3 space-y-2">
                  {[
                    {
                      key: basePkg!, label: t('submit.optionBase', { name: framework!.name }), pct: framework!.fee_percent,
                      hint: framework!.continuity_days ? t('submit.hintBaseDays', { days: framework!.continuity_days }) : t('submit.hintBaseNone'),
                    },
                    ...upgrades.map((p) => ({
                      key: p.package_key,
                      label: p.public_name,
                      pct: p.client_fee_pct,
                      hint: p.claim_notice_days
                        ? t('submit.hintUpgradeNotice', { days: p.continuity_days, notice: p.claim_notice_days })
                        : t('submit.hintUpgrade', { days: p.continuity_days }),
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
                          <span className="block text-sm font-medium">{t('submit.optionLabel', { label: o.label, percent: pct(o.pct) })}</span>
                          <span className="block text-xs text-muted-foreground">{o.hint}</span>
                        </span>
                        {exampleSalary ? (
                          <span className="whitespace-nowrap text-sm tabular-nums">{eur((exampleSalary * o.pct) / 100)}</span>
                        ) : null}
                      </button>
                    );
                  })}
                  <p className="text-xs text-muted-foreground">
                    {exampleSalary ? t('submit.dueNoteExample', { amount: eur(exampleSalary) }) : t('submit.dueNote')}
                  </p>
                  {isUpgrade && selectedPkg && (
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                      <Checkbox checked={upgradeConfirmed} onCheckedChange={(v) => setUpgradeConfirmed(v === true)} className="mt-0.5" />
                      <span>
                        {t('submit.upgradeConfirm', { name: selectedPkg.public_name, percent: pct(selectedPkg.client_fee_pct) })}
                      </span>
                    </label>
                  )}
                  <p className="text-[11px] text-amber-600">
                    {t('submit.upgradePreview')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onBack} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> {t('shared.back')}</Button>
          <Button
            onClick={() => run({ package_key: selectedKey ?? 'core', upgraded: isUpgrade })}
            disabled={busy || !!sperre || (isUpgrade && !upgradeConfirmed)}
            className="gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isUpgrade && selectedPkg ? t('submit.submitWith', { name: selectedPkg.public_name }) : t('submit.submitPosition')}
          </Button>
          <Button variant="ghost" onClick={onDelegate} className="gap-1.5 text-muted-foreground">
            <Users className="h-4 w-4" /> {t('submit.delegate')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('submit.closeNoSignature')}
        </p>
      </div>
    );
  }

  // ---- Ohne Rahmenvertrag (einmalig) --------------------------------------
  if (frameworkLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {t('submit.termsLoading')}
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('submit.packagesTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('submit.packagesLead')}
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
              <p className="mt-1 text-2xl font-bold">{t('submit.percent', { percent: pct(p.client_fee_pct) })}</p>
              <p className="text-xs text-muted-foreground">{t('submit.ofTargetSalary')}</p>
              {p.summary && <p className="mt-2 text-xs text-muted-foreground">{p.summary}</p>}
            </button>
          );
        })}
      </div>
      {summary}
      <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm">
        <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
        <span className="space-y-1">
          {consentLines.map((line) => <span key={line} className="block">{line}</span>)}
          {signerLine}
        </span>
      </label>
      <Alert>
        <AlertDescription className="text-xs">
          {t('submit.noFrameworkPreview')}
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onBack} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> {t('shared.back')}</Button>
        <Button
          onClick={() => run({ package_key: chosen!, upgraded: false })}
          disabled={busy || !!sperre || !chosen || !consent}
          className="gap-2"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t('submit.requestOrder')}
        </Button>
      </div>
    </div>
  );
}
