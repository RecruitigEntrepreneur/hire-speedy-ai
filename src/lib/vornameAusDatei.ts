/**
 * Vorname aus dem Dateinamen eines Lebenslaufs (12.11.2026), nur für die Vorschau des Hinweises:
 * Beim Hochladen ist der Lebenslauf noch nicht gelesen. Die Mail selbst nimmt den Namen aus dem
 * Lebenslauf. Nur wenn mindestens zwei Namensteile übrig bleiben, gilt der erste als Vorname;
 * bei nur einem Wort ist offen, ob es Vor- oder Nachname ist, dann lieber keiner.
 */
const FUELLWOERTER = new Set([
  'lebenslauf', 'lebenslaeufe', 'cv', 'resume', 'résumé', 'bewerbung', 'bewerbungsunterlagen', 'unterlagen', 'anschreiben',
  'profil', 'profile', 'test', 'final', 'neu', 'new', 'aktuell', 'kopie', 'copy', 'de', 'en', 'deutsch', 'english', 'german',
  'ohne', 'mit', 'mail', 'email', 'e', 'und', 'von', 'van', 'der', 'den', 'du', 'la', 'le',
]);

export function vornameAusDatei(dateiname: string): string | null {
  const ohneEndung = dateiname.replace(/\.[a-z0-9]{2,5}$/i, '');
  const teile = ohneEndung
    .split(/[\s_\-.,()[\]+]+/)
    .filter((t) => t && /^[\p{L}]{2,}$/u.test(t) && !FUELLWOERTER.has(t.toLowerCase()));
  if (teile.length < 2) return null;
  const v = teile[0];
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}
