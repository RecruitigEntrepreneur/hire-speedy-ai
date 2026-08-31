import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MatchuntWordmark } from '@/components/ui/MatchuntWordmark';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, KeyRound, Loader2, TriangleAlert } from 'lucide-react';

/**
 * Zugang einrichten — /passwort
 *
 * Nimmt den Zugangslink aus der Annahme-Mail entgegen und setzt ein Passwort.
 *
 * Notwendig, weil im gesamten Projekt kein Passwort-Weg existiert: weder
 * resetPasswordForEmail noch signInWithOtp noch eine „Passwort vergessen"-
 * Strecke. Ein Konto, das bei der Annahme einer Beauftragungsanfrage
 * serverseitig angelegt wird, hätte ohne diese Seite keinen Weg hinein — der
 * Kunde bekäme eine Zusage und stünde vor einer verschlossenen Tür.
 *
 * Der Link enthält einen Recovery-Token im URL-Fragment. Der Supabase-Client
 * löst ihn beim Laden selbst ein (detectSessionInUrl ist Standard); hier wird
 * nur geprüft, dass daraus eine Sitzung entstanden ist.
 */
export default function SetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Der Client verarbeitet das URL-Fragment asynchron. Auf das Ereignis zu
    // warten ist zuverlässiger, als sofort getSession() zu fragen.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session?.user) {
        setEmail(session.user.email ?? null);
        setReady(true);
      }
    });

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session?.user) {
        setEmail(data.session.user.email ?? null);
        setReady(true);
      } else {
        // Kurze Nachfrist für das Einlösen des Fragments.
        setTimeout(async () => {
          if (cancelled) return;
          const { data: again } = await supabase.auth.getSession();
          if (again.session?.user) {
            setEmail(again.session.user.email ?? null);
            setReady(true);
          } else {
            setReady(false);
          }
        }, 1200);
      }
    })();

    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  const submit = async () => {
    setError(null);
    if (password.length < 8) { setError('Bitte mindestens 8 Zeichen.'); return; }
    if (password !== repeat) { setError('Die beiden Eingaben stimmen nicht überein.'); return; }

    setBusy(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateErr) { setError(updateErr.message); return; }
    setDone(true);
    setTimeout(() => navigate('/dashboard'), 1500);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md">
        <MatchuntWordmark size="sm" className="mb-8 justify-center" />

        {ready === null && (
          <div className="text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {ready === false && (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                <TriangleAlert className="h-5 w-5 text-muted-foreground" />
              </div>
              <h1 className="mb-2 text-xl font-semibold tracking-tight">Dieser Zugangslink ist nicht mehr gültig</h1>
              <p className="mb-6 text-sm text-muted-foreground">
                Zugangslinks laufen aus Sicherheitsgründen ab. Ihr Ansprechpartner sendet Ihnen
                gern einen neuen.
              </p>
              <Button variant="outline" onClick={() => navigate('/auth')}>Zur Anmeldung</Button>
            </CardContent>
          </Card>
        )}

        {ready === true && (
          <Card>
            <CardContent className="space-y-4 p-6">
              {done ? (
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600/10">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <h1 className="text-xl font-semibold tracking-tight">Zugang eingerichtet</h1>
                  <p className="mt-2 text-sm text-muted-foreground">Wir bringen Sie zu Ihrem Dashboard …</p>
                </div>
              ) : (
                <>
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                      <KeyRound className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <h1 className="text-xl font-semibold tracking-tight">Zugang einrichten</h1>
                    {email && <p className="mt-1 text-sm text-muted-foreground">{email}</p>}
                  </div>

                  <div>
                    <Label htmlFor="pw" className="text-xs text-muted-foreground">Passwort</Label>
                    <Input id="pw" type="password" autoComplete="new-password" value={password}
                      onChange={(e) => setPassword(e.target.value)} className="mt-1" />
                    <p className="mt-1 text-[11px] text-muted-foreground">Mindestens 8 Zeichen.</p>
                  </div>
                  <div>
                    <Label htmlFor="pw2" className="text-xs text-muted-foreground">Passwort wiederholen</Label>
                    <Input id="pw2" type="password" autoComplete="new-password" value={repeat}
                      onChange={(e) => setRepeat(e.target.value)} className="mt-1"
                      onKeyDown={(e) => e.key === 'Enter' && submit()} />
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <TriangleAlert className="h-4 w-4" />
                      <AlertDescription className="text-xs">{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button onClick={submit} disabled={busy || !password || !repeat} className="w-full gap-2">
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />} Passwort speichern
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
