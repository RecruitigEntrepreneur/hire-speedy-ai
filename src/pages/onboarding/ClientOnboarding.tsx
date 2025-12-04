import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useClientVerification } from '@/hooks/useClientVerification';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { 
  Loader2, CheckCircle, FileText, PenTool, Building2, 
  ArrowRight, ArrowLeft, Shield
} from 'lucide-react';
import { toast } from 'sonner';

const STEPS = [
  { id: 'terms', title: 'AGB akzeptieren', icon: FileText },
  { id: 'contract', title: 'Vertrag unterzeichnen', icon: PenTool },
  { id: 'company', title: 'Firmendaten', icon: Building2 },
  { id: 'complete', title: 'Abgeschlossen', icon: CheckCircle },
];

export default function ClientOnboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    verification, 
    loading, 
    acceptTerms, 
    signContract, 
    submitKycDocuments,
    currentStep,
    isFullyVerified 
  } = useClientVerification();

  const [step, setStep] = useState(0);
  const [processing, setProcessing] = useState(false);
  
  // Form states
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [signature, setSignature] = useState('');
  const [companyRegNumber, setCompanyRegNumber] = useState('');
  const [vatId, setVatId] = useState('');

  useEffect(() => {
    if (verification) {
      // Set step based on verification status
      if (verification.kyc_status === 'verified') {
        setStep(3);
      } else if (verification.contract_signed) {
        setStep(2);
      } else if (verification.terms_accepted) {
        setStep(1);
      }
    }
  }, [verification]);

  useEffect(() => {
    if (isFullyVerified) {
      // Redirect to dashboard after a short delay
      setTimeout(() => navigate('/dashboard'), 2000);
    }
  }, [isFullyVerified, navigate]);

  const handleAcceptTerms = async () => {
    if (!termsAccepted) {
      toast.error('Bitte akzeptieren Sie die AGB');
      return;
    }
    setProcessing(true);
    const success = await acceptTerms('1.0');
    if (success) {
      toast.success('AGB akzeptiert');
      setStep(1);
    } else {
      toast.error('Fehler beim Speichern');
    }
    setProcessing(false);
  };

  const handleSignContract = async () => {
    if (!signature.trim()) {
      toast.error('Bitte geben Sie Ihre digitale Unterschrift ein');
      return;
    }
    setProcessing(true);
    const success = await signContract(signature);
    if (success) {
      toast.success('Vertrag unterzeichnet');
      setStep(2);
    } else {
      toast.error('Fehler beim Speichern');
    }
    setProcessing(false);
  };

  const handleSubmitCompanyData = async () => {
    setProcessing(true);
    const success = await submitKycDocuments(companyRegNumber, vatId);
    if (success) {
      toast.success('Firmendaten eingereicht');
      setStep(3);
    } else {
      toast.error('Fehler beim Speichern');
    }
    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Account-Verifizierung
          </h1>
          <p className="text-muted-foreground mt-2">
            Vervollständigen Sie Ihr Profil, um Jobs veröffentlichen zu können.
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <Progress value={progress} className="h-2 mb-4" />
          <div className="flex justify-between">
            {STEPS.map((s, i) => (
              <div 
                key={s.id} 
                className={`flex flex-col items-center ${i <= step ? 'text-primary' : 'text-muted-foreground'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
                  i < step ? 'bg-primary text-primary-foreground' : 
                  i === step ? 'border-2 border-primary' : 'border-2 border-muted'
                }`}>
                  {i < step ? <CheckCircle className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                </div>
                <span className="text-xs hidden sm:block">{s.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <Card>
          {step === 0 && (
            <>
              <CardHeader>
                <CardTitle>Allgemeine Geschäftsbedingungen</CardTitle>
                <CardDescription>
                  Bitte lesen und akzeptieren Sie unsere AGB, um fortzufahren.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-4 rounded-lg max-h-60 overflow-y-auto text-sm">
                  <h4 className="font-semibold mb-2">1. Geltungsbereich</h4>
                  <p className="mb-4">
                    Diese Allgemeinen Geschäftsbedingungen gelten für alle Geschäftsbeziehungen 
                    zwischen der Plattform und den Kunden (Unternehmen, die Positionen besetzen möchten).
                  </p>
                  <h4 className="font-semibold mb-2">2. Leistungen</h4>
                  <p className="mb-4">
                    Die Plattform vermittelt Kandidaten von verifizierten Recruitern an Unternehmen. 
                    Bei erfolgreicher Vermittlung wird eine Vermittlungsgebühr fällig.
                  </p>
                  <h4 className="font-semibold mb-2">3. Gebühren</h4>
                  <p className="mb-4">
                    Die Vermittlungsgebühr beträgt standardmäßig 20% des Jahresgehalts des 
                    vermittelten Kandidaten. Die Gebühr wird bei Unterzeichnung des Arbeitsvertrags fällig.
                  </p>
                  <h4 className="font-semibold mb-2">4. Datenschutz</h4>
                  <p>
                    Wir verarbeiten personenbezogene Daten gemäß DSGVO. Weitere Informationen 
                    finden Sie in unserer Datenschutzerklärung.
                  </p>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox 
                    id="terms" 
                    checked={termsAccepted} 
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                  />
                  <Label htmlFor="terms" className="text-sm leading-tight cursor-pointer">
                    Ich habe die Allgemeinen Geschäftsbedingungen gelesen und akzeptiere sie.
                  </Label>
                </div>

                <Button onClick={handleAcceptTerms} disabled={processing || !termsAccepted} className="w-full">
                  {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Weiter
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </>
          )}

          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle>Vertrag digital unterzeichnen</CardTitle>
                <CardDescription>
                  Geben Sie Ihren vollständigen Namen als digitale Unterschrift ein.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-4 rounded-lg text-sm">
                  <p className="font-semibold mb-2">Vertragsbestätigung</p>
                  <p>
                    Hiermit bestätige ich, dass ich berechtigt bin, im Namen meines Unternehmens 
                    Verträge abzuschließen und stimme den vereinbarten Konditionen zu.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signature">Digitale Unterschrift (Ihr vollständiger Name)</Label>
                  <Input
                    id="signature"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder="Max Mustermann"
                    className="font-serif italic text-lg"
                  />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(0)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Zurück
                  </Button>
                  <Button onClick={handleSignContract} disabled={processing || !signature.trim()} className="flex-1">
                    {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PenTool className="h-4 w-4 mr-2" />}
                    Vertrag unterzeichnen
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle>Firmendaten</CardTitle>
                <CardDescription>
                  Optional: Geben Sie Ihre Firmendaten für die Rechnungsstellung ein.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="regNumber">Handelsregisternummer (optional)</Label>
                  <Input
                    id="regNumber"
                    value={companyRegNumber}
                    onChange={(e) => setCompanyRegNumber(e.target.value)}
                    placeholder="HRB 12345"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vatId">Umsatzsteuer-ID (optional)</Label>
                  <Input
                    id="vatId"
                    value={vatId}
                    onChange={(e) => setVatId(e.target.value)}
                    placeholder="DE123456789"
                  />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Zurück
                  </Button>
                  <Button onClick={handleSubmitCompanyData} disabled={processing} className="flex-1">
                    {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Abschließen
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {step === 3 && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle>Verifizierung abgeschlossen!</CardTitle>
                <CardDescription>
                  Ihr Account ist jetzt vollständig verifiziert. Sie können nun Jobs veröffentlichen.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => navigate('/dashboard')} className="w-full">
                  Zum Dashboard
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
