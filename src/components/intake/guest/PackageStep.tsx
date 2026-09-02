import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Check, Info, Loader2, ShieldCheck } from 'lucide-react';
import { isFailure, type IntakeFailure, type IntakePackage, type IntakePackageOffer } from '@/hooks/useGuestIntake';

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
 * Die Beträge sind ausdrücklich Schätzungen. Abgerechnet wird nach dem
 * Bruttojahreszielgehalt aus dem unterzeichneten Arbeitsvertrag; steht das
 * fest, kann der Betrag abweichen. Das gehört auf die Karte und nicht ins
 * Kleingedruckte.
 */

interface Props {
  load: () => Promise<IntakePackageOffer | IntakeFailure>;
  onSelect: (key: string) => Promise<any>;
  onNext: () => void;
}

export function PackageStep({ load, onSelect, onNext }: Props) {
  const [offer, setOffer] = useState<IntakePackageOffer | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void load().then((res) => {
      if (!active) return;
      if (isFailure(res)) {
        setLoadError('Die Pakete konnten nicht geladen werden. Bitte laden Sie die Seite neu.');
        return;
      }
      setOffer(res);
      setChosen(res.selected?.key ?? null);
    });
    return () => { active = false; };
  }, [load]);

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
    return <Alert variant="destructive"><AlertDescription>{loadError}</AlertDescription></Alert>;
  }
  if (!offer) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Pakete werden geladen …
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Wie möchten Sie zusammenarbeiten?</h2>
        <p className="text-sm text-muted-foreground">
          Alle drei Pakete sind reine Erfolgshonorare: Sie zahlen nur, wenn wir besetzen.
          Kein Retainer, keine Fixkosten, keine Vorabkosten.
        </p>
      </div>

      {offer.basis && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Berechnet auf <strong>{offer.basis.label}</strong> Bruttojahreszielgehalt aus Ihren
            Angaben. {offer.estimate_notice}
          </AlertDescription>
        </Alert>
      )}

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

      <Card className="border-dashed">
        <CardContent className="flex gap-3 pt-6 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{offer.notice}</p>
        </CardContent>
      </Card>

      {chosen && (
        <div className="flex justify-end">
          <Button onClick={onNext}>
            Weiter zur Zusammenfassung <ArrowRight className="ml-2 h-4 w-4" />
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
  return (
    <Card className={selected ? 'border-primary ring-1 ring-primary' : undefined}>
      <CardContent className="flex h-full flex-col gap-4 pt-6">
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-tight">{pkg.name}</h3>
            {selected && <Badge className="shrink-0">Gewählt</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{pkg.summary}</p>
        </div>

        <div>
          <div className="text-3xl font-semibold tabular-nums">{pkg.fee_percent} %</div>
          <p className="text-xs text-muted-foreground">des Bruttojahreszielgehalts</p>
          {pkg.estimate_label && (
            <p className="mt-2 text-sm">
              <span className="font-medium tabular-nums">≈ {pkg.estimate_label}</span>
              <span className="text-muted-foreground"> geschätzt</span>
            </p>
          )}
        </div>

        <ul className="flex-1 space-y-2 text-sm">
          {pkg.bullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {pkg.continuity_days && (
          <p className="text-xs text-muted-foreground">
            Meldung eines Ausscheidens innerhalb von {pkg.claim_notice_days} Tagen ab Kenntnis.
          </p>
        )}

        <Button
          variant={selected ? 'secondary' : 'default'}
          className="w-full"
          disabled={anyBusy}
          onClick={onSelect}
        >
          {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Wird gespeichert …</>
                : selected ? 'Ausgewählt' : 'Dieses Paket wählen'}
        </Button>
      </CardContent>
    </Card>
  );
}
