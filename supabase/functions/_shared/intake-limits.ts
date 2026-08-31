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

export type LimitScope = 'ip' | 'link' | 'draft' | 'email' | 'ai' | 'mail';

export interface LimitRule {
  scope: LimitScope;
  /** Klartext-Schluessel; wird vor dem Speichern gehasht. */
  key: string | null;
  limit: number;
  /** Postgres-Intervall, z. B. '1 hour', '15 minutes'. */
  window?: string;
}

export interface LimitResult {
  allowed: boolean;
  /** Welche Regel gerissen hat — fuer Logs, nicht fuer die Antwort an den Aufrufer. */
  blockedBy?: LimitScope;
  /** true, wenn die Zaehltabelle fehlt (Migration nicht angewandt). */
  degraded?: boolean;
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

  for (const rule of rules) {
    if (!rule.key) continue;
    const { data, error } = await supabase.rpc('intake_rate_limit_hit', {
      _scope: rule.scope,
      _key: await hashKey(rule.key),
      _limit: rule.limit,
      _window: rule.window ?? '1 hour',
    });

    if (error) {
      // Fehlt die Funktion, ist die Migration nicht angewandt. Das wird
      // gemeldet, nicht verschwiegen — aber es sperrt den Kunden nicht aus.
      console.warn('[intake-limits] Zaehlung fehlgeschlagen:', rule.scope, error.message);
      degraded = true;
      continue;
    }
    if (data === false && !blockedBy) blockedBy = rule.scope;
  }

  return { allowed: !blockedBy, blockedBy, degraded };
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
  verifySend: (draftId: string, email: string, ip: string | null): LimitRule[] => [
    { scope: 'mail',  key: draftId, limit: 3  },
    { scope: 'email', key: email,   limit: 5  },
    { scope: 'ip',    key: ip,      limit: 10 },
  ],
  /** Code-Eingabe: der harte Zaehler sitzt auf der Zeile, das hier bremst Streuung. */
  verifyConfirm: (draftId: string, ip: string | null): LimitRule[] => [
    { scope: 'draft', key: draftId, limit: 20 },
    { scope: 'ip',    key: ip,      limit: 40 },
  ],
  /** Weiterleiten und Fortsetzen: eng, das sind Mail-versendende Aktionen. */
  forward: (draftId: string, ip: string | null): LimitRule[] => [
    { scope: 'mail', key: draftId, limit: 3 },
    { scope: 'ip',   key: ip,      limit: 10 },
  ],
  resume: (email: string, ip: string | null): LimitRule[] => [
    { scope: 'email', key: email, limit: 3  },
    { scope: 'ip',    key: ip,    limit: 10 },
  ],
} as const;
