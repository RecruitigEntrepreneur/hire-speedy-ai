import { useState, useCallback } from 'react';
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

const commuteModeOptions = [
  { value: 'car', label: 'Auto', icon: Car },
  { value: 'public_transit', label: 'ÖPNV', icon: Train },
  { value: 'bike', label: 'Fahrrad', icon: Bike },
  { value: 'any', label: 'Egal', icon: MapPin },
];

const remoteFlexibilityOptions = [
  { value: 'strict', label: 'Strikt (nur diese Option)' },
  { value: 'flexible', label: 'Flexibel (verhandelbar)' },
  { value: 'negotiable', label: 'Offen für Alternativen' },
];

export function CommutePreferencesCard({ 
  data, 
  onChange,
  showAddress = true 
}: CommutePreferencesCardProps) {
  const [geocoding, setGeocoding] = useState(false);
  const [geocoded, setGeocoded] = useState(false);

  const getCommuteLabel = (minutes: number) => {
    if (minutes <= 15) return 'Sehr kurz';
    if (minutes <= 30) return 'Kurz';
    if (minutes <= 45) return 'Mittel';
    if (minutes <= 60) return 'Lang';
    return 'Sehr lang';
  };

  const getRemoteDaysLabel = (days: number) => {
    if (days === 0) return 'Nur vor Ort';
    if (days === 5) return 'Vollständig Remote';
    return `${days} Tag${days > 1 ? 'e' : ''} Remote`;
  };

  const handleGeocode = useCallback(async () => {
    if (!data.address_street || !data.address_city) {
      toast.error('Bitte Straße und Stadt eingeben');
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
        toast.success('Koordinaten erfolgreich ermittelt');
      } else {
        toast.error('Adresse nicht gefunden');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      toast.error('Fehler bei der Adresssuche');
    } finally {
      setGeocoding(false);
    }
  }, [data.address_street, data.address_zip, data.address_city, onChange]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Car className="h-4 w-4" />
          Pendel & Remote-Präferenzen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Max Commute Time Slider */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label className="flex items-center gap-2">
              <MapPin className="h-3 w-3" />
              Max. Pendelzeit
            </Label>
            <span className="text-sm font-medium">
              {data.max_commute_minutes} Min ({getCommuteLabel(data.max_commute_minutes)})
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
            <span>10 Min</span>
            <span>30 Min</span>
            <span>60 Min</span>
            <span>90 Min</span>
          </div>
        </div>

        {/* Commute Mode */}
        <div className="space-y-2">
          <Label>Bevorzugtes Transportmittel</Label>
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
                  <span className="text-xs">{option.label}</span>
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
              Remote-Tage pro Woche
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
              Vor Ort
            </span>
            <span>Hybrid</span>
            <span className="flex items-center gap-1">
              <Home className="h-3 w-3" />
              Remote
            </span>
          </div>
        </div>

        {/* Remote Flexibility */}
        <div className="space-y-2">
          <Label>Flexibilität bei Remote</Label>
          <Select 
            value={data.remote_flexibility} 
            onValueChange={(value) => onChange({ remote_flexibility: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Flexibilität wählen" />
            </SelectTrigger>
            <SelectContent>
              {remoteFlexibilityOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
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
                Wohnadresse (für Routenberechnung)
              </Label>
              {data.address_lat && data.address_lng && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Koordinaten vorhanden
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
                placeholder="Straße und Hausnummer"
              />
              <div className="grid grid-cols-3 gap-2">
                <Input
                  value={data.address_zip}
                  onChange={(e) => {
                    onChange({ address_zip: e.target.value });
                    setGeocoded(false);
                  }}
                  placeholder="PLZ"
                  className="col-span-1"
                />
                <Input
                  value={data.address_city}
                  onChange={(e) => {
                    onChange({ address_city: e.target.value });
                    setGeocoded(false);
                  }}
                  placeholder="Stadt"
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
                    Suche Koordinaten...
                  </>
                ) : geocoded ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-green-600" />
                    Koordinaten ermittelt
                  </>
                ) : (
                  <>
                    <MapPin className="h-4 w-4 mr-2" />
                    Koordinaten ermitteln
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
