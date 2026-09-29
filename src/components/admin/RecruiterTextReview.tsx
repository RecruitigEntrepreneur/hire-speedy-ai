import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, Pencil, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AnzeigeAnsicht } from '@/components/recruiter/AnzeigeAnsicht';
import { AnspracheTeilen, type Kanal } from '@/components/recruiter/AnspracheTeilen';
import type { WorkspaceJob } from '@/components/recruiter/RecruiterJobWorkspace';
import { buildAnsprache, buildJobPosting } from '@/lib/jobPosting';
import { recruiterTagessatz, spanne } from '@/lib/contractingFreigabe';
import {
  betragFunde, namensFunde, textDerAnzeige, verboteneBegriffe, type Ansprache, type Anzeige,
} from '../../../supabase/functions/_shared/recruiter-anzeige.ts';

type Json = Record<string, any>;

export interface TextEntwurf {
  content: Json;
  pruefung: { begriffe?: string[]; ohneGrundlage?: string[] | null; erzeugtAm?: string; bearbeitet?: boolean } | null;
  created_at?: string;
}

/**
 * „Anzeige für Recruiter" -- Matchunt prüft Anzeige und Kurzansprachen, bevor
 * sie live gehen (Entscheidung 29.09.2026). Genutzt im Freigabe-Dialog und in
 * Admin > Jobs für Stellen, die schon live sind.
 *
 * Ablauf: gibt es einen Entwurf, wird er gezeigt. Sonst, wenn die Stelle noch
 * keine neue Anzeige hat, erzeugt die KI einen (format-job-for-recruiters mit
 * entwurf: true). Übernommen wird er erst vom Aufrufer (Freigeben bzw.
 * „Übernehmen") -- bis dahin sieht kein Recruiter etwas davon.
 */
export function RecruiterTextReview({
  job, mandate, onEntwurf, onBusy, onSperre,
}: {
  job: Json;
  mandate?: Json | null;
  onEntwurf: (entwurf: TextEntwurf | null) => void;
  onBusy?: (busy: boolean) => void;
  /** true, solange Firmenname oder Domain im Text stehen -- dann darf nichts live gehen. */
  onSperre?: (gesperrt: boolean) => void;
}) {
  const [entwurf, setEntwurf] = useState<TextEntwurf | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [erzeugt, setErzeugt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [bearbeiten, setBearbeiten] = useState(false);
  const [kanal, setKanal] = useState<Kanal>('linkedin');

  const setze = useCallback((e: TextEntwurf | null) => { setEntwurf(e); onEntwurf(e); }, [onEntwurf]);
  const busy = (b: boolean) => { setErzeugt(b); onBusy?.(b); };

  const erzeugen = useCallback(async () => {
    busy(true);
    setFehler(null);
    const { data, error } = await supabase.functions.invoke('format-job-for-recruiters', { body: { jobId: job.id, entwurf: true } });
    busy(false);
    if (error || !data?.formattedContent) {
      setFehler('Die Anzeige konnte nicht erzeugt werden. Bitte erneut versuchen.');
      return;
    }
    setze({ content: data.formattedContent, pruefung: data.pruefung ?? null, created_at: new Date().toISOString() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id, setze]);

  useEffect(() => {
    let abbruch = false;
    (async () => {
      setLaedt(true);
      const { data } = await supabase.from('job_recruiter_text_drafts' as never)
        .select('content, pruefung, created_at').eq('job_id', job.id).maybeSingle();
      if (abbruch) return;
      setLaedt(false);
      if (data) { setze(data as unknown as TextEntwurf); return; }
      setze(null);
      if (!job.formatted_content?.anzeige) void erzeugen();
    })();
    return () => { abbruch = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  // Was gezeigt und geprüft wird: der Entwurf, sonst die veröffentlichte Fassung.
  const inhalt: Json | null = entwurf?.content ?? (job.formatted_content?.anzeige ? job.formatted_content : null);

  // Die Stelle so, wie Recruiter sie aus recruiter_jobs_view bekommen.
  const recruiterJob = useMemo(() => {
    if (!inhalt) return null;
    const satz = job.employment_type === 'freelance' ? recruiterTagessatz(spanne(job.day_rate_min, job.day_rate_max), mandate) : null;
    return {
      ...job,
      formatted_content: inhalt,
      company_name: null,
      ...(satz ? { day_rate_min: satz[0], day_rate_max: satz[1] } : {}),
    } as unknown as WorkspaceJob;
  }, [inhalt, job, mandate]);

  const posting = recruiterJob ? buildJobPosting(recruiterJob, { name: 'Name des Headhunters', email: 'aus seinem Profil' }) : null;
  const ansprache = recruiterJob && posting ? buildAnsprache(recruiterJob, posting, '') : null;

  const texte = textDerAnzeige(inhalt as never);
  const begriffe = entwurf?.pruefung?.begriffe ?? verboteneBegriffe(job.company_name, job.reveal_envelope?.red_list);
  const namen = namensFunde(texte, begriffe);
  const betraege = betragFunde(texte);
  const belege = entwurf?.pruefung?.ohneGrundlage;

  // Harte Sperre (Entscheidung 29.09.2026): „Firma anonym" ist das Versprechen
  // an den Kunden -- mit Firmenname im Text geht nichts live.
  const gesperrt = namen.length > 0;
  useEffect(() => { onSperre?.(gesperrt); }, [gesperrt, onSperre]);

  const speichern = async (content: Json) => {
    const pruefung = { ...(entwurf?.pruefung ?? {}), begriffe, bearbeitet: true };
    const { error } = await supabase.from('job_recruiter_text_drafts' as never)
      .upsert({ job_id: job.id, content, pruefung, updated_at: new Date().toISOString() } as never, { onConflict: 'job_id' });
    if (error) { setFehler(`Nicht gespeichert: ${error.message}`); return; }
    setze({ content, pruefung, created_at: entwurf?.created_at });
    setBearbeiten(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold">Anzeige für Recruiter</h4>
        <span className="text-xs text-muted-foreground">
          {laedt ? 'Wird geladen …'
            : erzeugt ? 'Wird erzeugt, dauert ein paar Sekunden …'
            : entwurf ? `Entwurf${entwurf.pruefung?.bearbeitet ? ' (bearbeitet)' : ''}${entwurf.created_at ? ` vom ${new Date(entwurf.created_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}` : ''}`
            : inhalt ? 'Veröffentlichte Fassung' : 'Noch keine Anzeige'}
        </span>
      </div>

      {erzeugt && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Die KI schreibt Anzeige und Kurzansprachen und prüft sie gegen die Angaben des Kunden.</p>}
      {fehler && <p role="alert" className="text-sm text-destructive">{fehler}</p>}

      {inhalt && !erzeugt && (
        <>
          <ul className="space-y-1 text-sm">
            <Pruefzeile ok={!namen.length} gut="Firmenname und Domain kommen nicht vor"
              schlecht={`Kommt vor: ${namen.join(', ')} – bitte entfernen. Bis dahin ist das Freigeben gesperrt.`} />
            <Pruefzeile ok={!betraege.length} gut="Beträge nur vom System, kein Budget und keine Marge"
              schlecht={`Betrag im Text: „${betraege[0]}“${betraege.length > 1 ? ` und ${betraege.length - 1} weitere` : ''}`} />
            {belege == null
              ? <li className="flex gap-2 text-muted-foreground"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Belegprüfung nicht gelaufen – bitte selbst lesen</li>
              : <Pruefzeile ok={!belege.length} gut="Alle Aussagen haben eine Grundlage in den Kundenangaben"
                  schlecht={`${belege.length} ${belege.length === 1 ? 'Satz' : 'Sätze'} ohne Grundlage in den Kundenangaben – prüfen: ${belege.map(b => `„${b}“`).join(' ')}`} />}
            {entwurf?.pruefung?.bearbeitet && belege != null && <li className="pl-6 text-xs text-muted-foreground">Belegprüfung: Stand beim Erzeugen, vor der Bearbeitung.</li>}
          </ul>

          {!bearbeiten && posting && ansprache && (
            <div className="space-y-2">
              <Aufklapper titel="Anzeige ansehen (so wie Recruiter sie sehen)">
                <div className="rounded-lg border border-border p-4"><AnzeigeAnsicht posting={posting} kompakt /></div>
              </Aufklapper>
              <Aufklapper titel="Kurzansprachen ansehen (LinkedIn · E-Mail · Telefon)">
                <div className="rounded-lg border border-border p-4"><AnspracheTeilen ansprache={ansprache} kanal={kanal} onKanal={setKanal} /></div>
              </Aufklapper>
            </div>
          )}

          {bearbeiten && <Editor content={inhalt} onAbbrechen={() => setBearbeiten(false)} onSpeichern={speichern} />}

          {!bearbeiten && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => void erzeugen()} className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" />Neu erzeugen</Button>
              <Button variant="outline" size="sm" onClick={() => setBearbeiten(true)} className="gap-1.5"><Pencil className="h-3.5 w-3.5" />Text bearbeiten</Button>
            </div>
          )}
        </>
      )}

      {!inhalt && !erzeugt && !laedt && (
        <Button variant="outline" size="sm" onClick={() => void erzeugen()} className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" />Anzeige erzeugen</Button>
      )}
    </div>
  );
}

function Pruefzeile({ ok, gut, schlecht }: { ok: boolean; gut: string; schlecht: string }) {
  return ok
    ? <li className="flex gap-2 text-emerald-600"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{gut}</li>
    : <li className="flex gap-2 text-amber-600"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{schlecht}</li>;
}

function Aufklapper({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex w-full items-center gap-2 text-left text-sm text-muted-foreground hover:text-foreground">
        <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />{titel}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}

const zeilen = (v: unknown) => (Array.isArray(v) ? v.join('\n') : '');
const liste = (v: string) => v.split('\n').map(s => s.trim()).filter(Boolean);

/** Satzweise ändern, Listen eine Zeile je Punkt. {VORNAME} und {VERGUETUNG} bleiben Platzhalter. */
function Editor({ content, onAbbrechen, onSpeichern }: { content: Json; onAbbrechen: () => void; onSpeichern: (c: Json) => void }) {
  const a: Anzeige = content.anzeige ?? {};
  const s: Ansprache = content.ansprache ?? {};
  const [f, setF] = useState<Record<string, string>>({
    einleitung: a.einleitung ?? '', unternehmen: a.unternehmen ?? '', aufgaben: zeilen(a.aufgaben),
    arbeitsalltag: a.arbeitsalltag ?? '', profil_zwingend: zeilen(a.profil_zwingend), profil_vorteil: zeilen(a.profil_vorteil),
    angebot: zeilen(a.angebot), team: a.team ?? '', ablauf: zeilen(a.ablauf),
    linkedin: s.linkedin ?? '', email_betreff: s.email_betreff ?? '', email_text: s.email_text ?? '',
    einstieg: s.telefon?.einstieg ?? '', argumente: zeilen(s.telefon?.argumente), fragen: zeilen(s.telefon?.fragen),
  });
  const feld = (key: string, label: string, mehrzeilig = true, hilfe?: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}{hilfe && <span className="ml-1 font-normal text-muted-foreground">{hilfe}</span>}</Label>
      {mehrzeilig
        ? <Textarea rows={3} value={f[key]} onChange={e => setF({ ...f, [key]: e.target.value })} />
        : <Input value={f[key]} onChange={e => setF({ ...f, [key]: e.target.value })} />}
    </div>
  );
  const speichern = () => onSpeichern({
    ...content,
    anzeige: {
      einleitung: f.einleitung, unternehmen: f.unternehmen, aufgaben: liste(f.aufgaben), arbeitsalltag: f.arbeitsalltag,
      profil_zwingend: liste(f.profil_zwingend), profil_vorteil: liste(f.profil_vorteil), angebot: liste(f.angebot),
      team: f.team, ablauf: liste(f.ablauf),
    },
    ansprache: {
      linkedin: f.linkedin, email_betreff: f.email_betreff, email_text: f.email_text,
      telefon: { einstieg: f.einstieg, argumente: liste(f.argumente), fragen: liste(f.fragen) },
    },
  });
  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">Listen: ein Punkt je Zeile. {'{VORNAME}'} und {'{VERGUETUNG}'} stehen lassen – die setzt das System ein. Angaben des Kunden (z. B. Muss-Kriterien) haben in der Anzeige Vorrang vor diesen Texten.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {feld('einleitung', 'Worum es geht')}
        {feld('unternehmen', 'Das Unternehmen', true, '(anonym)')}
        {feld('aufgaben', 'Deine Aufgaben')}
        {feld('arbeitsalltag', 'Arbeitsalltag')}
        {feld('profil_zwingend', 'Zwingend')}
        {feld('profil_vorteil', 'Von Vorteil')}
        {feld('angebot', 'Das bietet die Stelle')}
        {feld('team', 'Team & Zusammenarbeit')}
        {feld('ablauf', 'So läuft es ab')}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {feld('linkedin', 'LinkedIn', true, '(max. 300 Zeichen)')}
        {feld('email_betreff', 'E-Mail-Betreff', false)}
        {feld('email_text', 'E-Mail-Text')}
        {feld('einstieg', 'Telefon: Einstieg')}
        {feld('argumente', 'Telefon: Argumente')}
        {feld('fragen', 'Telefon: Fragen zur Passung')}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onAbbrechen}>Abbrechen</Button>
        <Button size="sm" onClick={speichern}>Entwurf speichern</Button>
      </div>
    </div>
  );
}
