import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import PartnerCheck from '@/pages/public/PartnerCheck';
import '@/index.css';

// Separate Vite-Entwicklungsseite für die öffentliche Prüfseite; partner-check ist nachgestellt.
//   /__preview/partner-check.html?state=active|expertise|gold|paused|ended|invalid
if (!import.meta.env.DEV) throw new Error('This preview is only available in development.');

const state = new URLSearchParams(location.search).get('state') ?? 'active';
const now = new Date().toISOString();
const answers: Record<string, unknown> = {
  active: { state: 'active', number: 'MP-7K3Q-92XW', name: 'Marko Benko', company: 'Bluewater & Bridge GmbH', tier: 'partner', since: '2026-09-21T15:30:00Z', checkedAt: now, expertise: null },
  expertise: { state: 'active', number: 'MP-7K3Q-92XW', name: 'Marko Benko', company: 'Bluewater & Bridge GmbH', tier: 'partner', since: '2026-09-21T15:30:00Z', checkedAt: now, expertise: 'Finance & Controlling · Fach, Führung' },
  gold: { state: 'active', number: 'MP-7K3Q-92XW', name: 'Marko Benko', company: 'Bluewater & Bridge GmbH', tier: 'gold', since: '2026-09-21T15:30:00Z', checkedAt: now, expertise: null },
  paused: { state: 'paused', number: 'MP-7K3Q-92XW', checkedAt: now },
  ended: { state: 'ended', number: 'MP-7K3Q-92XW', endedAt: '2027-03-31T10:00:00Z' },
  invalid: { state: 'invalid' },
};
Object.defineProperty(supabase, 'functions', { configurable: true, value: {
  invoke: async () => { await new Promise(r => setTimeout(r, 400)); return { data: answers[state] ?? answers.invalid, error: null }; },
} });

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={[state === 'invalid' ? '/partner/MP-0000-0000' : '/partner/MP-7K3Q-92XW']}>
    <Routes><Route path="/partner/:number" element={<PartnerCheck/>}/><Route path="*" element={<PartnerCheck/>}/></Routes>
  </MemoryRouter>,
);
