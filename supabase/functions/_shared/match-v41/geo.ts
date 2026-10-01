/**
 * Match V4.1 – Entfernung ohne externen Dienst.
 *
 * Erst Koordinaten aus der Datenbank (candidates.address_lat/lng,
 * jobs.office_lat/lng), sonst Stadtmitte aus dieser Tabelle (größere Städte und
 * häufige Bürostandorte in DACH). Unbekannte Orte → null, dann bleibt der Ort
 * „offen" statt geraten.
 */

const CITIES: Record<string, [number, number]> = {
  berlin: [52.52, 13.405], hamburg: [53.551, 9.994], muenchen: [48.137, 11.575], koeln: [50.938, 6.96],
  'frankfurt am main': [50.11, 8.682], frankfurt: [50.11, 8.682], stuttgart: [48.776, 9.183], duesseldorf: [51.227, 6.774],
  leipzig: [51.34, 12.375], dortmund: [51.514, 7.468], essen: [51.456, 7.012], bremen: [53.079, 8.802],
  dresden: [51.05, 13.738], hannover: [52.375, 9.732], nuernberg: [49.452, 11.077], duisburg: [51.435, 6.763],
  bochum: [51.482, 7.216], wuppertal: [51.256, 7.151], bielefeld: [52.03, 8.532], bonn: [50.737, 7.098],
  muenster: [51.961, 7.626], mannheim: [49.488, 8.466], karlsruhe: [49.007, 8.404], augsburg: [48.371, 10.898],
  wiesbaden: [50.078, 8.24], moenchengladbach: [51.18, 6.443], gelsenkirchen: [51.518, 7.086], aachen: [50.776, 6.084],
  braunschweig: [52.269, 10.521], kiel: [54.323, 10.123], chemnitz: [50.828, 12.921], halle: [51.482, 11.97],
  magdeburg: [52.12, 11.628], freiburg: [47.999, 7.842], 'freiburg im breisgau': [47.999, 7.842], krefeld: [51.339, 6.586],
  mainz: [49.993, 8.247], luebeck: [53.866, 10.687], erfurt: [50.978, 11.029], oberhausen: [51.47, 6.852],
  rostock: [54.092, 12.099], kassel: [51.312, 9.48], hagen: [51.367, 7.463], potsdam: [52.391, 13.065],
  saarbruecken: [49.24, 6.997], hamm: [51.681, 7.817], ludwigshafen: [49.477, 8.445], oldenburg: [53.143, 8.214],
  'muelheim an der ruhr': [51.418, 6.884], osnabrueck: [52.279, 8.047], leverkusen: [51.046, 7.019], darmstadt: [49.873, 8.651],
  heidelberg: [49.398, 8.672], solingen: [51.171, 7.083], regensburg: [49.013, 12.101], herne: [51.538, 7.219],
  paderborn: [51.719, 8.754], neuss: [51.204, 6.687], ingolstadt: [48.766, 11.426], 'offenbach am main': [50.096, 8.776],
  offenbach: [50.096, 8.776], wuerzburg: [49.792, 9.954], fuerth: [49.478, 10.989], ulm: [48.401, 9.988],
  heilbronn: [49.142, 9.219], pforzheim: [48.892, 8.694], wolfsburg: [52.423, 10.787], goettingen: [51.541, 9.916],
  bottrop: [51.524, 6.929], reutlingen: [48.491, 9.204], koblenz: [50.356, 7.594], bremerhaven: [53.54, 8.581],
  recklinghausen: [51.614, 7.198], 'bergisch gladbach': [50.992, 7.136], erlangen: [49.59, 11.004], jena: [50.927, 11.589],
  remscheid: [51.179, 7.189], trier: [49.75, 6.637], salzgitter: [52.155, 10.333], moers: [51.451, 6.627],
  siegen: [50.875, 8.024], hildesheim: [52.154, 9.957], guetersloh: [51.906, 8.379], 'schwalbach am taunus': [50.15, 8.533],
  eschborn: [50.143, 8.57], 'bad homburg': [50.227, 8.618], sindelfingen: [48.709, 9.003], boeblingen: [48.685, 9.012],
  rosenheim: [47.857, 12.118], landshut: [48.537, 12.152], passau: [48.574, 13.461], bamberg: [49.891, 10.887],
  bayreuth: [49.945, 11.576], schweinfurt: [50.049, 10.234], konstanz: [47.66, 9.175], friedrichshafen: [47.65, 9.48],
  kaiserslautern: [49.444, 7.769], giessen: [50.584, 8.678], marburg: [50.81, 8.771], fulda: [50.551, 9.676],
  zwickau: [50.718, 12.496], cottbus: [51.756, 14.333], schwerin: [53.636, 11.401], flensburg: [54.794, 9.437],
  wilhelmshaven: [53.53, 8.106], lueneburg: [53.25, 10.414], celle: [52.622, 10.081], minden: [52.289, 8.917],
  detmold: [51.938, 8.879], herford: [52.115, 8.672], garching: [48.249, 11.651], unterschleissheim: [48.28, 11.577],
  ottobrunn: [48.064, 11.666], walldorf: [49.306, 8.643], wien: [48.208, 16.373], zuerich: [47.377, 8.54],
  basel: [47.56, 7.589], bern: [46.948, 7.447], graz: [47.071, 15.439], linz: [48.306, 14.286],
  salzburg: [47.811, 13.055], innsbruck: [47.269, 11.404],
};

function key(city: string): string {
  return city.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, ' ').replace(/\b\d{5}\b/g, ' ')
    .replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Koordinaten einer Stadt aus der Tabelle; „Frankfurt am Main, Hessen" und „80331 München" klappen auch. */
export function cityCoords(city: string | null | undefined): [number, number] | null {
  if (!city) return null;
  const k = key(city.split(/[,/|]/)[0] ?? city);
  if (CITIES[k]) return CITIES[k];
  const first = k.split(' ')[0];
  return first && CITIES[first] ? CITIES[first] : null;
}

export interface Point { lat: number | null; lng: number | null; city: string | null }

function coords(p: Point): [number, number] | null {
  if (typeof p.lat === 'number' && typeof p.lng === 'number' && (p.lat !== 0 || p.lng !== 0)) return [p.lat, p.lng];
  return cityCoords(p.city);
}

/** Luftlinie in km (gerundet), null wenn ein Ort unbekannt ist. */
export function distanceKm(a: Point, b: Point): number | null {
  const x = coords(a);
  const y = coords(b);
  if (!x || !y) return null;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(y[0] - x[0]);
  const dLng = rad(y[1] - x[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(x[0])) * Math.cos(rad(y[0])) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)));
}

/** Grobe Fahrzeit für Luftlinie (Umwege + Stadtverkehr). Nur für Klärfragen, nie für Ausschlüsse unter 70 km. */
export function roughCommuteMinutes(km: number): number {
  return Math.round(km * 1.3 + 10);
}
