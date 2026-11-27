import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { M3Hinweis, M3Kopf, M3Zeile } from './m3';
import { FileSignature, Loader2, UserCheck, Users } from 'lucide-react';

/**
 * Wer unterschreibt?
 *
 * Die eine Frage, die entscheidet, ob der Vorgang durchläuft oder liegen
 * bleibt. Wer die Stelle aufnimmt, darf im Mittelstand oft nicht zeichnen —
 * HR oder der Hiring Manager briefen, unterschreiben tut die Geschäftsführung.
 * Ein Vertrag, der ungefragt beim Absender landet, ist dort eine Sackgasse.
 *
 * Die Formulierung meidet „berechtigt“ und „Prokura“: Wer sich unsicher ist,
 * ob er das darf, soll den zweiten Weg wählen können, ohne sich rechtfertigen
 * zu müssen.
 */

interface Props {
  contactName: string | null;
  busy: boolean;
  error: string | null;
  onChoose: (args: { self: boolean; name?: string; email?: string }) => void;
  /** „Ihre Anfrage ist eingegangen, Vorgang …“ als Ortszeile über dem Titel. */
  eingang?: ReactNode;
}

/** Im Stil M3 (26.11.2026): Kopf mittig, zwei graue Wahlzeilen, Hinweis klein darunter. */
export function SignerChoice({ contactName, busy, error, onChoose, eingang }: Props) {
  const { t } = useTranslation('clientFunnel');
  const [modus, setModus] = useState<'frage' | 'andere'>('frage');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  return (
    <div>
      <M3Kopf
        icon={modus === 'frage' ? FileSignature : Users}
        ort={modus === 'frage' ? eingang : undefined}
        titel={modus === 'frage' ? t('signer.title') : t('signer.other')}
        lead={modus === 'frage' ? t('signer.lead') : t('signer.otherText')}
      />

      {modus === 'frage' ? (
        <div className="space-y-2.5">
          <M3Zeile
            icon={UserCheck}
            disabled={busy}
            onClick={() => onChoose({ self: true })}
            titel={contactName ? t('signer.selfNamed', { name: contactName }) : t('signer.self')}
            text={t('signer.selfText')}
            rechts={busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : undefined}
          />
          <M3Zeile
            icon={Users}
            disabled={busy}
            onClick={() => setModus('andere')}
            titel={t('signer.other')}
            text={t('signer.otherText')}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Label htmlFor="signer-name">{t('signer.nameLabel')}</Label>
            <Input id="signer-name" value={name} onChange={(e) => setName(e.target.value)}
              className="mt-1.5 h-11" placeholder={t('common.namePlaceholder')} autoFocus />
          </div>
          <div>
            <Label htmlFor="signer-mail">{t('common.businessEmail')}</Label>
            <Input id="signer-mail" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 h-11" placeholder={t('common.emailPlaceholder')} />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t('signer.emailHint')}
            </p>
          </div>
          <Button
            size="lg"
            className="w-full rounded-full"
            disabled={busy || !name.trim() || !email.trim()}
            onClick={() => onChoose({ self: false, name: name.trim(), email: email.trim() })}
          >
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('common.sending')}</>
                  : <><FileSignature className="mr-2 h-4 w-4" /> {t('signer.send')}</>}
          </Button>
          <button type="button" className="mx-auto block text-sm font-medium text-klick hover:underline" onClick={() => setModus('frage')} disabled={busy}>
            {t('common.back')}
          </button>
        </div>
      )}

      {error && <M3Hinweis className="mt-4">{error}</M3Hinweis>}

      <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
        {t('signer.note')}
      </p>
    </div>
  );
}
