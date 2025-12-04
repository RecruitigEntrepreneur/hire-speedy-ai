import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, PartyPopper } from 'lucide-react';

export default function OfferAccepted() {
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
              <h1 className="text-2xl font-bold">Herzlichen Glückwunsch!</h1>
              <PartyPopper className="h-6 w-6 text-amber-500 scale-x-[-1]" />
            </div>
            <p className="text-muted-foreground">
              Sie haben das Angebot erfolgreich angenommen.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm text-left space-y-2">
            <p className="font-medium">Was passiert als nächstes?</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>✓ Das Unternehmen wird über Ihre Annahme informiert</li>
              <li>✓ Sie erhalten in Kürze weitere Informationen</li>
              <li>✓ Ihr Recruiter wird sich bei Ihnen melden</li>
            </ul>
          </div>

          <p className="text-sm text-muted-foreground">
            Sie können dieses Fenster jetzt schließen.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
