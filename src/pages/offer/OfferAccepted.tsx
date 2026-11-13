import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, PartyPopper } from 'lucide-react';

export default function OfferAccepted() {
  const { t } = useTranslation('offerAnswer');
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-8 pb-8 space-y-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 bg-green-500/20 rounded-full animate-ping" />
            </div>
            <CheckCircle className="h-24 w-24 text-green-500 mx-auto relative" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <PartyPopper className="h-6 w-6 text-amber-500" />
              <h1 className="text-2xl font-bold">{t('accepted.title')}</h1>
              <PartyPopper className="h-6 w-6 text-amber-500 scale-x-[-1]" />
            </div>
            <p className="text-muted-foreground">
              {t('accepted.body')}
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm text-left space-y-2">
            <p className="font-medium">{t('accepted.next')}</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>{t('accepted.step1')}</li>
              <li>{t('accepted.step2')}</li>
              <li>{t('accepted.step3')}</li>
            </ul>
          </div>

          <p className="text-sm text-muted-foreground">
            {t('accepted.close')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
