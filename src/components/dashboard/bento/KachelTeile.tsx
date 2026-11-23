import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * Gemeinsame Bausteine der vier Dashboard-Kacheln (Apple-Stil, 21.11.2026): jede Kachel hat
 * dieselbe Reiter-Zeile mit Linie und gleich hohe Zeilen, damit die Listen links und rechts
 * auf einer Höhe beginnen. Rechts steht entweder die eine Handlung (blau) oder der Stand (grau).
 */

export function KachelReiter<T extends string>({ items, value, onChange }: {
  items: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <div role="tablist" className="mb-1.5 flex gap-1 overflow-x-auto border-b pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          role="tab"
          aria-selected={value === it.key}
          onClick={() => onChange(it.key)}
          className={cn(
            'h-7 shrink-0 whitespace-nowrap rounded-full px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === it.key ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

interface ZeileProps {
  title: ReactNode;
  sub?: ReactNode;
  /** Die eine Handlung der Zeile, blau mit „›“. */
  action?: string;
  /** Der Stand der Zeile, grau; nur wenn es keine Handlung gibt. */
  state?: string;
  to?: string;
  /** Externer Link (z. B. Termin beitreten): nur die Handlung ist klickbar. */
  actionHref?: string;
  onClick?: () => void;
  /** data-Attribute für Rundgänge */
  rowAttrs?: Record<string, string>;
  actionAttrs?: Record<string, string>;
}

const ZEILE = 'group flex h-12 w-full items-center gap-3 rounded-lg px-2.5 text-left transition-colors';

export function KachelZeile({ title, sub, action, state, to, actionHref, onClick, rowAttrs, actionAttrs }: ZeileProps) {
  const inhalt = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">{title}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
      {action && actionHref ? (
        <a href={actionHref} target="_blank" rel="noreferrer" className="shrink-0 whitespace-nowrap text-xs font-medium text-klick hover:underline" {...actionAttrs}>{action} ›</a>
      ) : action ? (
        <span className="shrink-0 whitespace-nowrap text-xs font-medium text-klick" {...actionAttrs}>{action} ›</span>
      ) : state ? (
        <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{state}</span>
      ) : null}
    </>
  );
  if (to) return <Link to={to} className={cn(ZEILE, 'hover:bg-secondary/60')} {...rowAttrs}>{inhalt}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cn(ZEILE, 'hover:bg-secondary/60')} {...rowAttrs}>{inhalt}</button>;
  return <div className={ZEILE} {...rowAttrs}>{inhalt}</div>;
}

export function KachelLeer({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 items-center justify-center py-6 text-center text-sm text-muted-foreground">{children}</div>;
}
