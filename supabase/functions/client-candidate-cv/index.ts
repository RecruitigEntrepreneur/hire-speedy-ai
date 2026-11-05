// Original-Lebenslauf für den Kunden – erst nach der Interview-Zusage.
//
// Der Speicher cv-documents ist für Kunden gesperrt (20261014120000). Diese
// Function prüft das Recht und gibt einen Link, der eine Stunde gilt und bei
// jedem Klick neu entsteht. Der Headhunter sieht im Verlauf, wann der Kunde
// den Lebenslauf geladen hat.
//
//   POST { submissionId } → { url, fileName, stand, expiresIn }
//
// Erlaubt: Kundenteam der Stelle (can_access_job) nach identity_unlocked,
// der eigene Headhunter und Admins immer.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { fail, json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { authUser, interviewFailure } from '../_shared/interview-service.ts';

const UUID = /^[0-9a-f-]{36}$/i;
const CV_FILE = /\.(pdf|docx?)$/i;
const LINK_SECONDS = 3600;

type Doc = { id: string; candidate_id: string; file_name: string; file_url: string; created_at: string; confirmed_current_at?: string | null };

const storagePath = (fileUrl: string): string | null => {
  const part = fileUrl.split('/cv-documents/')[1];
  return part ? decodeURIComponent(part.split('?')[0]) : null;
};

const standOf = (d: Doc) =>
  d.confirmed_current_at && d.confirmed_current_at > d.created_at ? d.confirmed_current_at : d.created_at;

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    if (req.method !== 'POST') return fail('invalid_request', 'Bitte POST verwenden.');
    const body = await req.json().catch(() => ({}));
    const submissionId = body?.submissionId;
    if (typeof submissionId !== 'string' || !UUID.test(submissionId)) return fail('invalid_request', 'Ungültige Bewerbung.');

    const user = await authUser(req);
    const db = serviceClient();

    // select('*'): cv_document_id fehlt, solange die Migration nicht angewandt ist
    const { data: sub } = await db.from('submissions').select('*').eq('id', submissionId).maybeSingle();
    if (!sub) return fail('not_found', 'Bewerbung nicht gefunden.');

    const [{ data: isAdmin }, { data: canSee }] = await Promise.all([
      db.rpc('has_role', { _user_id: user.id, _role: 'admin' }),
      db.rpc('can_access_job', { _job_id: sub.job_id, _user_id: user.id }),
    ]);
    const own = sub.recruiter_id === user.id;
    if (!own && !isAdmin && !canSee) return fail('not_allowed', 'Keine Berechtigung für diese Bewerbung.');
    if (!own && !isAdmin && !sub.identity_unlocked) {
      return fail('not_allowed', 'Der Lebenslauf wird mit der Interview-Zusage freigeschaltet.');
    }

    // Aktuelle Version; gibt es keine mehr, die eingereichte
    const cols = '*';
    const { data: current } = await db.from('candidate_documents').select(cols)
      .eq('candidate_id', sub.candidate_id).eq('document_type', 'cv').eq('is_current', true)
      .order('created_at', { ascending: false }).limit(5);
    let doc = ((current ?? []) as Doc[]).find((d) => CV_FILE.test(d.file_name)) ?? null;
    if (!doc && sub.cv_document_id) {
      const { data } = await db.from('candidate_documents').select(cols).eq('id', sub.cv_document_id).maybeSingle();
      doc = (data as Doc | null) ?? null;
    }
    if (!doc || doc.candidate_id !== sub.candidate_id) return fail('not_found', 'Zu diesem Kandidaten liegt kein Lebenslauf vor.');

    const path = storagePath(doc.file_url);
    if (!path) return fail('not_found', 'Die Lebenslauf-Datei wurde nicht gefunden.');
    const { data: signed, error } = await db.storage.from('cv-documents').createSignedUrl(path, LINK_SECONDS, { download: doc.file_name });
    if (error || !signed?.signedUrl) return fail('upstream_error', 'Der Link zum Lebenslauf konnte nicht erstellt werden.');

    if (!own && !isAdmin) {
      await db.from('candidate_activity_log').insert({
        candidate_id: sub.candidate_id, recruiter_id: sub.recruiter_id, activity_type: 'note',
        title: 'Kunde hat den Lebenslauf geladen', description: doc.file_name,
        metadata: { kind: 'client_cv_download', document_id: doc.id, user_id: user.id },
        related_submission_id: sub.id,
      }).then(() => undefined, () => undefined);
    }

    return json({ url: signed.signedUrl, fileName: doc.file_name, stand: standOf(doc), expiresIn: LINK_SECONDS });
  } catch (e) {
    return interviewFailure(e);
  }
});
