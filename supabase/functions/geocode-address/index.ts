import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeocodeRequest {
  street: string;
  zip?: string;
  city: string;
  country?: string;
}

interface GeocodeResult {
  lat: number;
  lng: number;
  display_name: string;
  confidence: number;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { street, zip, city, country = 'Germany' }: GeocodeRequest = await req.json();

    if (!street || !city) {
      return new Response(
        JSON.stringify({ error: 'Street and city are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Geocoding address: ${street}, ${zip} ${city}, ${country}`);

    // Build the query string
    const query = encodeURIComponent(
      `${street}, ${zip || ''} ${city}, ${country}`.trim().replace(/\s+/g, ' ')
    );

    // Use Nominatim (OpenStreetMap) - free, no API key needed
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'RecruitingApp/1.0 (recruiting@example.com)',
          'Accept-Language': 'de',
        },
      }
    );

    if (!response.ok) {
      console.error(`Nominatim API error: ${response.status}`);
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const results = await response.json();
    console.log(`Nominatim returned ${results.length} results`);

    if (!results || results.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Address not found', results: [] }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const best = results[0];
    
    // Calculate confidence based on importance and type
    let confidence = 0.5;
    if (best.importance) {
      confidence = Math.min(0.95, best.importance + 0.3);
    }
    if (best.type === 'house' || best.type === 'building') {
      confidence = Math.min(1, confidence + 0.2);
    }

    const result: GeocodeResult = {
      lat: parseFloat(best.lat),
      lng: parseFloat(best.lon),
      display_name: best.display_name,
      confidence: Math.round(confidence * 100) / 100,
    };

    console.log(`Geocoded to: ${result.lat}, ${result.lng} (confidence: ${result.confidence})`);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Geocoding error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
