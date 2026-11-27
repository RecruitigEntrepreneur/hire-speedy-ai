import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { intlLocale } from '@/i18n/languages';
import { cn } from '@/lib/utils';
import { M3Hinweis, M3Kopf } from './m3';
import { Button } from '@/components/ui/button';
import { Check, Loader2, Package, TriangleAlert } from 'lucide-react';
import { isFailure, type IntakeFailure, type IntakePackage, type IntakePackageOffer } from '@/hooks/useGuestIntake';
import { FileCheck2 } from 'lucide-react';

/**
 * Die Paketwahl.
 *
 * Drei Karten, keine vierte, kein Schieberegler und kein Knopf „individuelle
 * Konditionen anfragen". Es gibt drei Pakete und keine Verhandlung — das ist
 * keine Einschränkung der Oberfläche, sondern das Produkt.
 *
 * Was hier steht, kommt aus `commercial_packages_public`: Honorarsatz, Dauer,
 * Fristen. Recruiter-Anteil, Marge, Einbehalt und Auslobung erreichen den
 * Browser nicht — die View führt sie gar nicht.
 *
 * Bewusst nur Prozentsätze, keine Euro-Beträge. Abgerechnet wird nach dem
 * Bruttojahreszielgehalt aus dem unterzeichneten Arbeitsvertrag — eine Zahl
 * auf Basis der Gehaltsangabe aus der Aufnahme würde später fast immer
 * abweichen. Ein Prozentsatz stimmt in jedem Fall.
 *
 * Kartentexte seit 11.11.2026 (K2, Bauplan Abschnitt 4): Nachbesetzung statt
 * „erneuter Suchlauf“, keine Suchtage, bei Core kein Negativ-Satz. Dieselben
 * Texte stehen im Datenblatt des Rahmenvertrags.
 */

/**
 * K2: Kartentexte je Paket (gehen den Texten aus der Datenbank vor). Die Texte
 * stehen in den Sprachdateien (clientFunnel: packages.core1…, continuity1…),
 * ebenso der Kasten unter den Karten (packages.replacementText).
 */
type CardText = { short: string; head: string; bullets: string[] };
const coreBullets = (t: TFunction<'clientFunnel'>) => [
  t('packages.core1'), t('packages.core2'), t('packages.core3'), t('packages.core4'),
];
const continuityBullets = (t: TFunction<'clientFunnel'>, days: number) => [
  t('packages.continuity1'), t('packages.continuity2', { days }), t('packages.continuity3'), t('packages.continuity4'),
];
function packageCard(t: TFunction<'clientFunnel'>, key: IntakePackage['key']): CardText | null {
  switch (key) {
    case 'core': return { short: 'Core', head: t('packages.coreHead'), bullets: coreBullets(t) };
    case 'continuity_90': return { short: 'Continuity 90', head: t('packages.continuityHead'), bullets: continuityBullets(t, 90) };
    case 'continuity_180': return { short: 'Continuity 180', head: t('packages.continuityHead'), bullets: continuityBullets(t, 180) };
    default: return null;
  }
}

interface Props {
  load: () => Promise<IntakePackageOffer | IntakeFailure>;
  onSelect: (key: string) => Promise<any>;
  onNext: () => void;
  /** Meldet die im Rahmenvertrag vereinbarte Kondition nach oben, damit die
   *  Zusammenfassung sie zeigen kann statt einer leeren Paketzeile. */
  onTerms?: (rv: IntakePackageOffer['framework']) => void;
}

export function PackageStep({ load, onSelect, onNext, onTerms }: Props) {
  const { t, i18n } = useTranslation('clientFunnel');
  const [offer, setOffer] = useState<IntakePackageOffer | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void load().then((res) => {
      if (!active) return;
      if (isFailure(res)) {
        setLoadError(true);
        return;
      }
      setOffer(res);
      setChosen(res.selected?.key ?? null);
      onTerms?.(res.framework ?? null);
    });
    return () => { active = false; };
  }, [load, onTerms]);

  // Stil M3 (26.11.2026): Antippen wählt (und speichert), „Weiter“ geht zur Zusammenfassung.
  // Vorher sprang die Wahl sofort weiter -- mit aufklappenden Zeilen sähe man dann nicht, was gewählt ist.
  const select = async (key: string) => {
    setBusy(key);
    const res = await onSelect(key);
    setBusy(null);
    if (!isFailure(res)) setChosen(key);
  };

  if (loadError) {
    return <M3Hinweis icon={TriangleAlert}>{t('packages.loadError')}</M3Hinweis>;
  }
  if (!offer) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('packages.loading')}
      </div>
    );
  }

  // Bestandskunde: die Kondition wurde einmal im Rahmenvertrag vereinbart und
  // gilt fuer jede weitere Position. Hier gibt es nichts mehr zu waehlen --
  // eine zweite Auswahl waere eine zweite Vereinbarung.
  if (offer.framework) {
    const rv = offer.framework;
    return (
      <div>
        <M3Kopf icon={FileCheck2} titel={t('packages.frameworkTitle')} lead={t('packages.frameworkLead')} />
        <div className="rounded-[14px] bg-secondary p-4">
          <p className="font-medium">
            {rv.name ?? t('packages.agreedTerms')}
            <span className="font-normal text-muted-foreground"> · {rv.fee_percent} %</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {rv.continuity_days
              ? t('packages.frameworkFeeContinuity', { percent: rv.fee_percent, days: rv.continuity_days })
              : t('packages.frameworkFee', { percent: rv.fee_percent })}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            <Trans
              t={t}
              i18nKey={rv.agreed_at ? 'packages.frameworkRefDated' : 'packages.frameworkRef'}
              values={{
                number: rv.agreement_number,
                date: rv.agreed_at ? new Date(rv.agreed_at).toLocaleDateString(intlLocale(i18n.language)) : '',
              }}
              components={{ bold: <span className="font-medium text-foreground" /> }}
            />
          </p>
        </div>
        <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">{offer.notice}</p>
        <Button size="lg" className="mt-6 w-full rounded-full" onClick={onNext}>{t('packages.toSummary')}</Button>
      </div>
    );
  }

  return (
    <div>
      <M3Kopf icon={Package} titel={t('packages.title')} lead={t('packages.lead')} />

      <div className="space-y-2.5">
        {offer.packages.map((p) => (
          <PackageCard
            key={p.key}
            pkg={p}
            selected={chosen === p.key}
            busy={busy === p.key}
            anyBusy={busy !== null}
            onSelect={() => select(p.key)}
          />
        ))}
      </div>

      {offer.packages.some((p) => p.key !== 'core') && (
        <details className="group mt-4 text-center">
          <summary className="cursor-pointer list-none text-sm font-medium text-klick hover:underline">{t('packages.replacementTitle')}</summary>
          <p className="mt-2 rounded-[14px] bg-secondary p-4 text-left text-sm leading-relaxed text-muted-foreground">{t('packages.replacementText')}</p>
        </details>
      )}

      <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">{offer.notice}</p>

      <Button size="lg" className="mt-6 w-full rounded-full" disabled={!chosen || busy !== null} onClick={onNext}>{t('packages.toSummary')}</Button>
    </div>
  );
}

/** Eine graue Paketzeile; gewählt = Blattfarbe mit dunklem Rand, darunter klappen die Punkte auf. */
function PackageCard({
  pkg, selected, busy, anyBusy, onSelect,
}: {
  pkg: IntakePackage; selected: boolean; busy: boolean; anyBusy: boolean; onSelect: () => void;
}) {
  const { t } = useTranslation('clientFunnel');
  const card = packageCard(t, pkg.key);
  const bullets = card?.bullets ?? pkg.bullets;
  const kurz = pkg.key === 'continuity_90' ? t('packages.continuity2', { days: 90 })
    : pkg.key === 'continuity_180' ? t('packages.continuity2', { days: 180 })
    : card ? t('packages.core4') : pkg.summary;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={anyBusy}
      aria-pressed={selected}
      className={cn(
        'mk3-zeile block w-full rounded-[14px] border-2 px-4 py-3.5 text-left transition-colors disabled:opacity-70',
        selected ? 'border-foreground bg-background' : 'border-transparent bg-secondary hover:border-foreground/25',
      )}
    >
      <span className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">
            {pkg.name ?? card?.short} <span className="font-normal text-muted-foreground">· {pkg.fee_percent} %</span>
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{selected ? t('packages.feeBase') : kurz}</span>
        </span>
        {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : selected ? <Check className="h-4 w-4 shrink-0" aria-label={t('packages.chosenBadge')} /> : null}
      </span>
      {selected && (
        <span className="mt-3 block border-t pt-3">
          {card && <span className="mb-2 block text-xs font-medium text-muted-foreground">{card.head}</span>}
          {bullets.map((b, i) => (
            <span key={i} className="mt-1.5 flex gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{b}</span>
            </span>
          ))}
        </span>
      )}
    </button>
  );
}
