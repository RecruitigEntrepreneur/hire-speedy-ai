import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Euro, 
  MessageSquare, 
  CheckCircle, 
  XCircle, 
  ArrowRight,
  Loader2 
} from 'lucide-react';

interface CounterOffer {
  salary: number;
  notes: string;
}

interface OfferNegotiationCardProps {
  offerId: string;
  currentSalary: number;
  counterOffer: CounterOffer | null;
  currency: string;
  onAccept: () => void;
  onReject: () => void;
  onCounter: (newSalary: number) => void;
}

export function OfferNegotiationCard({
  offerId,
  currentSalary,
  counterOffer,
  currency,
  onAccept,
  onReject,
  onCounter,
}: OfferNegotiationCardProps) {
  const [counterDialogOpen, setCounterDialogOpen] = useState(false);
  const [newSalary, setNewSalary] = useState(counterOffer?.salary || currentSalary);
  const [counterNotes, setCounterNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleSubmitCounter = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('offers')
        .update({
          salary_offered: newSalary,
          status: 'negotiating',
        })
        .eq('id', offerId);

      if (error) throw error;

      toast.success('Neues Angebot gesendet');
      setCounterDialogOpen(false);
      onCounter(newSalary);
    } catch (error) {
      console.error('Error submitting counter offer:', error);
      toast.error('Fehler beim Senden');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currency || 'EUR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const difference = counterOffer ? counterOffer.salary - currentSalary : 0;
  const percentDiff = counterOffer ? ((difference / currentSalary) * 100).toFixed(1) : 0;

  return (
    <>
      <Card className="border-violet-200 bg-violet-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-violet-700">
            <MessageSquare className="h-4 w-4" />
            Gehaltsverhandlung
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {counterOffer ? (
            <div className="space-y-3">
              {/* Counter Offer Display */}
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-violet-200">
                <div>
                  <p className="text-xs text-muted-foreground">Ihr Angebot</p>
                  <p className="text-lg font-bold">{formatCurrency(currentSalary)}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-violet-400" />
                <div>
                  <p className="text-xs text-muted-foreground">Gegenangebot</p>
                  <p className="text-lg font-bold text-violet-700">
                    {formatCurrency(counterOffer.salary)}
                  </p>
                </div>
                <Badge variant="outline" className={`${difference > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {difference > 0 ? '+' : ''}{percentDiff}%
                </Badge>
              </div>

              {counterOffer.notes && (
                <div className="p-3 bg-white rounded-lg border border-violet-200">
                  <p className="text-xs text-muted-foreground mb-1">Begründung des Kandidaten</p>
                  <p className="text-sm">{counterOffer.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setCounterDialogOpen(true)}
                >
                  Gegenangebot
                </Button>
                <Button 
                  variant="default" 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={onAccept}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Akzeptieren
                </Button>
                <Button 
                  variant="destructive"
                  onClick={onReject}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">Warten auf Antwort des Kandidaten...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Counter Dialog */}
      <Dialog open={counterDialogOpen} onOpenChange={setCounterDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Neues Angebot erstellen</DialogTitle>
            <DialogDescription>
              Aktuelles Gegenangebot: {counterOffer && formatCurrency(counterOffer.salary)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newSalary">Neues Gehalt ({currency})</Label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="newSalary"
                  type="number"
                  value={newSalary}
                  onChange={(e) => setNewSalary(Number(e.target.value))}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Nachricht an Kandidat (optional)</Label>
              <Textarea
                id="notes"
                value={counterNotes}
                onChange={(e) => setCounterNotes(e.target.value)}
                placeholder="z.B. Wir können bei den Benefits entgegenkommen..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCounterDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSubmitCounter} disabled={processing}>
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Angebot senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
