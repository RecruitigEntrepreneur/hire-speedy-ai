import { useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { UnifiedTaskItem } from './useUnifiedTaskInbox';

export interface SessionOutcome {
  item: UnifiedTaskItem;
  action: 'completed' | 'skipped' | 'snoozed';
  note?: string;
  duration: number; // seconds spent on this item
}

export interface ActionSession {
  id: string;
  startedAt: Date;
  queue: UnifiedTaskItem[];
  currentIndex: number;
  outcomes: SessionOutcome[];
  isActive: boolean;
  isPaused: boolean;
}

export function useActionSession() {
  const { user } = useAuth();
  const [session, setSession] = useState<ActionSession | null>(null);
  const itemStartTime = useRef<Date>(new Date());

  const currentItem = useMemo(() => {
    if (!session || !session.isActive) return null;
    if (session.currentIndex >= session.queue.length) return null;
    return session.queue[session.currentIndex];
  }, [session]);

  const completedCount = useMemo(
    () => session?.outcomes.filter(o => o.action === 'completed').length ?? 0,
    [session]
  );

  const skippedCount = useMemo(
    () => session?.outcomes.filter(o => o.action === 'skipped').length ?? 0,
    [session]
  );

  const snoozedCount = useMemo(
    () => session?.outcomes.filter(o => o.action === 'snoozed').length ?? 0,
    [session]
  );

  const totalDuration = useMemo(() => {
    if (!session) return 0;
    return session.outcomes.reduce((sum, o) => sum + o.duration, 0);
  }, [session]);

  const isLastItem = useMemo(() => {
    if (!session) return false;
    return session.currentIndex >= session.queue.length - 1;
  }, [session]);

  const startSession = useCallback(async (items: UnifiedTaskItem[]) => {
    if (!user || items.length === 0) return;

    const sessionId = crypto.randomUUID();

    // Log session start as platform event
    await supabase.from('platform_events').insert({
      event_type: 'action_session_start',
      user_id: user.id,
      user_type: 'recruiter',
      entity_type: 'session',
      entity_id: sessionId,
      metadata: {
        queue_size: items.length,
        urgent_count: items.filter(i => i.priority === 'critical').length,
      },
    } as any);

    setSession({
      id: sessionId,
      startedAt: new Date(),
      queue: items,
      currentIndex: 0,
      outcomes: [],
      isActive: true,
      isPaused: false,
    });

    itemStartTime.current = new Date();
  }, [user]);

  const getItemDuration = useCallback(() => {
    return Math.round((new Date().getTime() - itemStartTime.current.getTime()) / 1000);
  }, []);

  const advanceToNext = useCallback(() => {
    setSession(prev => {
      if (!prev) return null;
      const nextIndex = prev.currentIndex + 1;
      if (nextIndex >= prev.queue.length) {
        return { ...prev, isActive: false };
      }
      return { ...prev, currentIndex: nextIndex };
    });
    itemStartTime.current = new Date();
  }, []);

  const completeItem = useCallback(async (note?: string) => {
    if (!session || !currentItem) return;

    const duration = getItemDuration();

    // Mark done in DB
    if (currentItem.itemType === 'alert') {
      await supabase
        .from('influence_alerts')
        .update({
          action_taken: 'completed',
          action_taken_at: new Date().toISOString(),
          is_read: true,
        })
        .eq('id', currentItem.itemId);
    } else {
      await supabase
        .from('recruiter_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', currentItem.itemId);
    }

    // Log activity if candidate linked
    if (currentItem.candidateId && user) {
      await supabase.from('candidate_activity_log').insert({
        candidate_id: currentItem.candidateId,
        recruiter_id: user.id,
        activity_type: 'alert_actioned',
        title: `Aufgabe erledigt: ${currentItem.title}`,
        description: note || null,
        metadata: {
          item_type: currentItem.itemType,
          task_category: currentItem.taskCategory,
          session_id: session.id,
          duration_seconds: duration,
        },
        related_submission_id: currentItem.submissionId || null,
        related_alert_id: currentItem.itemType === 'alert' ? currentItem.itemId : null,
      } as any);
    }

    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        outcomes: [
          ...prev.outcomes,
          { item: currentItem, action: 'completed', note, duration },
        ],
      };
    });

    advanceToNext();
  }, [session, currentItem, user, getItemDuration, advanceToNext]);

  const skipItem = useCallback(() => {
    if (!session || !currentItem) return;

    const duration = getItemDuration();

    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        outcomes: [
          ...prev.outcomes,
          { item: currentItem, action: 'skipped', duration },
        ],
      };
    });

    advanceToNext();
  }, [session, currentItem, getItemDuration, advanceToNext]);

  const snoozeItem = useCallback(async (until: Date) => {
    if (!session || !currentItem) return;

    const duration = getItemDuration();

    // Snooze in DB
    if (currentItem.itemType === 'alert') {
      await supabase
        .from('influence_alerts')
        .update({ snoozed_until: until.toISOString() } as any)
        .eq('id', currentItem.itemId);
    } else {
      await supabase
        .from('recruiter_tasks')
        .update({ due_at: until.toISOString() })
        .eq('id', currentItem.itemId);
    }

    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        outcomes: [
          ...prev.outcomes,
          { item: currentItem, action: 'snoozed', duration },
        ],
      };
    });

    advanceToNext();
  }, [session, currentItem, getItemDuration, advanceToNext]);

  const endSession = useCallback(async () => {
    if (!session || !user) return;

    // Log session end
    await supabase.from('platform_events').insert({
      event_type: 'action_session_end',
      user_id: user.id,
      user_type: 'recruiter',
      entity_type: 'session',
      entity_id: session.id,
      metadata: {
        queue_size: session.queue.length,
        completed: completedCount,
        skipped: skippedCount,
        snoozed: snoozedCount,
        total_duration_seconds: totalDuration,
        avg_duration_seconds: session.outcomes.length > 0
          ? Math.round(totalDuration / session.outcomes.length)
          : 0,
      },
    } as any);

    setSession(prev => prev ? { ...prev, isActive: false } : null);
  }, [session, user, completedCount, skippedCount, snoozedCount, totalDuration]);

  const goBack = useCallback(() => {
    setSession(prev => {
      if (!prev || prev.currentIndex <= 0) return prev;
      return { ...prev, currentIndex: prev.currentIndex - 1 };
    });
    itemStartTime.current = new Date();
  }, []);

  const clearSession = useCallback(() => {
    setSession(null);
  }, []);

  return {
    session,
    currentItem,
    isActive: session?.isActive ?? false,
    isFinished: session !== null && !session.isActive,
    currentIndex: session?.currentIndex ?? 0,
    queueLength: session?.queue.length ?? 0,
    completedCount,
    skippedCount,
    snoozedCount,
    totalDuration,
    isLastItem,
    outcomes: session?.outcomes ?? [],
    startSession,
    completeItem,
    skipItem,
    snoozeItem,
    endSession,
    goBack,
    clearSession,
  };
}
