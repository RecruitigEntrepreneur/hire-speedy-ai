import { createContext, useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { onboardingApi } from '@/lib/recruiterOnboardingApi';

/** Existing approved recruiters retain access. New accounts cannot use the old
 * checkbox onboarding to bypass the contract/review process. Server policies
 * remain authoritative for data access; this guard controls app navigation. */

interface Access { allowed: boolean; pending: boolean }

/** Wartezustand: unterschrieben, aber noch nicht gegengezeichnet. Nur Ansehen (RecruiterWaiting.tsx). */
const PendingContext = createContext(false);
export const useRecruiterPending = () => useContext(PendingContext);
/** Beispiel-Bühne des Rundgangs: Dort zeigen die Seiten alle Knöpfe, auch im Wartezustand. */
export const RecruiterPendingOverride = PendingContext.Provider;

// Ein erlaubter Zugang wird im Gerät gemerkt (höchstens 24 h), damit die Seite nicht bei
// jedem Neuladen auf die Prüfung wartet; geprüft wird trotzdem jedes Mal im Hintergrund
// (Live-Test 23.10.2026). Der Wartezustand wird mitgemerkt: `<zeit>` oder `<zeit>|pending`.
const REMEMBER_MS = 24 * 60 * 60 * 1000;
const storageKey = (userId: string) => `matchunt:recruiter-access:${userId}`;

function rememberedAccess(userId: string | undefined): Access | undefined {
  if (!userId) return undefined;
  try {
    const [at, flag] = (localStorage.getItem(storageKey(userId)) ?? '').split('|');
    return Number(at) && Date.now() - Number(at) < REMEMBER_MS ? { allowed: true, pending: flag === 'pending' } : undefined;
  } catch {
    return undefined;
  }
}

function remember(userId: string, access: Access) {
  try {
    if (access.allowed) localStorage.setItem(storageKey(userId), `${Date.now()}${access.pending ? '|pending' : ''}`);
    else localStorage.removeItem(storageKey(userId));
  } catch {
    // ohne Speicher wartet die Seite wie bisher auf die Prüfung
  }
}

/** Zugang und Wartezustand; dieselbe Abfrage nutzt auch der Rundgang (Text im Wartezustand). */
export function useRecruiterAccess(enabled=true) {
  const {user}=useAuth();
  return useQuery({
    queryKey:['recruiter-access',user?.id], enabled:!!user&&enabled,
    queryFn:async():Promise<Access>=>{
      const result=await onboardingApi<Partial<Access>>(false,{action:'access'});
      const access={allowed:result.allowed===true,pending:result.pending===true};
      if(user) remember(user.id, access);
      return access;
    },
    initialData:()=>rememberedAccess(user?.id),
    initialDataUpdatedAt:0,
    // Im Wartezustand fällt die Sperre von selbst, sobald Matchunt gegengezeichnet hat.
    refetchInterval:query=>query.state.data?.pending?60_000:false,
  });
}

export default function RecruiterAccessGate({children}:{children:ReactNode}) {
  const {data,isPending,error,refetch}=useRecruiterAccess();
  if(isPending)return <p role="status" className="p-8">Ihr Zugang wird geprüft …</p>;
  if(error&&data===undefined)return <div role="alert" className="p-8">Ihr Zugang konnte nicht geprüft werden. <button onClick={()=>void refetch()}>Erneut versuchen</button></div>;
  return data?.allowed ? <PendingContext.Provider value={data.pending}>{children}</PendingContext.Provider> : <Navigate to="/recruiter/onboarding" replace/>;
}
