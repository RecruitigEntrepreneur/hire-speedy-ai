import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { dfLocale, fmtDate, fmtNumber } from '@/lib/localeFormat';
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
import { formatDistanceToNow } from 'date-fns';
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
  const { t } = useTranslation('offerAnswer');
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
            <h2 className="text-xl font-semibold mb-2">{t('view.notFoundTitle')}</h2>
            <p className="text-muted-foreground">
              {t('view.notFoundBody')}
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
          <h1 className="text-3xl font-bold mb-2">{t('view.title')}</h1>
          <p className="text-muted-foreground">
            {offer.jobs?.company_name || t('view.company')}
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
                  <p className="font-semibold text-green-700">{t('view.accepted')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('view.acceptedOn', { date: fmtDate(offer.decision_at!) })}
                  </p>
                </>
              )}
              {offer.status === 'rejected' && (
                <>
                  <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                  <p className="font-semibold text-red-700">{t('view.rejected')}</p>
                </>
              )}
              {isExpired && offer.status !== 'accepted' && offer.status !== 'rejected' && (
                <>
                  <Clock className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                  <p className="font-semibold text-gray-700">{t('view.expired')}</p>
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
                <span className="font-semibold">{t('view.pay')}</span>
              </div>
              <p className="text-3xl font-bold">
                {fmtNumber(offer.salary_offered)} {offer.salary_currency}
              </p>
              <p className="text-sm text-muted-foreground">{t('view.perYear')}</p>
              {offer.bonus_amount && (
                <p className="mt-2">
                  {t('view.bonus', { amount: fmtNumber(offer.bonus_amount), currency: offer.salary_currency })}
                </p>
              )}
              {offer.equity_percentage && (
                <p className="mt-1">{t('view.equity', { percent: offer.equity_percentage })}</p>
              )}
            </div>

            {/* Counter Offer Display */}
            {offer.counter_offer_salary && (
              <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/20">
                <div className="flex items-center gap-2 text-purple-700 mb-2">
                  <MessageSquare className="h-5 w-5" />
                  <span className="font-semibold">{t('view.yourCounter')}</span>
                </div>
                <p className="text-2xl font-bold text-purple-700">
                  {fmtNumber(offer.counter_offer_salary)} {offer.salary_currency}
                </p>
                {offer.counter_offer_notes && (
                  <p className="mt-2 text-sm">{offer.counter_offer_notes}</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {t('view.sent', { when: formatDistanceToNow(new Date(offer.counter_offer_at!), { locale: dfLocale(), addSuffix: true }) })}
                </p>
              </div>
            )}

            <Separator />

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">{t('view.contractType')}</p>
                  <p className="font-medium">
                    {offer.contract_type === 'permanent' ? t('view.permanent') :
                     offer.contract_type === 'fixed' ? t('view.fixed') : t('view.freelance')}
                  </p>
                </div>
              </div>
              {offer.start_date && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">{t('view.startDate')}</p>
                    <p className="font-medium">
                      {fmtDate(offer.start_date)}
                    </p>
                  </div>
                </div>
              )}
              {offer.location && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">{t('view.location')}</p>
                    <p className="font-medium">{offer.location}</p>
                  </div>
                </div>
              )}
              {offer.remote_policy && (
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">{t('view.remote')}</p>
                    <p className="font-medium">
                      {offer.remote_policy === 'onsite' ? t('view.onsite') :
                       offer.remote_policy === 'hybrid' ? t('view.hybrid') : t('view.fullRemote')}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">{t('view.probation')}</p>
                  <p className="font-medium">{t('view.probationMonths', { count: offer.probation_months })}</p>
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
                    <span className="font-semibold">{t('view.benefits')}</span>
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
                  <p className="font-semibold mb-2">{t('view.customTerms')}</p>
                  <p className="text-muted-foreground">{offer.custom_terms}</p>
                </div>
              </>
            )}

            {/* Expiry Notice */}
            {offer.expires_at && !isExpired && canRespond && (
              <div className="bg-amber-500/10 rounded-lg p-4 text-center">
                <Clock className="h-5 w-5 text-amber-600 mx-auto mb-1" />
                <p className="text-amber-700 font-medium">
                  {t('view.validUntil', { date: fmtDate(offer.expires_at) })}
                </p>
                <p className="text-sm text-muted-foreground">
                  ({formatDistanceToNow(new Date(offer.expires_at), { locale: dfLocale(), addSuffix: true })})
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
                  {t('view.acceptBtn')}
                </Button>
                <Button 
                  onClick={() => setShowCounterDialog(true)}
                  variant="outline"
                  className="flex-1 gap-2"
                  size="lg"
                >
                  <MessageSquare className="h-5 w-5" />
                  {t('view.counterBtn')}
                </Button>
                <Button 
                  onClick={() => setShowRejectDialog(true)}
                  variant="ghost"
                  className="flex-1 gap-2 text-destructive hover:text-destructive"
                  size="lg"
                >
                  <XCircle className="h-5 w-5" />
                  {t('view.rejectBtn')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Accept Dialog */}
        <Dialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('view.acceptTitle')}</DialogTitle>
              <DialogDescription>
                {t('view.acceptDesc')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">{t('view.yourSignature')}</p>
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
                  {t('view.clear')}
                </Button>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowAcceptDialog(false)} className="flex-1">
                  {t('view.cancel')}
                </Button>
                <Button 
                  onClick={handleAccept} 
                  disabled={!signature || processResponse.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {processResponse.isPending ? t('view.processing') : t('view.acceptTitle')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('view.rejectTitle')}</DialogTitle>
              <DialogDescription>
                {t('view.rejectDesc')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                placeholder={t('view.rejectPlaceholder')}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowRejectDialog(false)} className="flex-1">
                  {t('view.cancel')}
                </Button>
                <Button 
                  onClick={handleReject}
                  variant="destructive"
                  disabled={processResponse.isPending}
                  className="flex-1"
                >
                  {processResponse.isPending ? t('view.processing') : t('view.rejectBtn')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Counter Offer Dialog */}
        <Dialog open={showCounterDialog} onOpenChange={setShowCounterDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('view.counterTitle')}</DialogTitle>
              <DialogDescription>
                {t('view.counterDesc')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t('view.desiredSalary')}</label>
                <Input
                  type="number"
                  placeholder="85000"
                  value={counterOfferSalary}
                  onChange={(e) => setCounterOfferSalary(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('view.reasonOptional')}</label>
                <Textarea
                  placeholder={t('view.counterPlaceholder')}
                  value={counterOfferNotes}
                  onChange={(e) => setCounterOfferNotes(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowCounterDialog(false)} className="flex-1">
                  {t('view.cancel')}
                </Button>
                <Button 
                  onClick={handleCounterOffer}
                  disabled={!counterOfferSalary || processResponse.isPending}
                  className="flex-1"
                >
                  {processResponse.isPending ? t('view.sending') : t('view.sendCounter')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
