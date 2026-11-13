import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n, { currentLanguage } from '@/i18n';
import { PageLanguageMenu } from '@/components/intake/guest/IntakeShell';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, Loader2, MessageCircleQuestion } from 'lucide-react';

/**
 * Die Antwortseite zu einer Rückfrage.
 *
 * Bewusst schmal: sie zeigt die Frage, die Felder aus dem Umfang der Rückfrage
 * und ein Antwortfeld. Sie ist kein zweiter Einstieg in die Aufnahme — eine
 * Rückfrage zur Umsatzsteuernummer soll nicht das Gehaltsband wieder aufmachen.
 * Der Server schickt deshalb auch nur diese Felder; die Begrenzung steht nicht
 * in dieser Datei.
 */

// Die Beschriftungen der Felder stehen in den Sprachdateien (clientFunnel: clarify.fields.*).
// Fehlertexte außerhalb des Renderns: die Sprachdatei ist geladen, sobald die Seite steht.
const tx = (key: string) => i18n.t(`clientFunnel:clarify.${key}`);

interface Geladen {
  clarification: { id: string; question: string; scope_fields: string[]; status: string };
  fields: Record<string, string | null>;
  position: { title: string | null; company: string | null };
}

export default function ClarifyAnswer() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation('clientFunnel');
  const [data, setData] = useState<Geladen | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [felder, setFelder] = useState<Record<string, string>>({});
  const [antwort, setAntwort] = useState('');
  const [busy, setBusy] = useState(false);
  const [fertig, setFertig] = useState(false);

  const ruf = useCallback(async (payload: Record<string, unknown>) => {
    const { data: res, error } = await supabase.functions.invoke('intake-clarify', {
      body: { token, ...payload, lang: currentLanguage() },
    });
    if (error) throw new Error(tx('loadError'));
    if (res && typeof res === 'object' && 'reason' in res) throw new Error((res as any).message);
    return res;
  }, [token]);

  useEffect(() => {
    let aktiv = true;
    void ruf({ action: 'open' })
      .then((res) => {
        if (!aktiv) return;
        const g = res as Geladen;
        setData(g);
        setFelder(Object.fromEntries(
          Object.entries(g.fields).map(([k, v]) => [k, v ?? '']),
        ));
      })
      .catch((e) => aktiv && setFehler(e instanceof Error ? e.message : tx('unknownError')));
    return () => { aktiv = false; };
  }, [ruf]);

  const senden = async () => {
    setBusy(true);
    try {
      await ruf({ action: 'answer', answer: antwort, fields: felder });
      setFertig(true);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : tx('saveError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-muted/30 px-4 py-10">
      <PageLanguageMenu />
      <div className="mx-auto max-w-2xl space-y-6">
        {fehler && !data && (
          <Alert variant="destructive">
            <AlertDescription>{fehler}</AlertDescription>
          </Alert>
        )}

        {!data && !fehler && (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('common.loading')}
          </div>
        )}

        {fertig && (
          <Alert>
            <Check className="h-4 w-4" />
            <AlertDescription>
              {t('clarify.thanks')}
            </AlertDescription>
          </Alert>
        )}

        {data && !fertig && (
          <>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {data.position.company ?? t('clarify.yourRequest')}
                {data.position.title && <> · {data.position.title}</>}
              </p>
              <h1 className="text-xl font-semibold">{t('clarify.title')}</h1>
            </div>

            <Card>
              <CardContent className="space-y-5 p-6">
                <div className="flex gap-3 rounded-lg bg-muted/50 p-4">
                  <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm">{data.clarification.question}</p>
                </div>

                {data.clarification.scope_fields.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">{t('clarify.editable')}</p>
                    {data.clarification.scope_fields.map((f) => (
                      <div key={f}>
                        <Label htmlFor={f} className="text-xs text-muted-foreground">
                          {t(`clarify.fields.${f}`, { defaultValue: f })}
                        </Label>
                        <Input
                          id={f}
                          value={felder[f] ?? ''}
                          onChange={(e) => setFelder((s) => ({ ...s, [f]: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <Label htmlFor="antwort" className="text-xs text-muted-foreground">
                    {t('clarify.answerLabel')}
                  </Label>
                  <Textarea
                    id="antwort"
                    value={antwort}
                    onChange={(e) => setAntwort(e.target.value)}
                    rows={5}
                    className="mt-1"
                    placeholder={t('clarify.answerPlaceholder')}
                  />
                </div>

                {fehler && (
                  <Alert variant="destructive">
                    <AlertDescription className="text-sm">{fehler}</AlertDescription>
                  </Alert>
                )}

                <Button onClick={senden} disabled={busy || !antwort.trim()} className="w-full">
                  {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('common.sending')}</>
                        : t('clarify.send')}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
