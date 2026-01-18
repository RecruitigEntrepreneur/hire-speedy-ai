import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface QuickScores {
  technical?: number;
  communication?: number;
  culture_fit?: number;
  [key: string]: number | undefined;
}

export interface InterviewSession {
  interviewId: string;
  startedAt: Date | null;
  endedAt: Date | null;
  elapsedSeconds: number;
  isRunning: boolean;
  quickScores: QuickScores;
}

export function useInterviewSession(interviewId: string | null) {
  const [session, setSession] = useState<InterviewSession>({
    interviewId: interviewId || '',
    startedAt: null,
    endedAt: null,
    elapsedSeconds: 0,
    isRunning: false,
    quickScores: {},
  });
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);

  // Load existing session data
  useEffect(() => {
    if (!interviewId) return;

    const loadSession = async () => {
      const { data } = await supabase
        .from('interviews')
        .select('live_session_started_at, live_session_ended_at, quick_scores')
        .eq('id', interviewId)
        .single();

      if (data) {
        const startedAt = data.live_session_started_at ? new Date(data.live_session_started_at) : null;
        const endedAt = data.live_session_ended_at ? new Date(data.live_session_ended_at) : null;
        
        let elapsedSeconds = 0;
        if (startedAt && !endedAt) {
          elapsedSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
        } else if (startedAt && endedAt) {
          elapsedSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
        }

        setSession({
          interviewId,
          startedAt,
          endedAt,
          elapsedSeconds,
          isRunning: !!startedAt && !endedAt,
          quickScores: (data.quick_scores as QuickScores) || {},
        });
      }
    };

    loadSession();
  }, [interviewId]);

  // Timer logic
  useEffect(() => {
    if (session.isRunning) {
      intervalRef.current = setInterval(() => {
        setSession(prev => ({
          ...prev,
          elapsedSeconds: prev.elapsedSeconds + 1,
        }));
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [session.isRunning]);

  // Auto-save quick scores every 5 seconds
  useEffect(() => {
    if (!interviewId) return;

    autoSaveRef.current = setInterval(async () => {
      if (Object.keys(session.quickScores).length > 0) {
        await supabase
          .from('interviews')
          .update({ quick_scores: session.quickScores })
          .eq('id', interviewId);
      }
    }, 5000);

    return () => {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
      }
    };
  }, [interviewId, session.quickScores]);

  const startSession = useCallback(async () => {
    if (!interviewId || session.isRunning) return;

    const now = new Date();
    await supabase
      .from('interviews')
      .update({ 
        live_session_started_at: now.toISOString(),
        live_session_ended_at: null 
      })
      .eq('id', interviewId);

    setSession(prev => ({
      ...prev,
      startedAt: now,
      endedAt: null,
      isRunning: true,
      elapsedSeconds: 0,
    }));
  }, [interviewId, session.isRunning]);

  const pauseSession = useCallback(() => {
    setSession(prev => ({ ...prev, isRunning: false }));
  }, []);

  const resumeSession = useCallback(() => {
    if (session.startedAt && !session.endedAt) {
      setSession(prev => ({ ...prev, isRunning: true }));
    }
  }, [session.startedAt, session.endedAt]);

  const endSession = useCallback(async () => {
    if (!interviewId) return;

    const now = new Date();
    await supabase
      .from('interviews')
      .update({ 
        live_session_ended_at: now.toISOString(),
        quick_scores: session.quickScores,
      })
      .eq('id', interviewId);

    setSession(prev => ({
      ...prev,
      endedAt: now,
      isRunning: false,
    }));
  }, [interviewId, session.quickScores]);

  const updateQuickScore = useCallback((category: string, score: number) => {
    setSession(prev => ({
      ...prev,
      quickScores: {
        ...prev.quickScores,
        [category]: score,
      },
    }));
  }, []);

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    session,
    startSession,
    pauseSession,
    resumeSession,
    endSession,
    updateQuickScore,
    formatTime: () => formatTime(session.elapsedSeconds),
    elapsedSeconds: session.elapsedSeconds,
  };
}
