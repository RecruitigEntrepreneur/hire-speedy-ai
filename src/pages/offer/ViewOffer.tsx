import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOfferByToken, useProcessOfferResponse } from '@/hooks/useOffers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { OfferStatusBadge } from '@/components/offers/OfferStatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Euro,
  Calendar,
  MapPin,
  Building2,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  Gift,
  FileText,
  Briefcase,
  AlertTriangle,
} from 'lucide-react';

export default function ViewOffer() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { data: offer, isLoading, error } = useOfferByToken(token || '');
  const processResponse = useProcessOfferResponse();
  
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showCounterDialog, setShowCounterDialog] = useState(false);
  const [signature, setSignature] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [counterOfferSalary, setCounterOfferSalary] = useState('');
  const [counterOfferNotes, setCounterOfferNotes] = useState('');
  
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Mark as viewed on load
  useEffect(() => {
    if (token && offer && !offer.viewed_at && offer.status === 'sent') {
      processResponse.mutate({ access_token: token, action: 'view' });
    }
  }, [token, offer]);

  const handleAccept = async () => {
    if (!token || !signature) return;
    await processResponse.mutateAsync({
      access_token: token,
      action: 'accept',
      signature,
    });
    setShowAcceptDialog(false);
    navigate('/offer/accepted');
  };

  const handleReject = async () => {
    if (!token) return;
    await processResponse.mutateAsync({
      access_token: token,
      action: 'reject',
      rejection_reason: rejectionReason,
    });
    setShowRejectDialog(false);
  };

  const handleCounterOffer = async () => {
    if (!token || !counterOfferSalary) return;
    await processResponse.mutateAsync({
      access_token: token,
      action: 'counter_offer',
      counter_offer_salary: parseInt(counterOfferSalary),
      counter_offer_notes: counterOfferNotes,
    });
    setShowCounterDialog(false);
  };

  // Canvas signature handling
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      setSignature(canvas.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Angebot nicht gefunden</h2>
            <p className="text-muted-foreground">
              Dieses Angebot existiert nicht oder der Link ist ungültig.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = offer.expires_at && new Date(offer.expires_at) < new Date();
  const canRespond = ['sent', 'viewed'].includes(offer.status) && !isExpired;
  const benefits = offer.benefits as string[] || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center py-6">
          <h1 className="text-3xl font-bold mb-2">Jobangebot</h1>
          <p className="text-muted-foreground">
            {offer.jobs?.company_name || 'Unternehmen'}
          </p>
        </div>

        {/* Status Banner */}
        {(offer.status === 'accepted' || offer.status === 'rejected' || isExpired) && (
          <Card className={`border-2 ${
            offer.status === 'accepted' ? 'border-green-500 bg-green-500/5' :
            offer.status === 'rejected' ? 'border-red-500 bg-red-500/5' :
            'border-gray-500 bg-gray-500/5'
          }`}>
            <CardContent className="py-4 text-center">
              {offer.status === 'accepted' && (
                <>
                  <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="font-semibold text-green-700">Angebot angenommen</p>
                  <p className="text-sm text-muted-foreground">
                    am {format(new Date(offer.decision_at!), 'dd.MM.yyyy', { locale: de })}
                  </p>
                </>
              )}
              {offer.status === 'rejected' && (
                <>
                  <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                  <p className="font-semibold text-red-700">Angebot abgelehnt</p>
                </>
              )}
              {isExpired && offer.status !== 'accepted' && offer.status !== 'rejected' && (
                <>
                  <Clock className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                  <p className="font-semibold text-gray-700">Angebot abgelaufen</p>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Main Offer Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{offer.position_title}</CardTitle>
                <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>{offer.jobs?.company_name}</span>
                </div>
              </div>
              <OfferStatusBadge status={offer.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Salary Section */}
            <div className="bg-primary/5 rounded-lg p-4">
              <div className="flex items-center gap-2 text-primary mb-2">
                <Euro className="h-5 w-5" />
                <span className="font-semibold">Vergütung</span>
              </div>
              <p className="text-3xl font-bold">
                {offer.salary_offered.toLocaleString('de-DE')} {offer.salary_currency}
              </p>
              <p className="text-sm text-muted-foreground">pro Jahr (brutto)</p>
              {offer.bonus_amount && (
                <p className="mt-2">
                  + {offer.bonus_amount.toLocaleString('de-DE')} {offer.salary_currency} Bonus
                </p>
              )}
              {offer.equity_percentage && (
                <p className="mt-1">+ {offer.equity_percentage}% Equity</p>
              )}
            </div>

            {/* Counter Offer Display */}
            {offer.counter_offer_salary && (
              <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/20">
                <div className="flex items-center gap-2 text-purple-700 mb-2">
                  <MessageSquare className="h-5 w-5" />
                  <span className="font-semibold">Ihr Gegenangebot</span>
                </div>
                <p className="text-2xl font-bold text-purple-700">
                  {offer.counter_offer_salary.toLocaleString('de-DE')} {offer.salary_currency}
                </p>
                {offer.counter_offer_notes && (
                  <p className="mt-2 text-sm">{offer.counter_offer_notes}</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Gesendet {formatDistanceToNow(new Date(offer.counter_offer_at!), { locale: de, addSuffix: true })}
                </p>
              </div>
            )}

            <Separator />

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Vertragsart</p>
                  <p className="font-medium">
                    {offer.contract_type === 'permanent' ? 'Unbefristet' : 
                     offer.contract_type === 'fixed' ? 'Befristet' : 'Freiberuflich'}
                  </p>
                </div>
              </div>
              {offer.start_date && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Startdatum</p>
                    <p className="font-medium">
                      {format(new Date(offer.start_date), 'dd.MM.yyyy')}
                    </p>
                  </div>
                </div>
              )}
              {offer.location && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Standort</p>
                    <p className="font-medium">{offer.location}</p>
                  </div>
                </div>
              )}
              {offer.remote_policy && (
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Remote</p>
                    <p className="font-medium">
                      {offer.remote_policy === 'onsite' ? 'Vor Ort' :
                       offer.remote_policy === 'hybrid' ? 'Hybrid' : 'Full Remote'}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Probezeit</p>
                  <p className="font-medium">{offer.probation_months} Monate</p>
                </div>
              </div>
            </div>

            {/* Benefits */}
            {benefits.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Gift className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold">Benefits</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {benefits.map((benefit, i) => (
                      <Badge key={i} variant="secondary">{benefit}</Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Custom Terms */}
            {offer.custom_terms && (
              <>
                <Separator />
                <div>
                  <p className="font-semibold mb-2">Zusätzliche Vereinbarungen</p>
                  <p className="text-muted-foreground">{offer.custom_terms}</p>
                </div>
              </>
            )}

            {/* Expiry Notice */}
            {offer.expires_at && !isExpired && canRespond && (
              <div className="bg-amber-500/10 rounded-lg p-4 text-center">
                <Clock className="h-5 w-5 text-amber-600 mx-auto mb-1" />
                <p className="text-amber-700 font-medium">
                  Angebot gültig bis {format(new Date(offer.expires_at), 'dd.MM.yyyy')}
                </p>
                <p className="text-sm text-muted-foreground">
                  ({formatDistanceToNow(new Date(offer.expires_at), { locale: de, addSuffix: true })})
                </p>
              </div>
            )}

            {/* Action Buttons */}
            {canRespond && (
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button 
                  onClick={() => setShowAcceptDialog(true)}
                  className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  <CheckCircle className="h-5 w-5" />
                  Annehmen
                </Button>
                <Button 
                  onClick={() => setShowCounterDialog(true)}
                  variant="outline"
                  className="flex-1 gap-2"
                  size="lg"
                >
                  <MessageSquare className="h-5 w-5" />
                  Gegenangebot
                </Button>
                <Button 
                  onClick={() => setShowRejectDialog(true)}
                  variant="ghost"
                  className="flex-1 gap-2 text-destructive hover:text-destructive"
                  size="lg"
                >
                  <XCircle className="h-5 w-5" />
                  Ablehnen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Accept Dialog */}
        <Dialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Angebot annehmen</DialogTitle>
              <DialogDescription>
                Bitte unterschreiben Sie digital, um das Angebot anzunehmen.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Ihre Unterschrift:</p>
                <div className="border rounded-lg bg-white">
                  <canvas
                    ref={signatureCanvasRef}
                    width={400}
                    height={150}
                    className="w-full cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                  />
                </div>
                <Button variant="ghost" size="sm" onClick={clearSignature} className="mt-2">
                  Löschen
                </Button>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowAcceptDialog(false)} className="flex-1">
                  Abbrechen
                </Button>
                <Button 
                  onClick={handleAccept} 
                  disabled={!signature || processResponse.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {processResponse.isPending ? 'Wird verarbeitet...' : 'Angebot annehmen'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Angebot ablehnen</DialogTitle>
              <DialogDescription>
                Möchten Sie uns den Grund mitteilen? (optional)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                placeholder="Grund für die Ablehnung..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowRejectDialog(false)} className="flex-1">
                  Abbrechen
                </Button>
                <Button 
                  onClick={handleReject}
                  variant="destructive"
                  disabled={processResponse.isPending}
                  className="flex-1"
                >
                  {processResponse.isPending ? 'Wird verarbeitet...' : 'Ablehnen'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Counter Offer Dialog */}
        <Dialog open={showCounterDialog} onOpenChange={setShowCounterDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gegenangebot machen</DialogTitle>
              <DialogDescription>
                Schlagen Sie ein alternatives Gehalt vor.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Gewünschtes Jahresgehalt *</label>
                <Input
                  type="number"
                  placeholder="85000"
                  value={counterOfferSalary}
                  onChange={(e) => setCounterOfferSalary(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Begründung (optional)</label>
                <Textarea
                  placeholder="Begründen Sie Ihr Gegenangebot..."
                  value={counterOfferNotes}
                  onChange={(e) => setCounterOfferNotes(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowCounterDialog(false)} className="flex-1">
                  Abbrechen
                </Button>
                <Button 
                  onClick={handleCounterOffer}
                  disabled={!counterOfferSalary || processResponse.isPending}
                  className="flex-1"
                >
                  {processResponse.isPending ? 'Wird gesendet...' : 'Gegenangebot senden'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
