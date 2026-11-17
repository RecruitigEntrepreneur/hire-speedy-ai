/**
 * Initialen aus einem Namen (17.11.2026): nur Wörter, die mit einem Buchstaben beginnen,
 * höchstens zwei. „Ben Kurz (Test)“ wird „BK“ statt „BK(“.
 */
export function initialen(name: string | null | undefined, max = 2): string {
  return (name ?? '')
    .trim()
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, max);
}
