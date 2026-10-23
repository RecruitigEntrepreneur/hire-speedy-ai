import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { onboardingApi } from '@/lib/recruiterOnboardingApi';

/** Existing approved recruiters retain access. New accounts cannot use the old
 * checkbox onboarding to bypass the contract/review process. Server policies
 * remain authoritative for data access; this guard controls app navigation. */

// Ein erlaubter Zugang wird im Gerät gemerkt (höchstens 24 h), damit die Seite nicht bei
// jedem Neuladen auf die Prüfung wartet; geprüft wird trotzdem jedes Mal im Hintergrund
// (Live-Test 23.10.2026).
const REMEMBER_MS = 24 * 60 * 60 * 1000;
const storageKey = (userId: string) => `matchunt:recruiter-access:${userId}`;

function rememberedAccess(userId: string | undefined): boolean | undefined {
  if (!userId) return undefined;
  try {
    const at = Number(localStorage.getItem(storageKey(userId)));
    return at && Date.now() - at < REMEMBER_MS ? true : undefined;
  } catch {
    return undefined;
  }
}

function remember(userId: string, allowed: boolean) {
  try {
    if (allowed) localStorage.setItem(storageKey(userId), String(Date.now()));
    else localStorage.removeItem(storageKey(userId));
  } catch {
    // ohne Speicher wartet die Seite wie bisher auf die Prüfung
  }
}

export default function RecruiterAccessGate({children}:{children:ReactNode}) {
  const {user}=useAuth();
  const {data,isPending,error,refetch}=useQuery({
    queryKey:['recruiter-access',user?.id], enabled:!!user,
    queryFn:async()=>{
      const allowed=(await onboardingApi<{allowed:boolean}>(false,{action:'access'})).allowed;
      if(user) remember(user.id, allowed);
      return allowed;
    },
    initialData:()=>rememberedAccess(user?.id),
    initialDataUpdatedAt:0,
  });
  if(isPending)return <p role="status" className="p-8">Ihr Zugang wird geprüft …</p>;
  if(error&&data===undefined)return <div role="alert" className="p-8">Ihr Zugang konnte nicht geprüft werden. <button onClick={()=>void refetch()}>Erneut versuchen</button></div>;
  return data ? <>{children}</> : <Navigate to="/recruiter/onboarding" replace/>;
}
