/** Ist ein Menüpunkt aktiv? Startseiten nur genau, alles andere auch für Unterseiten.
 *  Gemeinsam für Seitenleiste (Computer) und Leiste unten (Handy). */
export function istAktiv(pathname: string, href: string) {
  return pathname === href
    || (href !== '/dashboard' && href !== '/recruiter' && href !== '/admin' && pathname.startsWith(href));
}
