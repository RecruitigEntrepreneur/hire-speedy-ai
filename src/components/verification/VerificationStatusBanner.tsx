import { AlertCircle, CheckCircle, Clock, FileText, Shield } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useClientVerification } from '@/hooks/useClientVerification';
import { useNavigate } from 'react-router-dom';

export function VerificationStatusBanner() {
  const { verification, loading, currentStep, canPublishJobs, isFullyVerified } = useClientVerification();
  const navigate = useNavigate();

  if (loading) return null;

  // Don't show banner if fully verified
  if (isFullyVerified) return null;

  const steps = [
    { step: 1, label: 'AGB akzeptieren', icon: FileText },
    { step: 2, label: 'Vertrag unterschreiben', icon: Shield },
    { step: 3, label: 'KYC-Dokumente', icon: CheckCircle },
  ];

  const progressValue = (currentStep / 4) * 100;

  const getStatusMessage = () => {
    if (!verification) {
      return 'Bitte vervollständigen Sie Ihre Verifikation, um Jobs veröffentlichen zu können.';
    }
    if (!verification.terms_accepted) {
      return 'Bitte akzeptieren Sie unsere AGB, um fortzufahren.';
    }
    if (!verification.contract_signed) {
      return 'Bitte unterschreiben Sie den Vermittlungsvertrag.';
    }
    if (verification.kyc_status === 'pending') {
      return 'Bitte laden Sie Ihre KYC-Dokumente hoch.';
    }
    if (verification.kyc_status === 'in_review') {
      return 'Ihre Dokumente werden geprüft. Sie können bereits Jobs veröffentlichen.';
    }
    if (verification.kyc_status === 'rejected') {
      return `KYC abgelehnt: ${verification.kyc_rejection_reason || 'Bitte laden Sie neue Dokumente hoch.'}`;
    }
    return 'Verifikation läuft...';
  };

  const getAlertVariant = () => {
    if (verification?.kyc_status === 'rejected') return 'destructive';
    if (canPublishJobs) return 'default';
    return 'default';
  };

  return (
    <Alert variant={getAlertVariant()} className="mb-6">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        Verifikation erforderlich
        {verification?.kyc_status === 'in_review' && (
          <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
            <Clock className="h-3 w-3" />
            In Prüfung
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
          onClick={() => navigate('/onboarding')}
          className="mt-2"
        >
          {currentStep === 0 ? 'Verifikation starten' : 'Fortfahren'}
        </Button>
      </AlertDescription>
    </Alert>
  );
}