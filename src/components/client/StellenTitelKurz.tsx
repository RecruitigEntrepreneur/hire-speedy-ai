/** „(m/w/d)“ am Ende eines Stellentitels; am Handy fällt es in Filter-Knöpfen weg (17.11.2026). */
const ZUSATZ = /\s*\((?:m\/w\/d|w\/m\/d|m\/f\/d|f\/m\/d|d\/m\/w|all genders?)\)\s*$/i;

export function StellenTitelKurz({ titel }: { titel: string }) {
  const m = titel.match(ZUSATZ);
  if (!m || m.index === undefined) return <>{titel}</>;
  return <>{titel.slice(0, m.index)}<span className="max-md:hidden">{m[0]}</span></>;
}
