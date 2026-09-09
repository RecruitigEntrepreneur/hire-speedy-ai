/**
 * Rate-Limit fuer die login-freien Aufnahme-Endpunkte.
 *
 * Es gibt im Repo bisher kein Rate-Limiting auf irgendeinem no-auth- oder
 * KI-Endpunkt; die einzige rate_limit-Tabelle betrifft Outreach-Mailversand.
 * Ohne Bremse stellt ein oeffentlicher Aufnahme-Link LLM- und Firecrawl-Budget
 * ungebremst ins offene Netz: ein einziger enrich-Aufruf loest bis zu drei
 * Firecrawl-Calls plus einen LLM-Call aus.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hashKey } from './tokens.ts';

export type LimitScope = 'ip' | 'link' | 'draft' | 'email' | 'ai' | 'mail' | 'forward';

export interface LimitRule {
  scope: LimitScope;
  /** Klartext-Schluessel; wird vor dem Speichern gehasht. */
  key: string | null;
  limit: number;
  /** Fensterlaenge in Sekunden. Voreinstellung: eine Stunde. */
  windowSeconds?: number;
}

const STUNDE = 3600;

export interface LimitResult {
  allowed: boolean;
  /** Welche Regel gerissen hat — fuer Logs, nicht fuer die Antwort an den Aufrufer. */
  blockedBy?: LimitScope;
  /** true, wenn die Zaehltabelle fehlt (Migration nicht angewandt). */
  degraded?: boolean;
  /**
   * Wann es wieder geht. Die Fenster sind fest und liegen auf Vielfachen der
   * Fensterlaenge (siehe intake_rate_limit_hit) -- das laesst sich ausrechnen,
   * ohne die Datenbank zu fragen. Ohne diese Angabe stand vor dem Kunden eine
   * Sperre ohne Ende, und die Meldung schickte ihn in den Spam-Ordner.
   */
  retryAt?: Date;
}

/**
 * Prueft mehrere Regeln. Jede Regel zaehlt hoch, auch wenn eine frueher
 * gerissene bereits sperrt — sonst koennte ein Angreifer durch das Reissen
 * einer billigen Regel die Zaehlung der teuren umgehen.
 */
export async function checkLimits(
  supabase: SupabaseClient,
  rules: LimitRule[],
): Promise<LimitResult> {
  let blockedBy: LimitScope | undefined;
  let degraded = false;

  let retryAt: Date | undefined;

  for (const rule of rules) {
    if (!rule.key) continue;
    const fenster = rule.windowSeconds ?? STUNDE;
    const { data, error } = await supabase.rpc('intake_rate_limit_hit', {
      _scope: rule.scope,
      _key: await hashKey(rule.key),
      _limit: rule.limit,
      _window: `${fenster} seconds`,
    });

    if (error) {
      // Fehlt die Funktion, ist die Migration nicht angewandt. Das wird
      // gemeldet, nicht verschwiegen — aber es sperrt den Kunden nicht aus.
      console.warn('[intake-limits] Zaehlung fehlgeschlagen:', rule.scope, error.message);
      degraded = true;
      continue;
    }
    if (data === false) {
      // Das Ende des laufenden Fensters. Reissen mehrere Regeln, gilt die
      // spaeteste -- vorher waere der Kunde nach der ersten wiedergekommen
      // und an der zweiten haengen geblieben.
      const ende = new Date((Math.floor(Date.now() / 1000 / fenster) + 1) * fenster * 1000);
      if (!retryAt || ende > retryAt) retryAt = ende;
      if (!blockedBy) blockedBy = rule.scope;
    }
  }

  return { allowed: !blockedBy, blockedBy, degraded, retryAt };
}

/** Voreinstellungen an einer Stelle, damit sie nicht in zehn Functions driften. */
export const LIMITS = {
  /** Link oeffnen: 30 pro IP und Stunde, 300 pro Link und Stunde. */
  start:  (ip: string | null, linkId: string): LimitRule[] => [
    { scope: 'ip',   key: ip,     limit: 30  },
    { scope: 'link', key: linkId, limit: 300 },
  ],
  /** Autosave: grosszuegig, das ist normale Tipparbeit. */
  draftPatch: (draftId: string): LimitRule[] => [
    { scope: 'draft', key: draftId, limit: 600 },
  ],
  /** KI-Aufrufe: die einzige Stelle, an der echtes Geld verbrannt wird. */
  ai: (draftId: string, ip: string | null): LimitRule[] => [
    { scope: 'ai', key: draftId, limit: 60  },
    { scope: 'ip', key: ip,      limit: 150 },
  ],
  /** Verifizierungsmail: 3 Sendungen je Entwurf und Stunde, 10 je IP. */
  /**
   * "Code senden" heisst: es kommt ein Code. Kein Deckel auf dem Entwurf.
   *
   * BEFUND (09.09.2026, an einer echten Aufnahme erlebt): 3 Codes pro STUNDE
   * je ENTWURF, bei 15 Minuten Gueltigkeit. Zwei Anlaeufe innerhalb einer
   * Viertelstunde -- die erste Mail im Spam, ein Tippfehler in der Adresse --
   * und der Kunde sass bis zur vollen Stunde mit einem abgelaufenen Code da.
   *
   * Der Deckel sass an der falschen Stelle. Wer die Aufnahme missbrauchen
   * will, oeffnet einfach einen zweiten Entwurf -- die Regel hat also nie
   * einen Angreifer gebremst, nur den Kunden an der letzten Stelle vor der
   * Beauftragung. Sie ist weg.
   *
   * Was bleibt, sitzt dort, wo der Missbrauch stattfindet: der Link ist
   * oeffentlich, jeder kann eine fremde Adresse eintippen. Ohne Deckel liesse
   * sich damit ein Fremder mit Matchunt-Mails zuschuetten -- der meldet sie
   * als Spam, und danach landen die Codes ECHTER Kunden im Spam-Ordner. Der
   * Ruf der Absenderdomain ist der Grund, warum die Mails ueberhaupt
   * ankommen. Also: pro Adresse und pro IP, mit Fenstern, die zur
   * Codelaufzeit passen statt zur Uhr.
   */
  verifySend: (_draftId: string, email: string, ip: string | null): LimitRule[] => [
    { scope: 'email', key: email, limit: 4,  windowSeconds: 15 * 60 },
    { scope: 'ip',    key: ip,    limit: 20, windowSeconds: 15 * 60 },
  ],
  /**
   * Code-Eingabe: der harte Zaehler sitzt auf der Code-Zeile (max_attempts = 5),
   * das hier bremst nur die Streuung ueber viele Codes hinweg.
   *
   * Grosszuegiger als vorher (20/40 pro Stunde): ein Kunde, der sich zweimal
   * vertippt und dann zwei neue Codes anfordert, kam der alten Grenze naeher
   * als jeder Angreifer -- der raet 1.000.000 Kombinationen nicht in 20
   * Versuchen, und nach fuenf ist die Zeile ohnehin tot.
   */
  verifyConfirm: (draftId: string, ip: string | null): LimitRule[] => [
    { scope: 'draft', key: draftId, limit: 50  },
    { scope: 'ip',    key: ip,      limit: 100 },
  ],
  /**
   * Weiterleiten und Fortsetzen: eng, das sind Mail-versendende Aktionen.
   *
   * EIGENER Zaehler. Vorher teilte sich das Weiterleiten den Topf `mail` mit
   * den Bestaetigungscodes -- gleicher scope, gleicher key. Ein
   * Fachbereichsleiter, der die Aufnahme zweimal an HR und den Chef schickt
   * (das Normalste der Welt), hatte danach noch EINEN Code frei, ohne je zu
   * ahnen, warum.
   */
  forward: (draftId: string, ip: string | null): LimitRule[] => [
    { scope: 'forward', key: draftId, limit: 3 },
    { scope: 'ip',      key: ip,      limit: 10 },
  ],
  resume: (email: string, ip: string | null): LimitRule[] => [
    { scope: 'email', key: email, limit: 3  },
    { scope: 'ip',    key: ip,    limit: 10 },
  ],
} as const;
