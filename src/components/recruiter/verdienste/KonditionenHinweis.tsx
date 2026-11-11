import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { abrechnungApi, useConditionsNotice } from '@/lib/abrechnungApi';
import { dmy } from '../../../../supabase/functions/_shared/abrechnung-view';

/**
 * H1: Hinweis oben im Dashboard, bis zugestimmt ist (ohne Warnfarbe). Erscheint nur,
 * wenn Matchunt den Stichtag für Fassung 2 gesetzt hat (A10) und der Headhunter noch
 * nicht zugestimmt hat. „Ansehen“ öffnet H2.
 */
export function KonditionenHinweis() {
  const { data } = useConditionsNotice();
  const [open, setOpen] = useState(false);
  if (!data?.show || !data.activeFrom) return null;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
        <span className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>Neue Konditionen ab {dmy(data.activeFrom)}: mehr für Nachbesetzungen, Auszahlung in zwei Teilen</span>
        </span>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Ansehen</Button>
      </div>
      <KonditionenDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

/** H2: Neue Konditionen zustimmen (mittig). */
export function KonditionenDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data } = useConditionsNotice();
  const [busy, setBusy] = useState(false);
  if (!data?.activeFrom) return null;
  const agree = async () => {
    setBusy(true);
    try {
      const next = await abrechnungApi.consent();
      qc.setQueryData(['konditionen-hinweis', user?.id], next);
      void qc.invalidateQueries({ queryKey: ['job-terms'] });
      toast.success('Danke. Die neuen Konditionen gelten für Stellen, die du ab dem Stichtag aktivierst.');
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Deine Zustimmung konnte nicht gespeichert werden.');
    } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Neue Konditionen ab {dmy(data.activeFrom)}</DialogTitle>
          <DialogDescription>Für Stellen, die du ab dann aktivierst. Was du vorher aktiviert hast, bleibt, wie es ist.</DialogDescription>
        </DialogHeader>
        <div className="text-sm">
          <div className="grid grid-cols-[8.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 pb-1 text-xs text-muted-foreground"><span /><span>bisher</span><span>neu</span></div>
          {data.table.map((r) => (
            <div key={r.label} className="grid grid-cols-[8.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 border-t border-border py-2">
              <span className="text-muted-foreground">{r.label}</span>
              <span>{r.before}</span>
              <span className={cn(r.changed && 'font-medium')}>{r.after}</span>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Stimmst du nicht zu, gilt die bisherige Fassung, bis sie 12 Monate alt ist. Danach gilt die neue, angekündigt 8 Wochen vorher (Vertrag § 18 Abs. 2).</p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Später</Button>
          <Button disabled={busy} onClick={() => void agree()}>{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}Zustimmen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
