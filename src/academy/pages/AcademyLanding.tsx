import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AcademyLayout } from '../components/AcademyLayout';
import { AUSBILDUNG_SLUG } from '../lib/ausbildung';

const db = supabase as unknown as { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

interface PublicModule { id: string; title: string; description: string; sort_order: number; lessons: { title: string; sort_order: number }[] }

/** Öffentlicher Lehrplan (veröffentlichte Module und Themen sind auch ohne Login lesbar). */
function useLehrplan() {
  return useQuery({
    queryKey: ['academy', 'lehrplan'],
    queryFn: async (): Promise<PublicModule[]> => {
      const { data: course } = await db.from('academy_courses').select('id').eq('slug', AUSBILDUNG_SLUG).eq('published', true).maybeSingle();
      if (!course) return [];
      const { data: modules } = await db.from('academy_modules').select('id,title,description,sort_order')
        .eq('course_id', course.id).order('sort_order', { ascending: true });
      const ids = (modules ?? []).map((m: { id: string }) => m.id);
      const { data: lessons } = ids.length
        ? await db.from('academy_lessons').select('module_id,title,sort_order').in('module_id', ids).order('sort_order', { ascending: true })
        : { data: [] };
      return (modules ?? []).map((m: PublicModule & { id: string }) => ({
        ...m,
        lessons: (lessons ?? []).filter((l: { module_id: string }) => l.module_id === m.id),
      }));
    },
  });
}

const STEPS = [
  ['Lernen', '8 Module mit je 3 Themen, kurz und praxisnah'],
  ['Abfragen', 'nach jedem Thema, sofort mit Begründung'],
  ['Modul-Tests', 'das nächste Modul öffnet erst nach Bestehen'],
  ['Zulassung', 'Arbeitsprobe und Live-Prüfung mit zwei Prüfern'],
  ['Matchunt', 'nach Vertrag und Freischaltung echte Stellen'],
];

export default function AcademyLanding() {
  const { data: modules, isLoading } = useLehrplan();

  return (
    <AcademyLayout>
      <section className="mx-auto max-w-4xl px-5 pb-12 pt-20 text-center">
        <p className="eyebrow mb-4">Ausbildung zum Headhunter</p>
        <h1 className="font-display text-4xl leading-tight sm:text-6xl">
          Werde Headhunter auf <span className="text-gold italic-display">Matchunt</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-[hsl(36_10%_80%)]">
          Du lernst das Handwerk Schritt für Schritt, wir fragen jedes Thema ab und testen jedes Modul.
          Wer am Ende die Zulassung besteht, arbeitet an echten Stellen auf Matchunt.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/auth?mode=signup" className="btn-gold inline-flex items-center gap-1 px-6 py-3">Registrieren <ArrowRight className="h-4 w-4" /></Link>
          <a href="#lehrplan" className="btn-ghost-acad px-6 py-3">Lehrplan ansehen</a>
        </div>
      </section>

      <section id="ablauf" className="mx-auto max-w-6xl px-5">
        <p className="eyebrow mb-3">So läuft es</p>
        <div className="grid gap-3 sm:grid-cols-5">
          {STEPS.map(([t, s], i) => (
            <div key={t} className="acad-panel p-4">
              <div className="course-index text-3xl">{i + 1}</div>
              <div className="mt-2 font-medium">{t}</div>
              <p className="mt-1 text-sm text-[hsl(36_9%_72%)]">{s}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="lehrplan" className="mx-auto mt-14 max-w-4xl px-5">
        <p className="eyebrow mb-3">Lehrplan</p>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[hsl(40_8%_60%)]" /></div>
        ) : modules && modules.length ? (
          <div className="acad-panel divide-y divide-[hsl(40_30%_90%/0.06)] px-5">
            {modules.map((m) => (
              <div key={m.id} className="grid grid-cols-[2.25rem_1fr] gap-3 py-4">
                <span className="font-display text-2xl text-[hsl(var(--acad-gold-soft))]">{m.sort_order}</span>
                <span>
                  <span className="font-medium">{m.title}</span>
                  <span className="mt-0.5 block text-sm text-[hsl(36_9%_70%)]">{m.lessons.map((l) => l.title).join(' · ')}</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[hsl(36_9%_72%)]">Der Lehrplan wird gerade veröffentlicht.</p>
        )}
      </section>

      <section className="mx-auto mt-10 grid max-w-4xl gap-4 px-5 md:grid-cols-2">
        <div className="acad-panel p-5">
          <p className="font-medium">Passt zu dir, wenn</p>
          <ul className="mt-2 space-y-1.5 text-sm text-[hsl(36_10%_80%)]">
            {['du deine Branche kennst und gern telefonierst', 'du Absagen aushältst und dranbleibst', 'du 8–10 Stunden pro Woche hast'].map((t) => (
              <li key={t} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald" />{t}</li>
            ))}
          </ul>
        </div>
        <div className="acad-panel p-5">
          <p className="font-medium">Was wir nicht versprechen</p>
          <p className="mt-2 text-sm text-[hsl(36_10%_80%)]">
            Das Bestehen begründet keinen Anspruch auf Stellen oder Aufträge, und niemand kann dir ein Einkommen zusagen.
            Das erste Honorar kommt oft erst Monate nach einer Zusage, weil Kündigungsfristen laufen.
          </p>
        </div>
      </section>
    </AcademyLayout>
  );
}
