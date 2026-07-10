import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { z } from 'zod';
import { toast } from 'sonner';
import { GraduationCap, Loader2, ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth';
import { academySignUp, academySignIn } from '../lib/useAcademy';

const emailSchema = z.string().email('Bitte gib eine gültige E-Mail-Adresse ein');
const passwordSchema = z.string().min(6, 'Das Passwort muss mindestens 6 Zeichen haben');
const nameSchema = z.string().min(2, 'Bitte gib deinen Namen ein');

export default function AcademyAuth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>(
    searchParams.get('mode') === 'signup' ? 'signup' : 'signin',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string }>({});

  // Bereits eingeloggt -> direkt in den Lernbereich
  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  const validate = () => {
    const next: typeof errors = {};
    if (!emailSchema.safeParse(email).success) next.email = emailSchema.safeParse(email).error?.issues[0].message;
    if (!passwordSchema.safeParse(password).success) next.password = passwordSchema.safeParse(password).error?.issues[0].message;
    if (mode === 'signup' && !nameSchema.safeParse(fullName).success) next.fullName = nameSchema.safeParse(fullName).error?.issues[0].message;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await academySignUp(email, password, fullName);
        if (error) {
          toast.error(error.message.includes('already registered')
            ? 'Diese E-Mail ist bereits registriert.'
            : error.message);
        } else {
          toast.success('Willkommen! Bitte bestätige ggf. deine E-Mail-Adresse.');
        }
      } else {
        const { error } = await academySignIn(email, password);
        if (error) {
          toast.error(error.message.includes('Invalid login credentials')
            ? 'E-Mail oder Passwort ist falsch.'
            : error.message);
        } else {
          toast.success('Willkommen zurück!');
        }
      }
    } catch {
      toast.error('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Zurück zur Startseite
        </Link>

        <Card className="border-border/50 shadow-xl animate-scale-in">
          <CardHeader className="pb-2 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-navy">
              <GraduationCap className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">
              {mode === 'signup' ? 'Akademie-Konto erstellen' : 'In der Akademie anmelden'}
            </CardTitle>
            <CardDescription>
              {mode === 'signup'
                ? 'Kostenlos starten und sofort lernen.'
                : 'Schön, dass du wieder da bist.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'signin' | 'signup')}>
              <TabsList className="mb-6 grid w-full grid-cols-2">
                <TabsTrigger value="signin">Anmelden</TabsTrigger>
                <TabsTrigger value="signup">Registrieren</TabsTrigger>
              </TabsList>

              <form onSubmit={handleSubmit} className="space-y-4">
                <TabsContent value="signup" className="mt-0 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Vollständiger Name</Label>
                    <Input
                      id="fullName"
                      placeholder="Max Mustermann"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className={errors.fullName ? 'border-destructive' : ''}
                    />
                    {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                  </div>
                </TabsContent>

                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="du@beispiel.de"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={errors.email ? 'border-destructive' : ''}
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Passwort</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={errors.password ? 'border-destructive' : ''}
                  />
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>

                <Button type="submit" className="w-full" variant="hero" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" />
                    : mode === 'signup' ? 'Konto erstellen' : 'Anmelden'}
                </Button>
              </form>
            </Tabs>

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3 w-3" /> Sichere, verschlüsselte Verbindung
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
