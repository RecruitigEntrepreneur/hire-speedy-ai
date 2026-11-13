// Sprache der Person im Profil: gilt geräteübergreifend und für E-Mails.
// Die Spalte profiles.language kommt mit der Migration 20261112120000; solange
// sie fehlt, scheitern Lesen und Schreiben still und es gilt die Wahl im Browser.
import { supabase } from '@/integrations/supabase/client';
import { applyProfileLanguage, currentLanguage, onLanguageChoice } from './index';
import type { LanguageCode } from './languages';

let userId: string | null = null;

const save = (code: LanguageCode) => {
  if (!userId) return;
  void supabase.from('profiles').update({ language: code } as never).eq('user_id', userId).then(() => undefined, () => undefined);
};

supabase.auth.onAuthStateChange((_event, session) => {
  const id = session?.user?.id ?? null;
  if (id === userId) return;
  userId = id;
  if (!id) return;
  // Nicht im Callback selbst abfragen: supabase-js hält dort eine Sperre.
  setTimeout(async () => {
    const { data, error } = await supabase.from('profiles').select('language' as '*').eq('user_id', id).maybeSingle();
    if (error || userId !== id) return;
    const stored = (data as { language?: string | null } | null)?.language ?? null;
    if (stored) await applyProfileLanguage(stored);
    if (stored !== currentLanguage()) save(currentLanguage());
  }, 0);
});

onLanguageChoice(save);
