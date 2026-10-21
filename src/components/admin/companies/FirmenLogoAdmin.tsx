import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageDown, Loader2, RefreshCw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FirmenLogo } from '@/components/company/FirmenLogo';
import { companyLabel, type ClientCompany } from '@/hooks/useClientCompanies';

const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

/** Woher das Logo kommt, in einem Satz. */
function herkunft(c: Pick<ClientCompany, 'logo_url' | 'logo_source' | 'logo_check' | 'logo_checked_at'>): string {
  if (c.logo_source === 'upload') return 'Hochgeladen';
  if (c.logo_source === 'removed') return 'Vom Kunden entfernt, wird nicht automatisch geholt';
  if (c.logo_source === 'website' && c.logo_url) return `Von ${c.logo_check?.website ?? 'der Website'} geholt`;
  if (c.logo_checked_at && c.logo_check?.gefunden === false) {
    return c.logo_check.grund === 'keine Website' ? 'Keine Website hinterlegt' : `Auf ${c.logo_check.website ?? 'der Website'} nichts Brauchbares gefunden`;
  }
  return 'Noch nicht geholt';
}

/**
 * Logo-Zeile im Prüfdialog (Admin › Firmen prüfen). Beim ersten Öffnen ohne
 * Logo wird es einmal geholt; „Neu holen" holt auch über ein eigenes Logo
 * hinweg, „Ersetzen" lädt eins hoch (gilt dann als hochgeladen).
 */
export function LogoZeile({ row }: { row: ClientCompany }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<'holen' | 'hochladen' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const name = companyLabel(row.pending_change ?? row);

  const neuLaden = () => Promise.all([
    qc.invalidateQueries({ queryKey: ['admin-company-queue'] }),
    qc.invalidateQueries({ queryKey: ['admin-logo-bestand'] }),
  ]);

  const holen = async (neu: boolean) => {
    setBusy('holen');
    const { data, error } = await supabase.functions.invoke('firmenlogo-holen', { body: { company_id: row.id, neu } });
    setBusy(null);
    const status = (data as { status?: string } | null)?.status;
    if (error) toast.error('Logo konnte nicht geholt werden.');
    else if (neu) toast[status === 'geholt' ? 'success' : 'message'](status === 'geholt' ? 'Logo geholt' : 'Kein brauchbares Logo auf der Website');
    await neuLaden();
  };

  // Einmal automatisch, wenn noch nie versucht.
  useEffect(() => {
    if (row.logo_source === undefined) return; // Spalten noch nicht live
    if (!row.logo_url && !row.logo_checked_at && !row.logo_source) void holen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id]);

  const hochladen = async (file: File) => {
    if (!LOGO_TYPES.includes(file.type) || file.size > 2 * 1024 * 1024) {
      toast.error('Bitte PNG, JPG, WebP oder SVG bis 2 MB.');
      return;
    }
    setBusy('hochladen');
    try {
      const pfad = `firmen/${row.id}/admin-${Date.now()}.${file.type === 'image/svg+xml' ? 'svg' : file.type.split('/')[1]}`;
      const up = await supabase.storage.from('company-logos').upload(pfad, file, { contentType: file.type });
      if (up.error) throw up.error;
      const url = supabase.storage.from('company-logos').getPublicUrl(pfad).data.publicUrl;
      const { error } = await (supabase as any).rpc('client_set_company_logo', { p_company_id: row.id, p_logo_url: url });
      if (error) throw error;
      toast.success('Logo ersetzt');
      await neuLaden();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hochladen hat nicht geklappt.');
    } finally {
      setBusy(null);
    }
  };

  if (row.logo_source === undefined) return null; // vor der Migration

  return (
    <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
      <FirmenLogo url={row.logo_url} name={name} size={40} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">Logo</p>
        <p className="truncate text-sm">{busy === 'holen' ? 'wird von der Website geholt …' : herkunft(row)}</p>
      </div>
      <input ref={fileRef} type="file" accept={LOGO_TYPES.join(',')} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void hochladen(f); e.target.value = ''; }} />
      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" disabled={!!busy} onClick={() => void holen(true)}>
        {busy === 'holen' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Neu holen
      </Button>
      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" disabled={!!busy} onClick={() => fileRef.current?.click()}>
        {busy === 'hochladen' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}Ersetzen
      </Button>
    </div>
  );
}

/**
 * Einmalig für den Bestand: Logos für alle Firmen holen, die noch keins haben
 * und nie versucht wurden. Die Function arbeitet in Portionen; der Knopf ruft
 * so lange nach, bis nichts mehr offen ist. Ohne offene Firmen unsichtbar.
 */
export function LogosNachholen() {
  const qc = useQueryClient();
  const [laeuft, setLaeuft] = useState(false);
  const [stand, setStand] = useState<{ geholt: number; ohne: number } | null>(null);
  const { data: offen = 0, isError } = useQuery({
    queryKey: ['admin-logo-bestand'],
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      const { count, error } = await (supabase as any).from('client_companies')
        .select('id', { count: 'exact', head: true })
        .is('logo_source', null)
        .is('logo_checked_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const start = async () => {
    setLaeuft(true);
    let summe = { geholt: 0, ohne: 0 };
    try {
      for (let runde = 0; runde < 40; runde++) {
        const { data, error } = await supabase.functions.invoke('firmenlogo-holen', { body: { alle: true } });
        if (error) throw error;
        const r = data as { geholt: number; ohne: number; offen: number };
        summe = { geholt: summe.geholt + r.geholt, ohne: summe.ohne + r.ohne };
        setStand(summe);
        if (!r.offen || r.geholt + r.ohne === 0) break;
      }
      toast.success(`${summe.geholt} Logos geholt, ${summe.ohne} ohne Treffer`);
    } catch {
      toast.error('Nachholen abgebrochen. Später erneut versuchen.');
    } finally {
      setLaeuft(false);
      await qc.invalidateQueries({ queryKey: ['admin-logo-bestand'] });
    }
  };

  if (isError || (!offen && !laeuft && !stand)) return null;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-3">
          <ImageDown className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Firmenlogos</p>
            <p className="text-xs text-muted-foreground">
              {laeuft
                ? `Läuft … ${stand ? `${stand.geholt} geholt, ${stand.ohne} ohne Treffer` : ''}`
                : stand
                  ? `${stand.geholt} geholt, ${stand.ohne} ohne Treffer${offen ? ` · ${offen} noch offen` : ''}`
                  : `${offen} ${offen === 1 ? 'Firma hat' : 'Firmen haben'} noch kein Logo. Einmal von ihren Websites holen.`}
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" disabled={laeuft || !offen} onClick={() => void start()}>
          {laeuft && <Loader2 className="h-4 w-4 animate-spin" />}Logos holen
        </Button>
      </CardContent>
    </Card>
  );
}
