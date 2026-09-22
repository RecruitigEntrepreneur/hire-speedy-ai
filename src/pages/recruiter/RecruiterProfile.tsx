import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Briefcase, Camera, Check, CheckCircle2, Clock, Download, ExternalLink, FileCheck2, Info, Linkedin, Loader2, Lock, Paperclip, Pencil, Receipt, Save, Target, Upload, User, type LucideIcon } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { onboardingApi, stateLabels, type StoredOnboarding } from '@/lib/recruiterOnboardingApi';
import { contractSuggestion, startSteps } from '@/lib/recruiterStart';
import {
  COMPANY_TYPES, EXPERIENCE_BANDS, EXPERTISE_AREAS, EXPERTISE_LEVELS, LANGUAGES, METHODS, PARALLEL_BANDS, PLACEMENT_BANDS, REGIONS,
  cleanExpertise, expertiseIssues, type RecruiterExpertise,
} from '../../../supabase/functions/_shared/recruiter-expertise';
import { bicValid, cleanBilling, ibanValid, maskIban, type Billing } from '../../../supabase/functions/_shared/recruiter-billing';
import {
  EVIDENCE, EVIDENCE_MAX_BYTES, EVIDENCE_TYPES, INCOME_OPTIONS, evidencePath, evidencePlan, evidenceState, latestByKind, openEvidence,
  type EvidenceKind, type EvidenceRow, type IncomeDeclaration,
} from '../../../supabase/functions/_shared/recruiter-evidence';
import { expertiseLine, type PartnerStatusRow } from '../../../supabase/functions/_shared/recruiter-partner';
import { PartnerCard } from '@/components/recruiter/partner/PartnerCard';
import { PartnerStatusSection } from '@/components/recruiter/partner/PartnerStatusSection';

/**
 * Profil des Headhunters (Mischung aus Vorschlag 1 und 3, freigegeben 22.09.2026):
 * gruppiertes Menü, eine Übersicht mit Karte und „Als Nächstes“, Unterseiten erst
 * zum Lesen, „Bearbeiten“ öffnet das Formular. Angaben aus dem unterschriebenen
 * Vertrag sind eingefroren und tragen ein Schloss; die aktuellen Schwerpunkte
 * pflegt der Headhunter selbst. Abrechnung und Nachweise laufen über den Server,
 * der Matchunt jede Änderung meldet. Partnerstatus (Etappe 3) erscheint im Menü erst,
 * wenn es ihn gibt: ab Vertrag 2.1. Team folgt.
 */
type SectionId = 'uebersicht' | 'ueber-dich' | 'schwerpunkte' | 'partnerstatus' | 'abrechnung' | 'vertrag' | 'nachweise';
/** Reiter oben (Entscheidung 22.09.2026 statt der Liste rechts): Reihenfolge wie beim Durcharbeiten. */
const MENU: { id: SectionId; label: string }[] = [
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'ueber-dich', label: 'Über dich' },
  { id: 'schwerpunkte', label: 'Schwerpunkte' },
  { id: 'partnerstatus', label: 'Partnerstatus' },
  { id: 'abrechnung', label: 'Abrechnung' },
  { id: 'vertrag', label: 'Vertrag' },
  { id: 'nachweise', label: 'Nachweise' },
];
const pathOf = (id: SectionId) => (id === 'uebersicht' ? '/recruiter/profile' : `/recruiter/profile/${id}`);
const TAX_STATUS: Record<string, string> = { regular: 'Regelbesteuerung', small_business: 'Kleinunternehmerregelung', foreign: 'Ausländischer Steuerstatus' };
const AVATAR_BUCKET = 'recruiter-avatars';
const EVIDENCE_BUCKET = 'recruiter-evidence';
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface About { full_name: string; phone: string; role_title: string; years_experience: string; linkedin_url: string }
const emptyAbout: About = { full_name: '', phone: '', role_title: '', years_experience: '', linkedin_url: '' };
type Status = { kind: 'done' } | { kind: 'open'; count: number } | { kind: 'none' };
interface Task { id: string; title: string; why: string; action: string; tag: string; to: string }

const formatIban = (value: string) => value.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' });
const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';
const toggleIn = (list: string[], value: string) => (list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
const linkOf = (value: string) => (/^https?:\/\//.test(value) ? value : `https://${value}`);
const text = (value: unknown) => (typeof value === 'string' ? value : '');

/** Reiter unter dem Profilkopf; auf dem Handy wischt man seitlich. Offenes zeigt eine Zahl. */
function ProfileTabs({ items, active, status }: { items: typeof MENU; active: SectionId; status: Record<SectionId, Status> }) {
  const activeRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => { activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [active]);
  return <nav aria-label="Profilbereiche" className="overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    <div className="flex min-w-max gap-1">
      {items.map(m => {
        const s = status[m.id];
        return <NavLink key={m.id} to={pathOf(m.id)} end ref={m.id === active ? activeRef : undefined}
          className={({ isActive }) => cn('relative flex items-center gap-1.5 whitespace-nowrap px-3 pb-3 pt-1 text-sm transition-colors',
            isActive ? 'font-medium text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-foreground' : 'text-muted-foreground hover:text-foreground')}>
          {m.label}
          {m.id !== 'uebersicht' && s.kind === 'open' && <span className="rounded-full bg-warning/15 px-1.5 text-[11px] font-medium leading-5 text-warning" aria-label={`${s.count} offen`}>{s.count}</span>}
        </NavLink>;
      })}
    </div>
  </nav>;
}

function Panel({ title, icon: Icon, action, children }: { title: string; icon: LucideIcon; action?: ReactNode; children: ReactNode }) {
  return <Card>
    <CardContent className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Icon className="h-5 w-5"/>{title}</h2>
        {action}
      </div>
      {children}
    </CardContent>
  </Card>;
}

/** Eine Angabe zum Lesen; `locked` = aus dem unterschriebenen Vertrag, `required` = fehlt sie, ist etwas offen. */
function Fact({ label, value, locked, missing, required }: { label: string; value?: ReactNode; locked?: boolean; missing?: string; required?: boolean }) {
  return <Fragment>
    <dt className="flex items-center gap-1 text-sm text-muted-foreground">{locked && <Lock className="h-3 w-3" aria-label="aus dem Vertrag"/>}{label}</dt>
    <dd className="text-sm">{value || <span className={required ? 'text-warning' : 'text-muted-foreground'}>{missing ?? '—'}</span>}</dd>
  </Fragment>;
}

function Field({ id, label, children, hint }: { id: string; label: string; children: ReactNode; hint?: string }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>;
}

function Chips({ options, value, onToggle }: { options: string[]; value: string[]; onToggle: (value: string) => void }) {
  return <div className="flex flex-wrap gap-1.5">{options.map(option => <button key={option} type="button" aria-pressed={value.includes(option)} onClick={() => onToggle(option)}
    className={cn('rounded-full border px-2.5 py-1 text-xs', value.includes(option) ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}>{option}</button>)}</div>;
}

function Avatar({ url, name, size = 'h-12 w-12' }: { url: string | null; name: string; size?: string }) {
  return url
    ? <img src={url} alt="" className={cn(size, 'shrink-0 rounded-full object-cover')}/>
    : <div className={cn(size, 'flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary')}>{initials(name)}</div>;
}

export default function RecruiterProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { section } = useParams();
  const photoInput = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<Record<string, unknown>>({});
  const [saved, setSaved] = useState<{ about: About; billing: Billing }>({ about: emptyAbout, billing: cleanBilling({}) });
  const [about, setAbout] = useState<About>(emptyAbout);
  const [billing, setBilling] = useState<Billing>(cleanBilling({}));
  const [expertise, setExpertise] = useState<RecruiterExpertise>(cleanExpertise({}));
  const [editing, setEditing] = useState<'' | 'about' | 'billing' | 'expertise'>('');
  const [onboarding, setOnboarding] = useState<StoredOnboarding | null>(null);
  const [caseFailed, setCaseFailed] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [evidenceReady, setEvidenceReady] = useState(false);
  const [partner, setPartner] = useState<PartnerStatusRow | null>(null);
  const [upload, setUpload] = useState<{ kind: EvidenceKind; file: File | null; until: string } | null>(null);
  const [income, setIncome] = useState<IncomeDeclaration | null>(null);
  const [fromContract, setFromContract] = useState(false);
  const [busy, setBusy] = useState('');
  const [formError, setFormError] = useState('');
  const userId = user?.id;
  // Partnerstatus nur im Menü, wenn es ihn gibt (Vertrag ab 2.1, Migration angestoßen).
  const menu = MENU.filter(m => m.id !== 'partnerstatus' || partner);
  const active: SectionId = menu.some(m => m.id === section) ? section as SectionId : 'uebersicht';

  const loadEvidence = useCallback(async (id: string) => {
    const { data, error } = await supabase.from('recruiter_evidence' as never).select('*').eq('recruiter_id', id).order('uploaded_at', { ascending: false });
    // Fehlt die Tabelle noch (Migration nicht angestoßen), bleibt der Bereich leer statt kaputt.
    setEvidenceReady(!error);
    setEvidence(error ? [] : (data ?? []) as unknown as EvidenceRow[]);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void (async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
      let found: StoredOnboarding | null = null;
      try { found = (await onboardingApi<{ onboarding: StoredOnboarding | null }>(false, { action: 'resume' })).onboarding; }
      catch { if (active) setCaseFailed(true); }
      await loadEvidence(userId);
      // Fehlt die Tabelle noch, gibt es eben keinen Partnerstatus; der Rest der Seite läuft weiter.
      const { data: partnerRow, error: partnerError } = await supabase.from('recruiter_partner_status' as never).select('*').eq('user_id', userId).maybeSingle();
      const profile = (data ?? {}) as Record<string, unknown>;
      const avatarPath = text(profile.avatar_path);
      const signed = avatarPath ? (await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(avatarPath, 3600)).data?.signedUrl ?? null : null;
      if (!active) return;
      setRow(profile);
      setAvatarUrl(signed);
      setSaved({
        about: { full_name: text(profile.full_name), phone: text(profile.phone), role_title: text(profile.role_title), years_experience: profile.years_experience ? String(profile.years_experience) : '', linkedin_url: text(profile.linkedin_url) },
        billing: cleanBilling(profile),
      });
      setOnboarding(found);
      setPartner(partnerError ? null : (partnerRow as unknown as PartnerStatusRow | null));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [userId, loadEvidence]);

  // Alte Links (#firmendaten, #bankverbindung) und unbekannte Bereiche landen am richtigen Ort.
  useEffect(() => {
    const hash = location.hash.slice(1);
    if (!section && (hash === 'firmendaten' || hash === 'bankverbindung' || hash === 'abrechnung')) navigate(`/recruiter/profile/abrechnung${hash === 'abrechnung' ? '' : `#${hash}`}`, { replace: true });
    else if (section && !MENU.some(m => m.id === section)) navigate('/recruiter/profile', { replace: true });
    else if (!loading && section === 'partnerstatus' && !partner) navigate('/recruiter/profile', { replace: true });
  }, [section, location.hash, navigate, loading, partner]);

  const p = onboarding?.profile;
  const contractExpertise = p ? cleanExpertise(p.expertise) : null;
  // Aktuelle Schwerpunkte pflegt der Headhunter selbst; bis dahin gilt der Stand aus dem Vertrag.
  const currentExpertise = row.recruiter_expertise ? cleanExpertise(row.recruiter_expertise) : contractExpertise;

  // LinkedIn steht oft nur im Vertrag: im Formular vorbelegen, damit Anzeige und Formular übereinstimmen.
  const startAbout = () => { setAbout({ ...saved.about, linkedin_url: saved.about.linkedin_url || contractExpertise?.linkedin.trim() || '' }); setFormError(''); setEditing('about'); };
  const startExpertise = () => { setExpertise(currentExpertise ?? cleanExpertise({})); setFormError(''); setEditing('expertise'); };
  // Leere Firmendaten schlägt der unterschriebene Vertrag vor; gespeichert wird erst mit „Speichern“.
  const startBilling = () => {
    const suggestion = p ? contractSuggestion(saved.billing, p) : null;
    setBilling({ ...saved.billing, ...suggestion, bank_iban: formatIban(saved.billing.bank_iban) });
    setFromContract(!!suggestion); setFormError(''); setEditing('billing');
  };
  // Beim Wechsel des Bereichs das Formular schließen. Steht vor dem Sprung unten, damit der gewinnt.
  useEffect(() => { setEditing(''); setUpload(null); setIncome(null); }, [active]);
  // Aus dem Startkasten oder von „Als Nächstes“: Abrechnung gleich zum Ausfüllen öffnen.
  useEffect(() => {
    const hash = location.hash.slice(1);
    if (loading || active !== 'abrechnung' || (hash !== 'firmendaten' && hash !== 'bankverbindung')) return;
    startBilling();
    window.setTimeout(() => {
      const el = document.getElementById(hash === 'bankverbindung' ? 'bank_iban' : 'company_name') as HTMLInputElement | null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); el?.focus();
    }, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Ankommen mit Sprungmarke
  }, [loading, active, location.hash]);

  const fail = (title: string) => toast({ title, variant: 'destructive' });
  const focusBilling = (field: 'bank_iban' | 'company_name' | 'company_address' | 'tax_id') => {
    startBilling();
    window.setTimeout(() => { const el = document.getElementById(field) as HTMLInputElement | null; el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); el?.focus(); }, 50);
  };

  const saveAbout = async () => {
    if (!userId) return;
    const years = about.years_experience.trim() === '' ? null : Number(about.years_experience);
    if (!about.full_name.trim()) { setFormError('Bitte gib deinen Namen an.'); return; }
    if (years !== null && (!Number.isInteger(years) || years < 0 || years > 60)) { setFormError('Erfahrung bitte als ganze Zahl in Jahren.'); return; }
    const linkedin = about.linkedin_url.trim().replace(/^https?:\/\/(www\.)?/, '');
    if (linkedin && !/^linkedin\.com\/(in|company)\/[^\s/]+/i.test(linkedin)) { setFormError('Bitte gib deinen LinkedIn-Link an, etwa linkedin.com/in/dein-name.'); return; }
    setBusy('about'); setFormError('');
    const next: About = { full_name: about.full_name.trim(), phone: about.phone.trim(), role_title: about.role_title.trim(), years_experience: years ? String(years) : '', linkedin_url: linkedin };
    const { error } = await supabase.from('profiles')
      .update({ full_name: next.full_name, phone: next.phone || null, role_title: next.role_title || null, years_experience: years, linkedin_url: next.linkedin_url || null } as never).eq('user_id', userId);
    setBusy('');
    if (error) { setFormError('Konnte nicht gespeichert werden. Bitte versuch es noch einmal.'); return; }
    setSaved(prev => ({ ...prev, about: next })); setEditing('');
    toast({ title: 'Gespeichert' });
  };

  const uploadPhoto = async (file: File | undefined) => {
    if (!file || !userId) return;
    if (!AVATAR_TYPES.includes(file.type)) { fail('Bitte ein Foto als JPG, PNG oder WebP wählen.'); return; }
    if (file.size > 5 * 1024 * 1024) { fail('Das Foto ist größer als 5 MB.'); return; }
    setBusy('photo');
    const path = `${userId}/avatar-${Date.now()}.${file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'}`;
    const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, { contentType: file.type });
    const { error: saveError } = error ? { error } : await supabase.from('profiles').update({ avatar_path: path } as never).eq('user_id', userId);
    if (error || saveError) { setBusy(''); fail('Das Foto konnte nicht gespeichert werden.'); return; }
    const old = text(row.avatar_path);
    if (old) void supabase.storage.from(AVATAR_BUCKET).remove([old]);
    const signed = (await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, 3600)).data?.signedUrl ?? null;
    setRow(prev => ({ ...prev, avatar_path: path })); setAvatarUrl(signed); setBusy('');
    toast({ title: 'Foto gespeichert' });
  };
  const removePhoto = async () => {
    const old = text(row.avatar_path);
    if (!old || !userId) return;
    setBusy('photo');
    const { error } = await supabase.from('profiles').update({ avatar_path: null } as never).eq('user_id', userId);
    if (!error) void supabase.storage.from(AVATAR_BUCKET).remove([old]);
    setBusy('');
    if (error) { fail('Das Foto konnte nicht entfernt werden.'); return; }
    setRow(prev => ({ ...prev, avatar_path: null })); setAvatarUrl(null);
  };

  const saveExpertise = async () => {
    if (!userId) return;
    const clean = cleanExpertise(expertise);
    const issues = expertiseIssues(clean);
    if (issues.length) { setFormError(issues.join(' ')); return; }
    setBusy('expertise'); setFormError('');
    const { error } = await supabase.from('profiles').update({ recruiter_expertise: clean } as never).eq('user_id', userId);
    setBusy('');
    if (error) { setFormError('Konnte nicht gespeichert werden. Bitte versuch es noch einmal.'); return; }
    setRow(prev => ({ ...prev, recruiter_expertise: clean })); setEditing('');
    toast({ title: 'Schwerpunkte gespeichert' });
  };

  const saveBilling = async () => {
    const clean = cleanBilling(billing);
    if (!ibanValid(clean.bank_iban)) { setFormError('Die IBAN stimmt nicht. Bitte prüf sie noch einmal.'); return; }
    if (!bicValid(clean.bank_bic)) { setFormError('Der BIC stimmt nicht. Er hat 8 oder 11 Zeichen.'); return; }
    setBusy('billing'); setFormError('');
    try {
      const result = await onboardingApi<{ saved: boolean; changed: string[] }>(false, { action: 'billing', billing: clean });
      setSaved(prev => ({ ...prev, billing: clean })); setEditing('');
      toast({ title: result.changed.length ? 'Gespeichert. Matchunt ist informiert.' : 'Keine Änderungen.' });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Konnte nicht gespeichert werden.');
    } finally { setBusy(''); }
  };

  const openStored = async (bucket: string, path: string) => {
    // Fenster sofort öffnen, sonst blockt der Browser es nach der Anfrage.
    const win = window.open('', '_blank');
    if (win) win.opener = null;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
    if (error || !data?.signedUrl) { win?.close(); fail('Die Datei konnte nicht geöffnet werden.'); return; }
    if (win) win.location.href = data.signedUrl; else window.location.assign(data.signedUrl);
  };
  const openDocument = async (contractId: string, document: 'signed' | 'certificate') => {
    if (!onboarding) return;
    const win = window.open('', '_blank');
    if (win) win.opener = null;
    setBusy(document);
    try {
      const { url } = await onboardingApi<{ url: string }>(false, { action: 'document', case_id: onboarding.id, contract_id: contractId, document });
      if (win) win.location.href = url; else window.location.assign(url);
    } catch (e) {
      win?.close();
      fail(e instanceof Error ? e.message : 'Dokument nicht verfügbar.');
    } finally { setBusy(''); }
  };

  const submitUpload = async () => {
    if (!upload || !userId) return;
    const { kind, file, until } = upload;
    if (!file) { setFormError('Bitte wähle eine Datei.'); return; }
    if (!EVIDENCE_TYPES.includes(file.type)) { setFormError('Bitte als PDF, JPG oder PNG hochladen.'); return; }
    if (file.size > EVIDENCE_MAX_BYTES) { setFormError('Die Datei ist größer als 10 MB.'); return; }
    if (EVIDENCE[kind].expires && !until) { setFormError('Bitte gib an, bis wann der Nachweis gilt.'); return; }
    setBusy(`upload-${kind}`); setFormError('');
    try {
      const path = evidencePath(userId, kind, file.name);
      const { error } = await supabase.storage.from(EVIDENCE_BUCKET).upload(path, file, { contentType: file.type });
      if (error) throw new Error('Das Hochladen hat nicht geklappt. Bitte versuch es noch einmal.');
      await onboardingApi(false, { action: 'evidence-submit', kind, path, file_name: file.name, valid_until: until || undefined });
      await loadEvidence(userId);
      setUpload(null);
      toast({ title: 'Hochgeladen. Matchunt prüft den Nachweis.' });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Das Hochladen hat nicht geklappt.');
    } finally { setBusy(''); }
  };
  const declareIncome = async () => {
    if (!income || !userId) return;
    setBusy('income'); setFormError('');
    try {
      await onboardingApi(false, { action: 'income-declare', declaration: income });
      await loadEvidence(userId);
      setIncome(null);
      toast({ title: 'Erklärung gespeichert' });
    } catch (e) { setFormError(e instanceof Error ? e.message : 'Konnte nicht gespeichert werden.'); }
    finally { setBusy(''); }
  };

  if (loading) return <DashboardLayout><div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div></DashboardLayout>;

  const join = (values: string[]) => values.join(', ');
  const expertiseRows = currentExpertise ? ([
    ['Bereiche', join([...currentExpertise.areas, ...currentExpertise.extras])], ['Spezialisierung', join(currentExpertise.subareas)], ['Ebene', join(currentExpertise.levels)],
    ['Unternehmen', join(currentExpertise.companyTypes)], ['Regionen', join(currentExpertise.regions)], ['Sprachen', join(currentExpertise.languages)],
    ['Arbeitsweise', [join(currentExpertise.methods), currentExpertise.experience && `${currentExpertise.experience} Erfahrung`, currentExpertise.placements && `${currentExpertise.placements} Besetzungen im Jahr`, currentExpertise.parallel && `${currentExpertise.parallel} Suchen parallel`].filter(Boolean).join(' · ')],
  ] as [string, string][]).filter(([, value]) => value) : [];
  const searchProfile = currentExpertise ? [join([...currentExpertise.areas, ...currentExpertise.extras]), join(currentExpertise.levels), join(currentExpertise.regions), join(currentExpertise.languages)].filter(Boolean).join(' · ') : '';
  const linkedin = saved.about.linkedin_url || contractExpertise?.linkedin.trim() || '';
  const years = saved.about.years_experience && `${saved.about.years_experience} ${saved.about.years_experience === '1' ? 'Jahr' : 'Jahre'}`;
  const experience = years ? `${years} Erfahrung` : currentExpertise?.experience ? `${currentExpertise.experience} Erfahrung` : '';
  const contract = onboarding?.contracts.find(c => c.state === 'completed') ?? onboarding?.contracts.find(c => !['declined', 'voided'].includes(c.state));
  const contractDone = contract?.state === 'completed';
  const statusChip = !onboarding ? 'Freigeschaltet' + (caseFailed ? '' : ' · Altvertrag')
    : contractDone ? `Freigeschaltet · Rahmenvertrag ${contract.package_version}` : stateLabels[contract?.state ?? onboarding.state] ?? onboarding.state;

  const billingSteps = startSteps(saved.billing, true).filter(s => s.id === 'company' || s.id === 'bank');
  const openBilling = billingSteps.filter(s => !s.done);
  const partnerKind = onboarding?.kind ?? 'individual';
  const contractIncome = p?.contractDetails?.incomeConcentration?.trim() ?? '';
  const latest = latestByKind(evidence);
  const openProof = evidenceReady ? openEvidence(partnerKind, evidence, contractIncome) : [];
  const proofTitle = (kind: EvidenceKind) => {
    const state = evidenceState(latest[kind]);
    const label = EVIDENCE[kind].label;
    if (kind === 'income') return 'Erklärung zu deinen Einkünften abgeben';
    return state === 'rejected' ? `${label}: neue Datei hochladen` : state === 'expired' ? `${label} ist abgelaufen` : state === 'expiring' ? `${label} läuft bald ab` : `${label} hochladen`;
  };
  const tasks: Task[] = [
    ...openBilling.map(s => s.id === 'bank'
      ? { id: 'bankverbindung', title: 'Bankverbindung eintragen', why: 'Ohne Konto können wir deine erste Provision nicht überweisen.', action: 'Eintragen', tag: 'Auszahlung', to: '/recruiter/profile/abrechnung#bankverbindung' }
      : { id: 'firmendaten', title: 'Firmendaten ergänzen', why: 'Firma, Anschrift und Steuerangaben brauchen wir für deine Gutschriften.', action: 'Ergänzen', tag: 'Auszahlung', to: '/recruiter/profile/abrechnung#firmendaten' }),
    ...openProof.map(kind => ({ id: kind, title: proofTitle(kind), why: 'Verlangt dein Vertrag. Matchunt prüft jeden Nachweis.', action: kind === 'income' ? 'Abgeben' : 'Hochladen', tag: 'Vertrag', to: '/recruiter/profile/nachweise' })),
  ];
  const done = [contractDone && 'Vertrag', ...billingSteps.filter(s => s.done).map(s => s.id === 'bank' ? 'Bankverbindung' : 'Firmendaten'),
    expertiseRows.length > 0 && 'Schwerpunkte', evidenceReady && !openProof.length && 'Nachweise'].filter(Boolean) as string[];
  const status: Record<SectionId, Status> = {
    uebersicht: tasks.length ? { kind: 'open', count: tasks.length } : { kind: 'done' },
    'ueber-dich': saved.about.full_name.trim() ? { kind: 'done' } : { kind: 'open', count: 1 },
    schwerpunkte: expertiseRows.length ? { kind: 'done' } : { kind: 'none' },
    abrechnung: openBilling.length ? { kind: 'open', count: openBilling.length } : { kind: 'done' },
    vertrag: contractDone || (!onboarding && !caseFailed) ? { kind: 'done' } : { kind: 'none' },
    nachweise: !evidenceReady ? { kind: 'none' } : openProof.length ? { kind: 'open', count: openProof.length } : { kind: 'done' },
    partnerstatus: { kind: 'none' },
  };
  const taxLabel = p ? TAX_STATUS[p.taxStatus] : undefined;
  const creditNote = p?.contractDetails ? (p.contractDetails.creditNoteConsent ? 'Zugestimmt' : 'Nicht zugestimmt, Abrechnung auf deine Rechnung') : undefined;
  const setBill = (key: keyof Billing, value: string) => { setBilling(prev => ({ ...prev, [key]: value })); setFormError(''); };
  const errorLine = formError && <p role="alert" className="text-sm text-destructive">{formError}</p>;
  const saveButtons = (key: string, save: () => void) => <div className="flex gap-2">
    <Button onClick={save} disabled={busy === key}>{busy === key ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}Speichern</Button>
    <Button variant="ghost" onClick={() => { setEditing(''); setFormError(''); }}>Abbrechen</Button>
  </div>;
  const editButton = (key: typeof editing, start: () => void) => editing !== key && <Button variant="outline" size="sm" onClick={start}><Pencil className="mr-2 h-3.5 w-3.5"/>Bearbeiten</Button>;

  const header = <Card className="border-primary/30">
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-[240px] flex-1 items-center gap-3">
            <Avatar url={avatarUrl} name={saved.about.full_name}/>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold">{saved.about.full_name || 'Dein Profil'}</h1>
              <p className="text-sm text-muted-foreground">{[saved.about.role_title, saved.billing.company_name, onboarding ? (onboarding.kind === 'agency' ? 'Agentur' : 'Einzelrecruiter') : ''].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs text-success"><CheckCircle2 className="h-3.5 w-3.5"/>{statusChip}</span>
        </div>
        {(linkedin || experience) && <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {linkedin && <a className="inline-flex items-center gap-1.5 text-primary underline-offset-2 hover:underline" href={linkOf(linkedin)} target="_blank" rel="noreferrer"><Linkedin className="h-4 w-4"/>{linkedin.replace(/^https?:\/\/(www\.)?/, '')}</a>}
          {experience && <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Briefcase className="h-4 w-4"/>{experience}</span>}
        </div>}
        {searchProfile && <p className="text-sm">{searchProfile}</p>}
        {partner && !partner.ended_at && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-3">
            <PartnerCard tier={partner.tier} size="sm"/>
            <span className="text-sm text-muted-foreground">Nr. <span className="font-mono">{partner.partner_number}</span> · seit {new Date(partner.granted_at).toLocaleDateString('de-DE', { month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' })}</span>
          </div>
          {active !== 'partnerstatus' && <Button variant="outline" size="sm" onClick={() => navigate(pathOf('partnerstatus'))}>Partnerstatus<ArrowRight className="ml-1.5 h-3.5 w-3.5"/></Button>}
        </div>}
      </CardContent>
    </Card>;

  const overview = <Panel title="Als Nächstes" icon={CheckCircle2}>
      {tasks.length ? <ul className="divide-y divide-border">{tasks.map(t => <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
        <div>
          <p className="text-sm font-medium">{t.title} <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-normal text-primary">{t.tag}</span></p>
          <p className="text-xs text-muted-foreground">{t.why}</p>
        </div>
        <Button size="sm" onClick={() => navigate(t.to)}>{t.action}</Button>
      </li>)}</ul> : <p className="text-sm text-muted-foreground">Alles erledigt. Dein Profil ist vollständig.</p>}
      {done.length > 0 && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-success"/>Erledigt: {done.join(', ')}</p>}
    </Panel>;

  const linkedinFromContract = !saved.about.linkedin_url && !!linkedin;
  const aboutPanel = <Panel title="Über dich" icon={User} action={editButton('about', startAbout)}>
    <p className="text-sm text-muted-foreground">So sieht dich das Matchunt-Team. Kunden sehen dich nicht.</p>
    <div className="flex flex-wrap items-center gap-4">
      <Avatar url={avatarUrl} name={saved.about.full_name} size="h-16 w-16"/>
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={busy === 'photo'} onClick={() => photoInput.current?.click()}>{busy === 'photo' ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin"/> : <Camera className="mr-2 h-3.5 w-3.5"/>}{avatarUrl ? 'Foto ändern' : 'Foto hochladen'}</Button>
          {avatarUrl && <Button variant="ghost" size="sm" disabled={busy === 'photo'} onClick={() => void removePhoto()}>Entfernen</Button>}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG oder WebP, bis 5 MB. Sieht nur das Matchunt-Team.</p>
        <input ref={photoInput} type="file" accept={AVATAR_TYPES.join(',')} className="hidden" onChange={e => { void uploadPhoto(e.target.files?.[0]); e.target.value = ''; }}/>
      </div>
    </div>
    {editing === 'about' ? <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="full_name" label="Name"><Input id="full_name" value={about.full_name} onChange={e => setAbout({ ...about, full_name: e.target.value })}/></Field>
        <Field id="phone" label="Telefon"><Input id="phone" type="tel" value={about.phone} placeholder="Für Rückfragen" onChange={e => setAbout({ ...about, phone: e.target.value })}/></Field>
        <Field id="role_title" label="Position"><Input id="role_title" value={about.role_title} placeholder="z. B. Senior Consultant" onChange={e => setAbout({ ...about, role_title: e.target.value })}/></Field>
        <Field id="years_experience" label="Erfahrung in Jahren" hint={!about.years_experience && currentExpertise?.experience ? `In deinen Schwerpunkten steht: ${currentExpertise.experience}` : undefined}><Input id="years_experience" inputMode="numeric" value={about.years_experience} placeholder="z. B. 8" onChange={e => setAbout({ ...about, years_experience: e.target.value.replace(/[^\d]/g, '').slice(0, 2) })}/></Field>
      </div>
      <Field id="linkedin_url" label="LinkedIn"><Input id="linkedin_url" value={about.linkedin_url} placeholder="linkedin.com/in/dein-name" onChange={e => setAbout({ ...about, linkedin_url: e.target.value })}/></Field>
      {errorLine}
      {saveButtons('about', () => void saveAbout())}
    </> : <dl className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-6 gap-y-2">
      <Fact label="Name" value={saved.about.full_name} missing="fehlt" required/>
      <Fact label="Telefon" value={saved.about.phone} missing="noch nicht angegeben"/>
      <Fact label="Position" value={saved.about.role_title}/>
      <Fact label="Erfahrung" value={years || (currentExpertise?.experience && <>{currentExpertise.experience} <span className="text-muted-foreground">(laut Schwerpunkten)</span></>)}/>
      <Fact label="LinkedIn" value={linkedin && <><a className="text-primary underline-offset-2 hover:underline" href={linkOf(linkedin)} target="_blank" rel="noreferrer">{linkedin.replace(/^https?:\/\/(www\.)?/, '')}</a>{linkedinFromContract && <span className="text-muted-foreground"> (aus dem Vertrag)</span>}</>}/>
    </dl>}
  </Panel>;

  const x = expertise;
  const patch = (next: Partial<RecruiterExpertise>) => { setExpertise(prev => ({ ...prev, ...next })); setFormError(''); };
  const expertisePanel = <Panel title="Schwerpunkte" icon={Target} action={editButton('expertise', startExpertise)}>
    {editing === 'expertise' ? <div className="space-y-4">
      <div className="space-y-1.5"><p className="text-xs text-muted-foreground">Bereiche</p><Chips options={[...EXPERTISE_AREAS.map(a => a.label), ...x.extras]} value={[...x.areas, ...x.extras]} onToggle={v => x.extras.includes(v) ? patch({ extras: x.extras.filter(e => e !== v) }) : patch({ areas: toggleIn(x.areas, v) })}/></div>
      {EXPERTISE_AREAS.filter(a => x.areas.includes(a.label)).map(a => <div key={a.key} className="space-y-1.5"><p className="text-xs text-muted-foreground">↳ {a.label}</p><Chips options={a.sub} value={x.subareas} onToggle={v => patch({ subareas: toggleIn(x.subareas, v) })}/></div>)}
      <div className="space-y-1.5"><p className="text-xs text-muted-foreground">Ebene</p><Chips options={EXPERTISE_LEVELS} value={x.levels} onToggle={v => patch({ levels: toggleIn(x.levels, v) })}/></div>
      <div className="space-y-1.5"><p className="text-xs text-muted-foreground">Unternehmen</p><Chips options={COMPANY_TYPES} value={x.companyTypes} onToggle={v => patch({ companyTypes: toggleIn(x.companyTypes, v) })}/></div>
      <div className="space-y-1.5"><p className="text-xs text-muted-foreground">Regionen</p><Chips options={REGIONS} value={x.regions} onToggle={v => patch({ regions: toggleIn(x.regions, v) })}/></div>
      <div className="space-y-1.5"><p className="text-xs text-muted-foreground">Sprachen</p><Chips options={LANGUAGES} value={x.languages} onToggle={v => patch({ languages: toggleIn(x.languages, v) })}/></div>
      <div className="space-y-1.5"><p className="text-xs text-muted-foreground">Vorgehen</p><Chips options={METHODS} value={x.methods} onToggle={v => patch({ methods: toggleIn(x.methods, v) })}/></div>
      <div className="space-y-1.5"><p className="text-xs text-muted-foreground">Erfahrung als Headhunter</p><Chips options={EXPERIENCE_BANDS} value={[x.experience]} onToggle={v => patch({ experience: v })}/></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><p className="text-xs text-muted-foreground">Besetzungen im Jahr</p><Chips options={PLACEMENT_BANDS} value={[x.placements]} onToggle={v => patch({ placements: v })}/></div>
        <div className="space-y-1.5"><p className="text-xs text-muted-foreground">Suchen parallel</p><Chips options={PARALLEL_BANDS} value={[x.parallel]} onToggle={v => patch({ parallel: v })}/></div>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Info className="h-3.5 w-3.5"/>Dein Vertrag bleibt unverändert. Matchunt sieht deine aktuellen Schwerpunkte in der Recruiterverwaltung.</p>
      {errorLine}
      {saveButtons('expertise', () => void saveExpertise())}
    </div> : expertiseRows.length ? <>
      <dl className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-6 gap-y-2">{expertiseRows.map(([label, value]) => <Fact key={label} label={label} value={value}/>)}</dl>
      {!row.recruiter_expertise && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3 w-3"/>Stand aus deinem Onboarding. Über „Bearbeiten“ hältst du sie aktuell.</p>}
    </> : <p className="text-sm text-muted-foreground">{caseFailed ? 'Deine Schwerpunkte konnten gerade nicht geladen werden.' : 'Noch keine Schwerpunkte hinterlegt. Über „Bearbeiten“ legst du sie fest.'}</p>}
  </Panel>;

  const missingWith = (textValue: string, field: Parameters<typeof focusBilling>[0]) => <span className="inline-flex flex-wrap items-center gap-2">
    <span className="text-warning">{textValue}</span>
    <Button variant="outline" size="sm" className="h-7" onClick={() => focusBilling(field)}>Jetzt eintragen</Button>
  </span>;
  const billingPanel = <Panel title="Abrechnung" icon={Receipt} action={editButton('billing', startBilling)}>
    <p className="text-sm text-muted-foreground">Für deine Gutschriften und Auszahlungen. Änderungen gehen automatisch an Matchunt.</p>
    {editing === 'billing' ? <>
      {fromContract && <p className="flex items-center gap-2 text-sm text-success"><Info className="h-4 w-4 shrink-0"/>Aus deinem Vertrag übernommen. Bitte prüfen und speichern.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="company_name" label="Firma"><Input id="company_name" value={billing.company_name} onChange={e => setBill('company_name', e.target.value)}/></Field>
        <Field id="tax_id" label="USt-IdNr. / Steuernummer"><Input id="tax_id" value={billing.tax_id} onChange={e => setBill('tax_id', e.target.value)}/></Field>
      </div>
      <Field id="company_address" label="Anschrift"><Input id="company_address" value={billing.company_address} onChange={e => setBill('company_address', e.target.value)}/></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="bank_account_holder" label="Kontoinhaber"><Input id="bank_account_holder" value={billing.bank_account_holder} placeholder={billing.company_name || 'wie auf dem Konto'} onChange={e => setBill('bank_account_holder', e.target.value)}/></Field>
        <Field id="bank_iban" label="IBAN"><Input id="bank_iban" value={billing.bank_iban} placeholder="DE00 0000 0000 0000 0000 00" autoComplete="off" onChange={e => setBill('bank_iban', e.target.value.toUpperCase())} onBlur={() => setBill('bank_iban', formatIban(billing.bank_iban))}/></Field>
        <Field id="bank_bic" label="BIC" hint="Optional"><Input id="bank_bic" value={billing.bank_bic} autoComplete="off" onChange={e => setBill('bank_bic', e.target.value.toUpperCase())}/></Field>
      </div>
      {errorLine}
      {saveButtons('billing', () => void saveBilling())}
    </> : <dl className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-6 gap-y-2">
      <Fact label="Firma" value={saved.billing.company_name || missingWith('fehlt', 'company_name')}/>
      <Fact label="Anschrift" value={saved.billing.company_address || missingWith('fehlt', 'company_address')}/>
      <Fact label="USt-IdNr. / Steuernummer" value={saved.billing.tax_id || missingWith('fehlt', 'tax_id')}/>
      <Fact label="Auszahlungskonto" value={saved.billing.bank_iban ? [maskIban(saved.billing.bank_iban), saved.billing.bank_bic, saved.billing.bank_account_holder && `Inhaber: ${saved.billing.bank_account_holder}`].filter(Boolean).join(' · ') : missingWith('fehlt, für deine erste Provision', 'bank_iban')}/>
      {p?.legalForm && <Fact label="Rechtsform · Land" locked value={[p.legalForm, p.country].filter(Boolean).join(' · ')}/>}
      {taxLabel && <Fact label="Steuerstatus" locked value={taxLabel}/>}
      {creditNote && <Fact label="Gutschriftverfahren" locked value={creditNote}/>}
    </dl>}
    {editing !== 'billing' && p && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3 w-3"/>Aus deinem Vertrag. Für Änderungen antworte auf eine Mail von Matchunt.</p>}
  </Panel>;

  const contractPanel = <Panel title="Vertrag" icon={FileCheck2}>
    {caseFailed ? <p className="text-sm text-muted-foreground">Dein Vertrag konnte gerade nicht geladen werden. Lade die Seite bitte neu.</p>
      : !onboarding ? <p className="text-sm text-muted-foreground">Dein Vertrag stammt aus der Zeit vor Fassung 2.1. Den neuen Rahmenvertrag schicken wir dir gesondert zur Unterschrift.</p>
      : contract ? <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">Rahmenvertrag · Fassung {contract.package_version}</p>
          {contractDone && <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-xs text-success">Komplett</span>}
        </div>
        <p className="text-sm text-muted-foreground">{[contract.recruiter_signed_at && `Du: unterschrieben am ${day(contract.recruiter_signed_at)}`, contract.countersigned_at && `Matchunt: gegengezeichnet am ${day(contract.countersigned_at)}`].filter(Boolean).join(' · ') || stateLabels[contract.state]}</p>
        {contractDone && <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={busy === 'signed'} onClick={() => void openDocument(contract.id, 'signed')}>{busy === 'signed' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}Vertrag öffnen</Button>
          <Button variant="outline" size="sm" disabled={busy === 'certificate'} onClick={() => void openDocument(contract.id, 'certificate')}>Abschlusszertifikat</Button>
        </div>}
        <p className="text-xs text-muted-foreground">Enthalten: Rahmenvertrag und sechs Anlagen (Datenblatt, Konditionen, Plattformregeln, Datenschutz, Nutzungsbedingungen, Markenrichtlinie).</p>
      </> : <p className="text-sm text-muted-foreground">{stateLabels[onboarding.state] ?? onboarding.state}</p>}
  </Panel>;

  const plan = evidencePlan(partnerKind);
  // Links Text, rechts Status und Knöpfe; auf dem Handy untereinander.
  const ROW_INNER = 'grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center';
  const ROW = `${ROW_INNER} py-3`;
  const proofRow = (kind: EvidenceKind, required: boolean, applies: boolean) => {
    const meta = EVIDENCE[kind];
    const last = latest[kind];
    if (!applies) return <li key={kind} className={ROW}>
      <div><p className="text-sm">{meta.label}</p><p className="text-xs text-muted-foreground">Nur Agenturen</p></div>
      <span className="text-xs text-muted-foreground">entfällt für dich</span>
    </li>;
    if (kind === 'income') {
      const declared = last?.declaration as IncomeDeclaration | undefined;
      return <li key={kind} className="space-y-3 py-3">
        <div className={ROW_INNER}>
          <div className="min-w-0">
            <p className="text-sm">{meta.label}</p>
            <p className="text-xs text-muted-foreground">{declared ? `${INCOME_OPTIONS[declared]} · erklärt am ${day(last!.uploaded_at)}` : contractIncome ? <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3"/>Aus deinem Vertrag: {contractIncome}</span> : meta.hint}</p>
          </div>
          <div className="flex items-center gap-3 sm:justify-end">
            {declared || contractIncome ? <span className="text-xs text-success">bestätigt</span> : <span className="text-xs text-warning">fehlt</span>}
            {income === null && <Button variant="outline" size="sm" onClick={() => { setIncome(declared ?? 'below'); setFormError(''); }}>{declared || contractIncome ? 'Ändern' : 'Abgeben'}</Button>}
          </div>
        </div>
        {income !== null && <div className="space-y-3 rounded-lg bg-muted/40 p-3">
          <div className="flex flex-col gap-2">{(Object.keys(INCOME_OPTIONS) as IncomeDeclaration[]).map(option => <label key={option} className="flex items-center gap-2 text-sm">
            <input type="radio" name="income" checked={income === option} onChange={() => setIncome(option)}/>{INCOME_OPTIONS[option]}
          </label>)}</div>
          <p className="text-xs text-muted-foreground">Gemeint sind deine Einkünfte der letzten zwölf Monate. Ändert sich das, bestätige es hier neu.</p>
          {errorLine}
          <div className="flex gap-2"><Button size="sm" disabled={busy === 'income'} onClick={() => void declareIncome()}>{busy === 'income' && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin"/>}Bestätigen</Button><Button size="sm" variant="ghost" onClick={() => { setIncome(null); setFormError(''); }}>Abbrechen</Button></div>
        </div>}
      </li>;
    }
    const state = evidenceState(last);
    const statusText: Record<string, ReactNode> = {
      missing: required ? <span className="text-xs text-warning">fehlt</span> : <span className="text-xs text-muted-foreground">freiwillig</span>,
      pending: <span className="inline-flex items-center gap-1 text-xs text-warning"><Clock className="h-3 w-3"/>in Prüfung</span>,
      approved: <span className="inline-flex items-center gap-1 text-xs text-success"><Check className="h-3 w-3"/>geprüft{last?.reviewed_at ? ` am ${day(last.reviewed_at)}` : ''}</span>,
      rejected: <span className="text-xs text-destructive">abgelehnt</span>,
      expiring: <span className="text-xs text-warning">läuft am {last?.valid_until ? day(last.valid_until) : ''} ab</span>,
      expired: <span className="text-xs text-destructive">abgelaufen</span>,
    };
    const again = ['rejected', 'expiring', 'expired'].includes(state) || (state === 'approved' && meta.expires);
    const uploading = upload?.kind === kind;
    return <li key={kind} className="space-y-3 py-3">
      <div className={ROW_INNER}>
        <div className="min-w-0">
          <p className="text-sm">{meta.label}</p>
          <p className="text-xs text-muted-foreground">{[meta.hint, !required && kind === 'insurance' ? 'für Agenturen Pflicht, für dich freiwillig' : '', last?.valid_until && `gültig bis ${day(last.valid_until)}`].filter(Boolean).join(' · ')}</p>
          {state === 'rejected' && last?.reason && <p className="text-xs text-destructive">Grund: {last.reason}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {statusText[state]}
          {last?.file_path && state !== 'missing' && <Button variant="ghost" size="sm" onClick={() => void openStored(EVIDENCE_BUCKET, last.file_path!)}><ExternalLink className="mr-1.5 h-3.5 w-3.5"/>Ansehen</Button>}
          {!uploading && (state === 'missing' || again) && <Button variant={state === 'missing' && required ? 'default' : 'outline'} size="sm" onClick={() => { setUpload({ kind, file: null, until: '' }); setFormError(''); }}><Upload className="mr-1.5 h-3.5 w-3.5"/>{state === 'missing' ? 'Hochladen' : 'Neu hochladen'}</Button>}
        </div>
      </div>
      {uploading && <div className="space-y-3 rounded-lg bg-muted/40 p-3">
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <Field id={`file-${kind}`} label="Datei" hint="PDF, JPG oder PNG, bis 10 MB"><Input id={`file-${kind}`} type="file" accept={EVIDENCE_TYPES.join(',')} onChange={e => setUpload({ ...upload, file: e.target.files?.[0] ?? null })}/></Field>
          {meta.expires && <Field id={`until-${kind}`} label="Gültig bis"><Input id={`until-${kind}`} type="date" value={upload.until} onChange={e => setUpload({ ...upload, until: e.target.value })}/></Field>}
        </div>
        {errorLine}
        <div className="flex gap-2">
          <Button size="sm" disabled={busy === `upload-${kind}`} onClick={() => void submitUpload()}>{busy === `upload-${kind}` ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin"/> : <Upload className="mr-2 h-3.5 w-3.5"/>}Hochladen</Button>
          <Button size="sm" variant="ghost" onClick={() => { setUpload(null); setFormError(''); }}>Abbrechen</Button>
        </div>
      </div>}
    </li>;
  };
  const proofPanel = <Panel title="Nachweise" icon={Paperclip}>
    <p className="text-sm text-muted-foreground">Verlangt dein Vertrag. Matchunt prüft jeden Nachweis und erinnert dich, bevor einer abläuft.</p>
    {!evidenceReady ? <p className="text-sm text-muted-foreground">Nachweise sind gleich verfügbar. Schau bitte etwas später noch einmal vorbei.</p>
      : <ul className="divide-y divide-border">
        {plan.map(item => proofRow(item.kind, item.required, item.applies))}
        {p?.contractDetails?.permitsDeclaration && <li className={ROW}>
          <div><p className="text-sm">Erlaubnisse und Registrierungen</p><p className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3"/>Aus deinem Vertrag: {p.contractDetails.permitsDeclaration}</p></div>
          <Check className="h-4 w-4 text-success" aria-label="angegeben"/>
        </li>}
      </ul>}
  </Panel>;

  const partnerPanel = partner && <PartnerStatusSection partner={partner} onChange={setPartner}
    person={{ name: saved.about.full_name, company: saved.billing.company_name, roleTitle: saved.about.role_title, focus: expertiseLine(currentExpertise),
      areas: currentExpertise ? [...currentExpertise.areas, ...currentExpertise.extras].join(', ') : '' }}/>;
  const content: Record<SectionId, ReactNode> = { uebersicht: overview, 'ueber-dich': aboutPanel, schwerpunkte: expertisePanel, partnerstatus: partnerPanel, abrechnung: billingPanel, vertrag: contractPanel, nachweise: proofPanel };

  return <DashboardLayout>
    <div className="mx-auto max-w-5xl space-y-5">
      {header}
      <ProfileTabs items={menu} active={active} status={status}/>
      <div className="min-w-0 space-y-5">{content[active]}</div>
    </div>
  </DashboardLayout>;
}
