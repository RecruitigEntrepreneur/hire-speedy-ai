import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { anspracheTrenner, type AnspracheTexte } from '@/lib/jobPosting';
import { useTranslation } from 'react-i18next';

export type Kanal = 'linkedin' | 'email' | 'telefon';

/** LinkedIn erlaubt in einer Kontaktanfrage 300 Zeichen. */
export const LINKEDIN_GRENZE = 300;

/**
 * „Zum Teilen": fertige Texte für LinkedIn, E-Mail und Telefon. Der Vorname
 * wird beim Tippen eingesetzt; kopiert wird genau, was zu sehen ist.
 */
export function AnspracheTeilen({
  ansprache, vorname, onVorname, aufhaenger, onAufhaenger, kanal, onKanal,
}: {
  ansprache: AnspracheTexte;
  vorname?: string;
  /** Ohne Handler (Vorschau für Matchunt) gibt es kein Namensfeld. */
  onVorname?: (wert: string) => void;
  /** Aufhänger aus dem Profil des Kandidaten, gilt für LinkedIn und E-Mail (21.10.2026). */
  aufhaenger?: string;
  onAufhaenger?: (wert: string) => void;
  kanal: Kanal;
  onKanal: (kanal: Kanal) => void;
}) {
  const { t: tr } = useTranslation('recruiterJobDetail');
  const [kopiert, setKopiert] = useState<string | null>(null);
  const [fehler, setFehler] = useState(false);

  const kopieren = async (schluessel: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setKopiert(schluessel);
      setFehler(false);
      setTimeout(() => setKopiert(k => (k === schluessel ? null : k)), 2000);
    } catch {
      setFehler(true);
    }
  };

  const KopierKnopf = ({ id, text, label = tr('outreach.copy') }: { id: string; text: string; label?: string }) => (
    <Button size="sm" variant={id === 'linkedin' || id === 'email' ? 'default' : 'outline'} onClick={() => kopieren(id, text)} className="gap-1.5">
      {kopiert === id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {kopiert === id ? tr('ws.copied') : label}
    </Button>
  );

  const zeichen = ansprache.linkedin.length;
  const t = ansprache.telefon;
  const emailKern = ansprache.email.text.split(`\n${anspracheTrenner()}`)[0].trim();

  return (
    <div className="space-y-4">
      {(onVorname || onAufhaenger) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {onVorname && <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{tr('outreach.firstName')}</span>
            <Input value={vorname ?? ''} onChange={e => onVorname(e.target.value)} placeholder={tr('outreach.firstNameExample')} />
          </label>}
          {onAufhaenger && <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{tr('outreach.hook')}</span>
            <Input value={aufhaenger ?? ''} onChange={e => onAufhaenger(e.target.value)} placeholder={tr('outreach.hookExample')} maxLength={60} />
          </label>}
        </div>
      )}

      <Tabs value={kanal} onValueChange={v => onKanal(v as Kanal)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
          <TabsTrigger value="email">{tr('ws.email')}</TabsTrigger>
          <TabsTrigger value="telefon">{tr('ws.phone')}</TabsTrigger>
        </TabsList>

        <TabsContent value="linkedin" className="space-y-3">
          <p className="whitespace-pre-line rounded-lg border border-border bg-card p-3 text-sm leading-6">{ansprache.linkedin}</p>
          <div className="flex items-center justify-between gap-3">
            <span className={`text-xs ${zeichen > LINKEDIN_GRENZE ? 'text-destructive' : 'text-muted-foreground'}`}>
              {zeichen > LINKEDIN_GRENZE ? tr('outreach.charsTooLong', { count: zeichen, max: LINKEDIN_GRENZE }) : tr('outreach.charsFit', { count: zeichen, max: LINKEDIN_GRENZE })}
            </span>
            <KopierKnopf id="linkedin" text={ansprache.linkedin} />
          </div>
        </TabsContent>

        <TabsContent value="email" className="space-y-3">
          <div className="rounded-lg border border-border bg-card p-3 text-sm leading-6">
            <p><span className="font-medium">{tr('outreach.subject')}</span> {ansprache.email.betreff}</p>
            <p className="mt-2 whitespace-pre-line">{emailKern}</p>
            <p className="mt-2 text-xs text-muted-foreground">{tr('outreach.adBelow')}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <KopierKnopf id="betreff" text={ansprache.email.betreff} label={tr('outreach.copySubject')} />
            <KopierKnopf id="email" text={ansprache.email.text} label={tr('outreach.copyTextAndAd')} />
          </div>
        </TabsContent>

        <TabsContent value="telefon" className="space-y-3">
          <div className="space-y-3 rounded-lg border border-border bg-card p-3 text-sm leading-6">
            <p><span className="font-medium">{tr('outreach.opening')}</span> „{t.einstieg}“</p>
            {t.argumente.length > 0 && (
              <div><p className="font-medium">{tr('outreach.arguments')}</p><ul className="list-disc pl-5">{t.argumente.map(a => <li key={a}>{a}</li>)}</ul></div>
            )}
            {t.fragen.length > 0 && (
              <div><p className="font-medium">{tr('outreach.checkFit')}</p><ul className="list-disc pl-5">{t.fragen.map(f => <li key={f}>{f}</li>)}</ul></div>
            )}
            {t.konditionen && <p><span className="font-medium">{tr('outreach.terms')}</span> {t.konditionen}</p>}
            <p><span className="font-medium">{tr('outreach.nextStep')}</span> {t.naechster}</p>
          </div>
          <p className="text-xs text-muted-foreground">{tr('outreach.cheatSheet')}</p>
        </TabsContent>
      </Tabs>
      {fehler && <p role="alert" className="text-xs text-muted-foreground">{tr('ws.copyFailed')}</p>}
    </div>
  );
}
