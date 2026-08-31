/**
 * Wortlaut und Version der Zustimmung bei der Beauftragungsanfrage.
 *
 * Die Version gehört zum Text: ändert sich der Wortlaut, ändert sich die
 * Version — sonst ist der gespeicherte Nachweis wertlos. Spiegel der Konstante
 * in supabase/functions/intake-submit/index.ts.
 *
 * Heute wird terms_version in ClientOnboarding.tsx:73 hart als '1.0' übergeben,
 * während die AGB-Seite „Stand: Juni 2026" trägt und der zugestimmte Text ein
 * dritter, nur im Onboarding existierender ist. Das hier ist der Gegenentwurf:
 * ein Text, eine Version, ein Snapshot.
 */
export const CONSENT_TEXT_VERSION = '2026-09-v1';

export const CONSENT_TEXT = [
  'Ich bin berechtigt, für das genannte Unternehmen eine Beauftragung anzufragen.',
  'Ich habe die dargestellten Konditionen und die Allgemeinen Geschäftsbedingungen zur Kenntnis genommen und stimme ihnen zu.',
  'Mir ist bekannt, dass mit dieser Anfrage noch kein Vertrag zustande kommt: Matchunt prüft die Anfrage und nimmt sie gesondert an.',
] as const;
