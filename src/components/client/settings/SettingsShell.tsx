import type { ReactNode } from 'react';
import { AlertCircle, ArrowLeft, Check, Loader2 } from 'lucide-react';
import type { SaveState } from './useCompanyProfile';

export function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null;
  if (state === 'saving') {
    return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Wird gespeichert …</span>;
  }
  if (state === 'error') {
    return <span className="inline-flex items-center gap-1.5 text-xs text-destructive"><AlertCircle className="h-3.5 w-3.5" />Nicht gespeichert, bitte erneut versuchen</span>;
  }
  return <span className="inline-flex items-center gap-1.5 text-xs text-emerald-500"><Check className="h-3.5 w-3.5" />Automatisch gespeichert</span>;
}

/** Rahmen einer Unterseite: zurück zur Übersicht, Titel, Erklärung, Speicherstand. */
export function SettingsSubpage({ title, description, saveState = 'idle', onBack, children }: {
  title: string;
  description: string;
  saveState?: SaveState;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="max-w-3xl space-y-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />Einstellungen
      </button>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <SaveIndicator state={saveState} />
      </div>
      {children}
    </div>
  );
}

/** Ein Abschnitt innerhalb einer Unterseite: flache Karte mit kleiner Überschrift. */
export function SettingsBlock({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function AusAufnahme({ show }: { show: boolean }) {
  return show ? <span className="ml-1.5 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-normal text-emerald-500">aus Aufnahme</span> : null;
}

export function Fehlt({ show }: { show: boolean }) {
  return show ? <span className="ml-1.5 text-[11px] font-normal text-amber-500">fehlt</span> : null;
}
