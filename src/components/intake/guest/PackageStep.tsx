import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { intlLocale } from '@/i18n/languages';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Check, Loader2, ShieldCheck } from 'lucide-react';
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

  const select = async (key: string) => {
    setBusy(key);
    const res = await onSelect(key);
    setBusy(null);
    if (!isFailure(res)) {
      setChosen(key);
      onNext();
    }
  };

  if (loadError) {
    return <Alert variant="destructive"><AlertDescription>{t('packages.loadError')}</AlertDescription></Alert>;
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
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">{t('packages.frameworkTitle')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('packages.frameworkLead')}
          </p>
        </div>

        <Card className="border-primary/30 bg-primary/[0.03]">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-start gap-3">
              <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {rv.name ?? t('packages.agreedTerms')}
                  <Badge variant="secondary" className="ml-2">{rv.fee_percent} %</Badge>
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
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardContent className="flex gap-3 pt-6 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{offer.notice}</p>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={onNext}>
            {t('packages.toSummary')} <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">{t('packages.title')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('packages.lead')}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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
        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
          <p className="font-medium">{t('packages.replacementTitle')}</p>
          <p className="mt-1 text-muted-foreground">{t('packages.replacementText')}</p>
        </div>
      )}

      <Card className="border-dashed">
        <CardContent className="flex gap-3 pt-6 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{offer.notice}</p>
        </CardContent>
      </Card>

      {chosen && (
        <div className="flex justify-end">
          <Button onClick={onNext}>
            {t('packages.toSummary')} <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function PackageCard({
  pkg, selected, busy, anyBusy, onSelect,
}: {
  pkg: IntakePackage; selected: boolean; busy: boolean; anyBusy: boolean; onSelect: () => void;
}) {
  const { t } = useTranslation('clientFunnel');
  const card = packageCard(t, pkg.key);
  const bullets = card?.bullets ?? pkg.bullets;
  return (
    <Card className={selected ? 'border-primary ring-1 ring-primary' : undefined}>
      <CardContent className="flex h-full flex-col gap-4 pt-6">
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-tight">{card?.short ?? pkg.name}</h3>
            {selected && <Badge className="shrink-0">{t('packages.chosenBadge')}</Badge>}
          </div>
          {!card && <p className="text-sm text-muted-foreground">{pkg.summary}</p>}
        </div>

        <div>
          <div className="text-3xl font-semibold tabular-nums">{pkg.fee_percent} %</div>
          <p className="text-xs text-muted-foreground">{t('packages.feeBase')}</p>
        </div>

        <div className="flex-1 space-y-2">
          {card && <p className="text-xs font-medium text-muted-foreground">{card.head}</p>}
          <ul className="space-y-2 text-sm">
            {bullets.map((b, i) => (
              <li key={i} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <Button
          variant={selected ? 'secondary' : 'default'}
          className="w-full"
          disabled={anyBusy}
          onClick={onSelect}
        >
          {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('common.saving')}</>
                : selected ? t('packages.selected') : t('packages.choose', { name: card?.short ?? pkg.name })}
        </Button>
      </CardContent>
    </Card>
  );
}
