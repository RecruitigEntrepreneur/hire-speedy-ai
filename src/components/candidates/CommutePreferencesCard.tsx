import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Car, Train, Bike, MapPin, Home, Building2, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface CommutePreferencesData {
  max_commute_minutes: number;
  commute_mode: string;
  address_street: string;
  address_city: string;
  address_zip: string;
  address_lat?: number | null;
  address_lng?: number | null;
  remote_days_preferred: number;
  remote_flexibility: string;
}

interface CommutePreferencesCardProps {
  data: CommutePreferencesData;
  onChange: (data: Partial<CommutePreferencesData>) => void;
  showAddress?: boolean;
}

// Beschriftung: candidates:commute.mode.<wert> und candidates:commute.flexibility.<wert>
const commuteModeOptions = [
  { value: 'car', icon: Car },
  { value: 'public_transit', icon: Train },
  { value: 'bike', icon: Bike },
  { value: 'any', icon: MapPin },
];

const remoteFlexibilityOptions = ['strict', 'flexible', 'negotiable'];

export function CommutePreferencesCard({ 
  data, 
  onChange,
  showAddress = true 
}: CommutePreferencesCardProps) {
  const { t } = useTranslation('candidates');
  const [geocoding, setGeocoding] = useState(false);
  const [geocoded, setGeocoded] = useState(false);

  const getCommuteLabel = (minutes: number) => {
    if (minutes <= 15) return t('commute.length.veryShort');
    if (minutes <= 30) return t('commute.length.short');
    if (minutes <= 45) return t('commute.length.medium');
    if (minutes <= 60) return t('commute.length.long');
    return t('commute.length.veryLong');
  };

  const getRemoteDaysLabel = (days: number) => {
    if (days === 0) return t('commute.onsiteOnly');
    if (days === 5) return t('commute.fullyRemote');
    return t('commute.remoteDays', { count: days });
  };

  const handleGeocode = useCallback(async () => {
    if (!data.address_street || !data.address_city) {
      toast.error(t('commute.needStreetCity'));
      return;
    }

    setGeocoding(true);
    setGeocoded(false);
    
    try {
      // Use Nominatim (OpenStreetMap) for geocoding - free and no API key needed
      const query = encodeURIComponent(
        `${data.address_street}, ${data.address_zip} ${data.address_city}, Germany`
      );
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`,
        {
          headers: {
            'User-Agent': 'RecruitingApp/1.0',
          },
        }
      );
      
      const results = await response.json();
      
      if (results && results.length > 0) {
        const { lat, lon } = results[0];
        onChange({
          address_lat: parseFloat(lat),
          address_lng: parseFloat(lon),
        });
        setGeocoded(true);
        toast.success(t('commute.geocodeSuccess'));
      } else {
        toast.error(t('commute.addressNotFound'));
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      toast.error(t('commute.geocodeError'));
    } finally {
      setGeocoding(false);
    }
  }, [data.address_street, data.address_zip, data.address_city, onChange, t]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Car className="h-4 w-4" />
          {t('commute.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Max Commute Time Slider */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label className="flex items-center gap-2">
              <MapPin className="h-3 w-3" />
              {t('commute.maxCommute')}
            </Label>
            <span className="text-sm font-medium">
              {t('commute.minutesWithLabel', { count: data.max_commute_minutes, label: getCommuteLabel(data.max_commute_minutes) })}
            </span>
          </div>
          <Slider
            value={[data.max_commute_minutes]}
            onValueChange={([value]) => onChange({ max_commute_minutes: value })}
            min={10}
            max={90}
            step={5}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t('commute.minutes', { count: 10 })}</span>
            <span>{t('commute.minutes', { count: 30 })}</span>
            <span>{t('commute.minutes', { count: 60 })}</span>
            <span>{t('commute.minutes', { count: 90 })}</span>
          </div>
        </div>

        {/* Commute Mode */}
        <div className="space-y-2">
          <Label>{t('commute.preferredMode')}</Label>
          <div className="grid grid-cols-4 gap-2">
            {commuteModeOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = data.commute_mode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange({ commute_mode: option.value })}
                  className={`
                    flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all
                    ${isSelected 
                      ? 'border-primary bg-primary/10 text-primary' 
                      : 'border-border hover:border-muted-foreground/50'
                    }
                  `}
                >
                  <Icon className="h-5 w-5 mb-1" />
                  <span className="text-xs">{t(`commute.mode.${option.value}`)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Remote Days Slider */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label className="flex items-center gap-2">
              <Home className="h-3 w-3" />
              {t('commute.remoteDaysPerWeek')}
            </Label>
            <span className="text-sm font-medium">
              {getRemoteDaysLabel(data.remote_days_preferred)}
            </span>
          </div>
          <Slider
            value={[data.remote_days_preferred]}
            onValueChange={([value]) => onChange({ remote_days_preferred: value })}
            min={0}
            max={5}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {t('commute.onsite')}
            </span>
            <span>{t('commute.hybrid')}</span>
            <span className="flex items-center gap-1">
              <Home className="h-3 w-3" />
              {t('commute.remote')}
            </span>
          </div>
        </div>

        {/* Remote Flexibility */}
        <div className="space-y-2">
          <Label>{t('commute.remoteFlexibility')}</Label>
          <Select 
            value={data.remote_flexibility} 
            onValueChange={(value) => onChange({ remote_flexibility: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('commute.chooseFlexibility')} />
            </SelectTrigger>
            <SelectContent>
              {remoteFlexibilityOptions.map(option => (
                <SelectItem key={option} value={option}>
                  {t(`commute.flexibility.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Address Fields */}
        {showAddress && (
          <div className="space-y-4 pt-2 border-t">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {t('commute.homeAddress')}
              </Label>
              {data.address_lat && data.address_lng && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  {t('commute.hasCoordinates')}
                </span>
              )}
            </div>
            <div className="space-y-3">
              <Input
                value={data.address_street}
                onChange={(e) => {
                  onChange({ address_street: e.target.value });
                  setGeocoded(false);
                }}
                placeholder={t('commute.streetPlaceholder')}
              />
              <div className="grid grid-cols-3 gap-2">
                <Input
                  value={data.address_zip}
                  onChange={(e) => {
                    onChange({ address_zip: e.target.value });
                    setGeocoded(false);
                  }}
                  placeholder={t('commute.zipPlaceholder')}
                  className="col-span-1"
                />
                <Input
                  value={data.address_city}
                  onChange={(e) => {
                    onChange({ address_city: e.target.value });
                    setGeocoded(false);
                  }}
                  placeholder={t('commute.cityPlaceholder')}
                  className="col-span-2"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleGeocode}
                disabled={geocoding || !data.address_street || !data.address_city}
              >
                {geocoding ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('commute.geocoding')}
                  </>
                ) : geocoded ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-green-600" />
                    {t('commute.geocoded')}
                  </>
                ) : (
                  <>
                    <MapPin className="h-4 w-4 mr-2" />
                    {t('commute.geocode')}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
