import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useOffers, useSendOffer, Offer } from '@/hooks/useOffers';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OfferCard } from '@/components/offers/OfferCard';
import { OfferTimeline } from '@/components/offers/OfferTimeline';
import { OfferStatusBadge } from '@/components/offers/OfferStatusBadge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Search,
  FileText,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Euro,
  User,
  Calendar,
  MessageSquare,
  ExternalLink,
} from 'lucide-react';

export default function ClientOffers() {
  const { user } = useAuth();
  const { data: offers, isLoading } = useOffers(user?.id);
  const sendOffer = useSendOffer();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  const filteredOffers = offers?.filter(offer => {
    const matchesSearch = 
      offer.position_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      offer.candidates?.full_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'draft') return matchesSearch && offer.status === 'draft';
    if (activeTab === 'pending') return matchesSearch && ['sent', 'viewed', 'negotiating'].includes(offer.status);
    if (activeTab === 'accepted') return matchesSearch && offer.status === 'accepted';
    if (activeTab === 'rejected') return matchesSearch && ['rejected', 'expired'].includes(offer.status);
    
    return matchesSearch;
  }) || [];

  const stats = {
    total: offers?.length || 0,
    draft: offers?.filter(o => o.status === 'draft').length || 0,
    pending: offers?.filter(o => ['sent', 'viewed', 'negotiating'].includes(o.status)).length || 0,
    accepted: offers?.filter(o => o.status === 'accepted').length || 0,
    rejected: offers?.filter(o => ['rejected', 'expired'].includes(o.status)).length || 0,
  };

  const handleSendOffer = async (offerId: string) => {
    await sendOffer.mutateAsync({ offerId });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Angebote</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre Jobangebote an Kandidaten
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Gesamt</span>
              </div>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Entwürfe</span>
              </div>
              <p className="text-2xl font-bold">{stats.draft}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">Ausstehend</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Angenommen</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{stats.accepted}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-muted-foreground">Abgelehnt</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suchen nach Position oder Kandidat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Tabs & Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">Alle ({stats.total})</TabsTrigger>
            <TabsTrigger value="draft">Entwürfe ({stats.draft})</TabsTrigger>
            <TabsTrigger value="pending">Ausstehend ({stats.pending})</TabsTrigger>
            <TabsTrigger value="accepted">Angenommen ({stats.accepted})</TabsTrigger>
            <TabsTrigger value="rejected">Abgelehnt ({stats.rejected})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {isLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredOffers.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Keine Angebote</h3>
                  <p className="text-muted-foreground">
                    {activeTab === 'all' 
                      ? 'Sie haben noch keine Angebote erstellt.'
                      : `Keine Angebote mit dem Status "${activeTab}".`}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOffers.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    onSend={() => handleSendOffer(offer.id)}
                    onView={() => setSelectedOffer(offer)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Offer Detail Sheet */}
        <Sheet open={!!selectedOffer} onOpenChange={() => setSelectedOffer(null)}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            {selectedOffer && (
              <>
                <SheetHeader>
                  <SheetTitle>{selectedOffer.position_title}</SheetTitle>
                  <div className="flex items-center gap-2">
                    <OfferStatusBadge status={selectedOffer.status} />
                  </div>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* Candidate Info */}
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{selectedOffer.candidates?.full_name}</p>
                      <p className="text-sm text-muted-foreground">{selectedOffer.candidates?.email}</p>
                    </div>
                  </div>

                  {/* Offer Details */}
                  <div className="space-y-3">
                    <h4 className="font-semibold">Angebotsdetails</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Euro className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedOffer.salary_offered.toLocaleString('de-DE')} {selectedOffer.salary_currency}</span>
                      </div>
                      {selectedOffer.start_date && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{format(new Date(selectedOffer.start_date), 'dd.MM.yyyy')}</span>
                        </div>
                      )}
                      {selectedOffer.expires_at && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>Gültig bis {format(new Date(selectedOffer.expires_at), 'dd.MM.yyyy')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Counter Offer */}
                  {selectedOffer.counter_offer_salary && (
                    <div className="bg-purple-500/10 p-4 rounded-lg">
                      <div className="flex items-center gap-2 text-purple-700 mb-2">
                        <MessageSquare className="h-4 w-4" />
                        <span className="font-semibold">Gegenangebot</span>
                      </div>
                      <p className="text-lg font-bold text-purple-700">
                        {selectedOffer.counter_offer_salary.toLocaleString('de-DE')} {selectedOffer.salary_currency}
                      </p>
                      {selectedOffer.counter_offer_notes && (
                        <p className="text-sm text-muted-foreground mt-1">{selectedOffer.counter_offer_notes}</p>
                      )}
                    </div>
                  )}

                  {/* Benefits */}
                  {(selectedOffer.benefits as string[])?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Benefits</h4>
                      <div className="flex flex-wrap gap-2">
                        {(selectedOffer.benefits as string[]).map((benefit, i) => (
                          <Badge key={i} variant="secondary">{benefit}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timeline */}
                  <div>
                    <h4 className="font-semibold mb-3">Verlauf</h4>
                    <OfferTimeline offerId={selectedOffer.id} />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4">
                    {selectedOffer.status === 'draft' && (
                      <Button 
                        onClick={() => handleSendOffer(selectedOffer.id)}
                        className="flex-1 gap-2"
                        disabled={sendOffer.isPending}
                      >
                        <Send className="h-4 w-4" />
                        Senden
                      </Button>
                    )}
                    {selectedOffer.access_token && (
                      <Button
                        variant="outline"
                        className="flex-1 gap-2"
                        onClick={() => window.open(`/offer/view/${selectedOffer.access_token}`, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                        Kandidaten-Ansicht
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </DashboardLayout>
  );
}
