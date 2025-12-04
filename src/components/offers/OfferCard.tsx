import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OfferStatusBadge } from './OfferStatusBadge';
import { Offer } from '@/hooks/useOffers';
import { formatDistanceToNow, format } from 'date-fns';
import { de } from 'date-fns/locale';
import { 
  Euro, 
  Calendar, 
  MapPin, 
  Send, 
  Eye, 
  Clock,
  User,
  Building2
} from 'lucide-react';

interface OfferCardProps {
  offer: Offer;
  onSend?: () => void;
  onView?: () => void;
}

export function OfferCard({ offer, onSend, onView }: OfferCardProps) {
  const isExpired = offer.expires_at && new Date(offer.expires_at) < new Date();
  const expiresIn = offer.expires_at 
    ? formatDistanceToNow(new Date(offer.expires_at), { locale: de, addSuffix: true })
    : null;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold">
              {offer.position_title}
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{offer.candidates?.full_name}</span>
            </div>
            {offer.jobs?.company_name && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>{offer.jobs.company_name}</span>
              </div>
            )}
          </div>
          <OfferStatusBadge status={offer.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Euro className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {offer.salary_offered.toLocaleString('de-DE')} {offer.salary_currency}
            </span>
          </div>
          {offer.start_date && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{format(new Date(offer.start_date), 'dd.MM.yyyy')}</span>
            </div>
          )}
          {offer.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{offer.location}</span>
            </div>
          )}
          {offer.expires_at && !isExpired && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-amber-600">Läuft ab {expiresIn}</span>
            </div>
          )}
        </div>

        {offer.counter_offer_salary && (
          <div className="bg-purple-500/10 p-3 rounded-lg text-sm">
            <span className="font-medium text-purple-700">Gegenangebot: </span>
            <span>{offer.counter_offer_salary.toLocaleString('de-DE')} {offer.salary_currency}</span>
            {offer.counter_offer_notes && (
              <p className="text-muted-foreground mt-1">{offer.counter_offer_notes}</p>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {offer.status === 'draft' && onSend && (
            <Button onClick={onSend} className="flex-1 gap-2">
              <Send className="h-4 w-4" />
              Senden
            </Button>
          )}
          <Button variant="outline" onClick={onView} className="flex-1 gap-2">
            <Eye className="h-4 w-4" />
            Details
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          Erstellt {formatDistanceToNow(new Date(offer.created_at), { locale: de, addSuffix: true })}
          {offer.sent_at && (
            <> • Gesendet {formatDistanceToNow(new Date(offer.sent_at), { locale: de, addSuffix: true })}</>
          )}
          {offer.viewed_at && (
            <> • Angesehen {formatDistanceToNow(new Date(offer.viewed_at), { locale: de, addSuffix: true })}</>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
