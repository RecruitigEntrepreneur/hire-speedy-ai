import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
}

export function SignerChoice({ contactName, busy, error, onChoose }: Props) {
  const { t } = useTranslation('clientFunnel');
  const [modus, setModus] = useState<'frage' | 'andere'>('frage');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-xl font-bold tracking-tight">{t('signer.title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('signer.lead')}
        </p>
      </div>

      {modus === 'frage' ? (
        <div className="space-y-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => onChoose({ self: true })}
            className="flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 disabled:opacity-60"
          >
            <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <span>
              <span className="block font-medium">
                {contactName ? t('signer.selfNamed', { name: contactName }) : t('signer.self')}
              </span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {t('signer.selfText')}
              </span>
            </span>
            {busy && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => setModus('andere')}
            className="flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 disabled:opacity-60"
          >
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <span>
              <span className="block font-medium">{t('signer.other')}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {t('signer.otherText')}
              </span>
            </span>
          </button>
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border p-4">
          <div>
            <Label htmlFor="signer-name">{t('signer.nameLabel')}</Label>
            <Input id="signer-name" value={name} onChange={(e) => setName(e.target.value)}
              className="mt-1" placeholder={t('common.namePlaceholder')} autoFocus />
          </div>
          <div>
            <Label htmlFor="signer-mail">{t('common.businessEmail')}</Label>
            <Input id="signer-mail" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1" placeholder={t('common.emailPlaceholder')} />
            <p className="mt-1 text-xs text-muted-foreground">
              {t('signer.emailHint')}
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setModus('frage')} disabled={busy}>
              {t('common.back')}
            </Button>
            <Button
              className="flex-1"
              disabled={busy || !name.trim() || !email.trim()}
              onClick={() => onChoose({ self: false, name: name.trim(), email: email.trim() })}
            >
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('common.sending')}</>
                    : <><FileSignature className="mr-2 h-4 w-4" /> {t('signer.send')}</>}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      <p className="text-center text-xs text-muted-foreground">
        {t('signer.note')}
      </p>
    </div>
  );
}
