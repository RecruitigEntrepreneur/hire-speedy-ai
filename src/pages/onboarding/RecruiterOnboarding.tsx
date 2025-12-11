import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecruiterVerification } from '@/hooks/useRecruiterVerification';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  Loader2, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft,
  Rocket,
  FileText,
  Shield,
  FileSignature,
  User,
  PartyPopper,
  DollarSign,
  Users,
  Briefcase,
  Clock
} from 'lucide-react';

const STEPS = [
  { id: 1, title: 'Willkommen', icon: Rocket },
  { id: 2, title: 'AGB', icon: FileText },
  { id: 3, title: 'NDA', icon: Shield },
  { id: 4, title: 'Rahmenvertrag', icon: FileSignature },
  { id: 5, title: 'Profil', icon: User },
  { id: 6, title: 'Fertig', icon: PartyPopper },
];

export default function RecruiterOnboarding() {
  const navigate = useNavigate();
  const { 
    verification, 
    loading, 
    createVerification,
    acknowledgeInfo,
    acceptTerms,
    acceptNda,
    signContract,
    completeProfile,
    currentStep,
    isFullyVerified
  } = useRecruiterVerification();

  const [activeStep, setActiveStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [ndaAccepted, setNdaAccepted] = useState(false);
  const [contractAccepted, setContractAccepted] = useState(false);
  const [signature, setSignature] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [iban, setIban] = useState('');

  useEffect(() => {
    if (!loading && !verification) {
      createVerification();
    }
  }, [loading, verification, createVerification]);

  useEffect(() => {
    if (currentStep > 0 && currentStep <= 6) {
      setActiveStep(currentStep);
    }
  }, [currentStep]);

  useEffect(() => {
    if (isFullyVerified) {
      navigate('/recruiter');
    }
  }, [isFullyVerified, navigate]);

  const progressValue = ((activeStep - 1) / (STEPS.length - 1)) * 100;

  const handleNextStep = async () => {
    setSubmitting(true);
    try {
      let success = false;

      switch (activeStep) {
        case 1:
          success = await acknowledgeInfo();
          break;
        case 2:
          if (!termsAccepted) {
            toast.error('Bitte akzeptieren Sie die AGB');
            setSubmitting(false);
            return;
          }
          success = await acceptTerms();
          break;
        case 3:
          if (!ndaAccepted) {
            toast.error('Bitte akzeptieren Sie die NDA');
            setSubmitting(false);
            return;
          }
          success = await acceptNda();
          break;
        case 4:
          if (!contractAccepted || !signature.trim()) {
            toast.error('Bitte akzeptieren Sie den Vertrag und geben Sie Ihre Unterschrift ein');
            setSubmitting(false);
            return;
          }
          success = await signContract(signature);
          break;
        case 5:
          if (!companyName.trim() || !taxId.trim() || !iban.trim()) {
            toast.error('Bitte füllen Sie alle Felder aus');
            setSubmitting(false);
            return;
          }
          success = await completeProfile(companyName, taxId, iban);
          break;
        case 6:
          navigate('/recruiter');
          return;
      }

      if (success) {
        setActiveStep(prev => Math.min(prev + 1, 6));
        toast.success('Fortschritt gespeichert');
      }
    } catch (err) {
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-4xl py-8 px-4">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Recruiter Onboarding</h1>
            <span className="text-sm text-muted-foreground">
              Schritt {activeStep} von {STEPS.length}
            </span>
          </div>
          <Progress value={progressValue} className="h-2" />
          
          {/* Step Indicators */}
          <div className="flex justify-between mt-4">
            {STEPS.map((step) => {
              const StepIcon = step.icon;
              const isCompleted = activeStep > step.id;
              const isCurrent = activeStep === step.id;
              
              return (
                <div 
                  key={step.id} 
                  className={`flex flex-col items-center gap-1 ${
                    isCompleted ? 'text-primary' : isCurrent ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isCompleted ? 'bg-primary text-primary-foreground' : 
                    isCurrent ? 'bg-primary/20 text-primary' : 'bg-muted'
                  }`}>
                    {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                  </div>
                  <span className="text-xs hidden sm:block">{step.title}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <Card className="border-border/50">
          {activeStep === 1 && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Rocket className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Willkommen bei MatchHub!</CardTitle>
                <CardDescription className="text-base">
                  Werden Sie Teil unseres Recruiter-Netzwerks und verdienen Sie Provisionen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <DollarSign className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                    <h3 className="font-semibold">Attraktive Provisionen</h3>
                    <p className="text-sm text-muted-foreground">15-25% des Jahresgehalts</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <Users className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                    <h3 className="font-semibold">Top-Unternehmen</h3>
                    <p className="text-sm text-muted-foreground">Zugang zu exklusiven Jobs</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <Clock className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                    <h3 className="font-semibold">Schnelle Auszahlung</h3>
                    <p className="text-sm text-muted-foreground">Innerhalb von 30 Tagen</p>
                  </div>
                </div>
                
                <div className="bg-muted/30 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">So funktioniert's:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Durchsuchen Sie unsere offenen Stellen</li>
                    <li>Reichen Sie passende Kandidaten ein</li>
                    <li>Begleiten Sie den Prozess bis zur Einstellung</li>
                    <li>Erhalten Sie Ihre Provision nach erfolgreicher Platzierung</li>
                  </ol>
                </div>
              </CardContent>
            </>
          )}

          {activeStep === 2 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Allgemeine Geschäftsbedingungen
                </CardTitle>
                <CardDescription>
                  Bitte lesen und akzeptieren Sie unsere AGB
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScrollArea className="h-64 rounded-md border p-4">
                  <div className="space-y-4 text-sm">
                    <h4 className="font-semibold">1. Geltungsbereich</h4>
                    <p className="text-muted-foreground">
                      Diese Allgemeinen Geschäftsbedingungen gelten für alle Verträge zwischen MatchHub GmbH 
                      (nachfolgend "MatchHub") und dem Recruiter (nachfolgend "Partner") im Rahmen der 
                      Personalvermittlung über die MatchHub-Plattform.
                    </p>
                    
                    <h4 className="font-semibold">2. Leistungen</h4>
                    <p className="text-muted-foreground">
                      MatchHub stellt eine Plattform zur Verfügung, über die Partner Kandidaten für offene 
                      Positionen bei Kundenunternehmen einreichen können. MatchHub vermittelt zwischen 
                      Partner und Kundenunternehmen.
                    </p>
                    
                    <h4 className="font-semibold">3. Provisionen</h4>
                    <p className="text-muted-foreground">
                      Die Höhe der Provision wird pro Stelle festgelegt und beträgt typischerweise zwischen 
                      15% und 25% des Bruttojahresgehalts des vermittelten Kandidaten. Die genaue Höhe ist 
                      in der jeweiligen Stellenausschreibung angegeben.
                    </p>
                    
                    <h4 className="font-semibold">4. Zahlungsbedingungen</h4>
                    <p className="text-muted-foreground">
                      Die Provision wird fällig nach erfolgreichem Abschluss der Probezeit des vermittelten 
                      Kandidaten. Die Auszahlung erfolgt innerhalb von 30 Tagen nach Fälligkeit.
                    </p>
                    
                    <h4 className="font-semibold">5. Kandidatenqualität</h4>
                    <p className="text-muted-foreground">
                      Der Partner verpflichtet sich, nur Kandidaten einzureichen, die den Anforderungen 
                      der jeweiligen Stelle entsprechen und deren ausdrückliches Einverständnis zur 
                      Weitergabe ihrer Daten vorliegt.
                    </p>
                    
                    <h4 className="font-semibold">6. Datenschutz</h4>
                    <p className="text-muted-foreground">
                      Der Partner verpflichtet sich zur Einhaltung der DSGVO und aller anwendbaren 
                      Datenschutzvorschriften bei der Verarbeitung von Kandidatendaten.
                    </p>
                    
                    <h4 className="font-semibold">7. Schlussbestimmungen</h4>
                    <p className="text-muted-foreground">
                      Es gilt deutsches Recht. Gerichtsstand ist Berlin. Sollten einzelne Bestimmungen 
                      unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.
                    </p>
                  </div>
                </ScrollArea>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="terms" 
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                  />
                  <Label htmlFor="terms" className="text-sm">
                    Ich habe die AGB gelesen und akzeptiere sie
                  </Label>
                </div>
              </CardContent>
            </>
          )}

          {activeStep === 3 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Vertraulichkeitsvereinbarung (NDA)
                </CardTitle>
                <CardDescription>
                  Zum Schutz der Kandidaten- und Unternehmensdaten
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScrollArea className="h-64 rounded-md border p-4">
                  <div className="space-y-4 text-sm">
                    <h4 className="font-semibold">1. Vertrauliche Informationen</h4>
                    <p className="text-muted-foreground">
                      Als vertrauliche Informationen gelten alle Daten, die dem Partner im Rahmen der 
                      Zusammenarbeit mit MatchHub zugänglich gemacht werden, insbesondere:
                    </p>
                    <ul className="list-disc list-inside text-muted-foreground ml-4">
                      <li>Kandidatendaten (Lebensläufe, Kontaktdaten, Gehaltsvorstellungen)</li>
                      <li>Unternehmensinformationen (Gehaltsspannen, interne Prozesse)</li>
                      <li>Geschäftsgeheimnisse von MatchHub</li>
                    </ul>
                    
                    <h4 className="font-semibold">2. Geheimhaltungspflicht</h4>
                    <p className="text-muted-foreground">
                      Der Partner verpflichtet sich, alle vertraulichen Informationen streng 
                      vertraulich zu behandeln und nicht an Dritte weiterzugeben. Diese Pflicht 
                      gilt auch über das Ende der Zusammenarbeit hinaus.
                    </p>
                    
                    <h4 className="font-semibold">3. Zweckbindung</h4>
                    <p className="text-muted-foreground">
                      Vertrauliche Informationen dürfen ausschließlich für die Zwecke der 
                      Personalvermittlung über die MatchHub-Plattform verwendet werden.
                    </p>
                    
                    <h4 className="font-semibold">4. Kandidatenschutz</h4>
                    <p className="text-muted-foreground">
                      Der Partner verpflichtet sich, Kandidaten nicht ohne deren ausdrückliche 
                      Zustimmung bei anderen Unternehmen vorzustellen oder deren Daten 
                      anderweitig zu verwenden.
                    </p>
                    
                    <h4 className="font-semibold">5. Rückgabe von Unterlagen</h4>
                    <p className="text-muted-foreground">
                      Auf Verlangen von MatchHub oder bei Beendigung der Zusammenarbeit sind 
                      alle vertraulichen Unterlagen zurückzugeben oder zu vernichten.
                    </p>
                    
                    <h4 className="font-semibold">6. Vertragsstrafe</h4>
                    <p className="text-muted-foreground">
                      Bei Verstoß gegen diese Vertraulichkeitsvereinbarung behält sich MatchHub 
                      vor, Schadensersatzansprüche geltend zu machen und die Zusammenarbeit 
                      fristlos zu beenden.
                    </p>
                  </div>
                </ScrollArea>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="nda" 
                    checked={ndaAccepted}
                    onCheckedChange={(checked) => setNdaAccepted(checked === true)}
                  />
                  <Label htmlFor="nda" className="text-sm">
                    Ich habe die NDA gelesen und akzeptiere sie
                  </Label>
                </div>
              </CardContent>
            </>
          )}

          {activeStep === 4 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSignature className="h-5 w-5" />
                  Rahmenvertrag für Personalvermittlung
                </CardTitle>
                <CardDescription>
                  Der Vertrag regelt unsere Zusammenarbeit
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScrollArea className="h-48 rounded-md border p-4">
                  <div className="space-y-4 text-sm">
                    <h4 className="font-semibold">Rahmenvertrag für Personalvermittler</h4>
                    <p className="text-muted-foreground">
                      Zwischen MatchHub GmbH, Musterstraße 1, 10115 Berlin (nachfolgend "MatchHub") 
                      und dem unterzeichnenden Partner wird folgender Rahmenvertrag geschlossen:
                    </p>
                    
                    <h4 className="font-semibold">§1 Vertragsgegenstand</h4>
                    <p className="text-muted-foreground">
                      MatchHub beauftragt den Partner mit der Vermittlung von Kandidaten für 
                      offene Positionen bei Kundenunternehmen von MatchHub. Der Partner handelt 
                      als selbstständiger Vertragspartner.
                    </p>
                    
                    <h4 className="font-semibold">§2 Vergütung</h4>
                    <p className="text-muted-foreground">
                      Der Partner erhält bei erfolgreicher Vermittlung eine Provision gemäß der 
                      in der jeweiligen Stellenausschreibung angegebenen Höhe. Die Provision wird 
                      nach erfolgreichem Abschluss der Probezeit des Kandidaten fällig.
                    </p>
                    
                    <h4 className="font-semibold">§3 Laufzeit</h4>
                    <p className="text-muted-foreground">
                      Dieser Vertrag wird auf unbestimmte Zeit geschlossen und kann von beiden 
                      Seiten mit einer Frist von 30 Tagen zum Monatsende gekündigt werden.
                    </p>
                  </div>
                </ScrollArea>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="contract" 
                      checked={contractAccepted}
                      onCheckedChange={(checked) => setContractAccepted(checked === true)}
                    />
                    <Label htmlFor="contract" className="text-sm">
                      Ich habe den Rahmenvertrag gelesen und akzeptiere ihn
                    </Label>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signature">Digitale Unterschrift (Vollständiger Name)</Label>
                    <Input
                      id="signature"
                      placeholder="Max Mustermann"
                      value={signature}
                      onChange={(e) => setSignature(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Mit der Eingabe Ihres Namens bestätigen Sie die rechtsgültige Unterzeichnung dieses Vertrags.
                    </p>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {activeStep === 5 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profildaten vervollständigen
                </CardTitle>
                <CardDescription>
                  Für die Rechnungsstellung und Auszahlung
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Firmenname / Vollständiger Name *</Label>
                  <Input
                    id="companyName"
                    placeholder="Recruiting Solutions GmbH"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="taxId">Steuernummer / USt-IdNr. *</Label>
                  <Input
                    id="taxId"
                    placeholder="DE123456789"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="iban">IBAN für Auszahlungen *</Label>
                  <Input
                    id="iban"
                    placeholder="DE89 3704 0044 0532 0130 00"
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                  />
                </div>
                
                <div className="bg-muted/30 rounded-lg p-4 text-sm">
                  <p className="text-muted-foreground">
                    Diese Daten werden ausschließlich für die Rechnungsstellung und Auszahlung 
                    Ihrer Provisionen verwendet und gemäß DSGVO sicher gespeichert.
                  </p>
                </div>
              </CardContent>
            </>
          )}

          {activeStep === 6 && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                  <PartyPopper className="h-10 w-10 text-emerald-500" />
                </div>
                <CardTitle className="text-2xl">Willkommen an Bord!</CardTitle>
                <CardDescription className="text-base">
                  Ihr Onboarding ist abgeschlossen
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center space-y-6">
                <p className="text-muted-foreground">
                  Sie können jetzt alle Funktionen von MatchHub nutzen und Kandidaten für 
                  offene Stellen einreichen.
                </p>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <Button variant="outline" className="h-auto py-4" onClick={() => navigate('/recruiter/jobs')}>
                    <div className="flex flex-col items-center gap-2">
                      <Briefcase className="h-6 w-6" />
                      <span>Jobs durchsuchen</span>
                    </div>
                  </Button>
                  <Button variant="outline" className="h-auto py-4" onClick={() => navigate('/recruiter/candidates')}>
                    <div className="flex flex-col items-center gap-2">
                      <Users className="h-6 w-6" />
                      <span>Kandidaten verwalten</span>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          <CardFooter className="flex justify-between">
            {activeStep > 1 && activeStep < 6 ? (
              <Button 
                variant="outline" 
                onClick={() => setActiveStep(prev => Math.max(prev - 1, 1))}
                disabled={submitting}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurück
              </Button>
            ) : (
              <div />
            )}
            
            <Button onClick={handleNextStep} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {activeStep === 6 ? 'Zum Dashboard' : 'Weiter'}
              {activeStep < 6 && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
