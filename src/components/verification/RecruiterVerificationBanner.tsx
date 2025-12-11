import { AlertCircle, CheckCircle, Clock, FileText, Shield, FileSignature, User, Rocket } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useRecruiterVerification } from '@/hooks/useRecruiterVerification';
import { useNavigate } from 'react-router-dom';

export function RecruiterVerificationBanner() {
  const { verification, loading, currentStep, canSubmitCandidates, isFullyVerified } = useRecruiterVerification();
  const navigate = useNavigate();

  if (loading) return null;

  // Don't show banner if fully verified
  if (isFullyVerified) return null;

  const steps = [
    { step: 1, label: 'Willkommen', icon: Rocket },
    { step: 2, label: 'AGB', icon: FileText },
    { step: 3, label: 'NDA', icon: Shield },
    { step: 4, label: 'Vertrag', icon: FileSignature },
    { step: 5, label: 'Profil', icon: User },
  ];

  const progressValue = (currentStep / 6) * 100;

  const getStatusMessage = () => {
    if (!verification) {
      return 'Bitte vervollständigen Sie Ihr Onboarding, um Kandidaten einreichen zu können.';
    }
    if (!verification.info_acknowledged) {
      return 'Bitte schließen Sie das Onboarding ab, um loszulegen.';
    }
    if (!verification.terms_accepted) {
      return 'Bitte akzeptieren Sie unsere AGB, um fortzufahren.';
    }
    if (!verification.nda_accepted) {
      return 'Bitte akzeptieren Sie die Vertraulichkeitsvereinbarung.';
    }
    if (!verification.contract_signed) {
      return 'Bitte unterschreiben Sie den Rahmenvertrag.';
    }
    if (!verification.profile_complete) {
      return 'Bitte vervollständigen Sie Ihr Profil für die Rechnungsstellung.';
    }
    return 'Onboarding läuft...';
  };

  const getAlertVariant = (): 'default' | 'destructive' => {
    return 'default';
  };

  return (
    <Alert variant={getAlertVariant()} className="mb-6">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        Onboarding erforderlich
        {verification?.contract_signed && !verification?.profile_complete && (
          <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
            <Clock className="h-3 w-3" />
            Fast fertig
          </span>
        )}
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-3">{getStatusMessage()}</p>
        
        <div className="mb-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Fortschritt</span>
            <span>{Math.round(progressValue)}%</span>
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>

        <div className="flex gap-2 flex-wrap mb-4">
          {steps.map(({ step, label, icon: Icon }) => (
            <div
              key={step}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                currentStep > step
                  ? 'bg-primary/20 text-primary'
                  : currentStep === step
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </div>
          ))}
        </div>

        <Button
          size="sm"
          onClick={() => navigate('/recruiter/onboarding')}
          className="mt-2"
        >
          {currentStep === 0 ? 'Onboarding starten' : 'Fortfahren'}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
