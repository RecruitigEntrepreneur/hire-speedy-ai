import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { onboardingApi } from '@/lib/recruiterOnboardingApi';

/** Existing approved recruiters retain access. New accounts cannot use the old
 * checkbox onboarding to bypass the contract/review process. Server policies
 * remain authoritative for data access; this guard controls app navigation. */
export default function RecruiterAccessGate({children}:{children:ReactNode}) {
  const {user}=useAuth();
  const {data,isPending,error,refetch}=useQuery({
    queryKey:['recruiter-access',user?.id], enabled:!!user,
    queryFn:async()=>{
      return (await onboardingApi<{allowed:boolean}>(false,{action:'access'})).allowed;
    },
  });
  if(isPending)return <p role="status" className="p-8">Ihr Zugang wird geprüft …</p>;
  if(error)return <div role="alert" className="p-8">Ihr Zugang konnte nicht geprüft werden. <button onClick={()=>void refetch()}>Erneut versuchen</button></div>;
  return data ? <>{children}</> : <Navigate to="/recruiter/onboarding" replace/>;
}
