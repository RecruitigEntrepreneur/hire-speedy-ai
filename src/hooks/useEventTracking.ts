import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

interface TrackEventOptions {
  event_type: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
}

// Generate a unique session ID for this browser session
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('tracking_session_id');
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    sessionStorage.setItem('tracking_session_id', sessionId);
  }
  return sessionId;
};

export function useEventTracking() {
  const { user } = useAuth();
  const sessionId = useRef(getSessionId());

  const trackEvent = useCallback(async (options: TrackEventOptions) => {
    if (!user) {
      console.log('Event tracking skipped: no user');
      return null;
    }

    try {
      const { data, error } = await supabase.functions.invoke('track-event', {
        body: {
          ...options,
          session_id: sessionId.current,
        },
      });

      if (error) {
        console.error('Error tracking event:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Failed to track event:', err);
      return null;
    }
  }, [user]);

  // Track page views automatically
  const trackPageView = useCallback((pageName: string, metadata?: Record<string, unknown>) => {
    return trackEvent({
      event_type: 'page_view',
      metadata: { page: pageName, ...metadata },
    });
  }, [trackEvent]);

  // Track entity views (job, candidate, submission)
  const trackEntityView = useCallback((entityType: string, entityId: string, metadata?: Record<string, unknown>) => {
    return trackEvent({
      event_type: `view_${entityType}`,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    });
  }, [trackEvent]);

  // Track actions (submit, accept, reject, etc.)
  const trackAction = useCallback((action: string, entityType?: string, entityId?: string, metadata?: Record<string, unknown>) => {
    return trackEvent({
      event_type: action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    });
  }, [trackEvent]);

  return {
    trackEvent,
    trackPageView,
    trackEntityView,
    trackAction,
  };
}

// Hook for automatic page view tracking
export function usePageViewTracking(pageName: string, metadata?: Record<string, unknown>) {
  const { trackPageView } = useEventTracking();
  const tracked = useRef(false);

  useEffect(() => {
    if (!tracked.current) {
      tracked.current = true;
      trackPageView(pageName, metadata);
    }
  }, [pageName, trackPageView, metadata]);
}

// Hook for automatic entity view tracking
export function useEntityViewTracking(entityType: string, entityId: string | undefined, metadata?: Record<string, unknown>) {
  const { trackEntityView } = useEventTracking();
  const trackedId = useRef<string | null>(null);

  useEffect(() => {
    if (entityId && trackedId.current !== entityId) {
      trackedId.current = entityId;
      trackEntityView(entityType, entityId, metadata);
    }
  }, [entityType, entityId, trackEntityView, metadata]);
}