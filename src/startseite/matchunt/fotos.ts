// Fotos der Headhunter für die Website. Ziel: echte Fotos von Personen, die zugestimmt haben.
// Einsetzen: Bild quadratisch (mind. 200 × 200 px) nach `public/headhunter/` legen und hier den Pfad eintragen,
// z. B. "/headhunter/1.jpg". Die Liste gilt für den Einstieg (K1), die Plattform (60.2) und die Kreisbahnen (63.1).
// Solange ein Platz leer ist, zeigt die Website dort das Personen-Zeichen.
// 23.11.2026, Marko: vorerst KI-erzeugte Beispiel-Gesichter (Higgsfield Soul 2.0), KEINE echten Headhunter.
// Vor dem Livegang durch echte Fotos mit Zustimmung ersetzen oder bewusst so lassen.
// 24.11.2026: drei weitere Beispiel-Gesichter (6–8), damit die acht Plätze der Kreisbahnen kein Foto doppelt zeigen.
export const HH_FOTOS: string[] = ["/headhunter/1.jpg", "/headhunter/2.jpg", "/headhunter/3.jpg", "/headhunter/4.jpg", "/headhunter/5.jpg", "/headhunter/6.jpg", "/headhunter/7.jpg", "/headhunter/8.jpg"];

/** Foto für den i-ten Platz (bei mehr Plätzen als Fotos reihum), oder null, wenn es noch keine gibt. */
export const hhFoto = (i: number): string | null => (HH_FOTOS.length ? HH_FOTOS[i % HH_FOTOS.length] : null);
