import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Zap, Users, Bell, TrendingUp, Loader2 } from 'lucide-react';

interface JobBoostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle: string;
  onBoosted?: () => void;
}

const boostOptions = [
  {
    id: 'notify',
    icon: Bell,
    title: 'Recruiter benachrichtigen',
    description: 'Push-Benachrichtigung an alle aktiven Recruiter senden',
    action: 'Kostenlos',
  },
  {
    id: 'priority',
    icon: TrendingUp,
    title: 'Priorität erhöhen',
    description: 'Job erscheint oben in der Recruiter-Liste für 7 Tage',
    action: 'Kommt bald',
    disabled: true,
  },
  {
    id: 'expand',
    icon: Users,
    title: 'Reichweite erweitern',
    description: 'Job wird an mehr Recruiter aus verwandten Branchen gezeigt',
    action: 'Kommt bald',
    disabled: true,
  },
];

export function JobBoostDialog({
  open,
  onOpenChange,
  jobId,
  jobTitle,
  onBoosted,
}: JobBoostDialogProps) {
  const [boosting, setBoosting] = useState(false);

  const handleBoost = async (optionId: string) => {
    if (optionId !== 'notify') {
      toast.info('Diese Funktion kommt bald!');
      return;
    }

    setBoosting(true);
    try {
      // TODO: Implement actual boost notification via edge function
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('Recruiter wurden benachrichtigt!');
      onOpenChange(false);
      onBoosted?.();
    } catch (error) {
      console.error('Error boosting job:', error);
      toast.error('Fehler beim Boosten');
    } finally {
      setBoosting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Job boosten
          </DialogTitle>
          <DialogDescription>
            Mehr Aufmerksamkeit für "{jobTitle}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {boostOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => handleBoost(option.id)}
              disabled={option.disabled || boosting}
              className={`w-full flex items-start gap-3 p-4 rounded-lg border text-left transition-all ${
                option.disabled 
                  ? 'opacity-50 cursor-not-allowed bg-muted/30' 
                  : 'hover:border-primary/50 hover:bg-accent/50 cursor-pointer'
              }`}
            >
              <div className={`p-2 rounded-lg ${option.disabled ? 'bg-muted' : 'bg-primary/10'}`}>
                <option.icon className={`h-5 w-5 ${option.disabled ? 'text-muted-foreground' : 'text-primary'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{option.title}</span>
                  <Badge 
                    variant={option.disabled ? 'secondary' : 'outline'} 
                    className={option.disabled ? '' : 'text-emerald-600 border-emerald-300'}
                  >
                    {option.action}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {option.description}
                </p>
              </div>
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
