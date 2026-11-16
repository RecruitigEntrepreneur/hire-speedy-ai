import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  related_type: string | null;
  related_id: string | null;
  created_at: string;
}

export function useRealtimeNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // Aus der Liste abgeleitet, damit Zahl und Punkte nie auseinanderlaufen (15.11.2026).
  const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching notifications:", error);
      return;
    }

    setNotifications(data || []);
    setLoading(false);
  }, [user]);

  /**
   * Gelesen beim Öffnen (15.11.2026): Mit dem angeklickten Hinweis gelten auch die anderen zum
   * selben Vorgang als gelesen (gleiches related_type und related_id), sonst bleiben z. B. fünf
   * Meldungen zum selben Angebot ungelesen stehen.
   */
  const markAsRead = useCallback(async (n: Pick<Notification, "id" | "related_type" | "related_id">) => {
    if (!user) return;
    const verwandt = (x: Pick<Notification, "id" | "related_type" | "related_id">) =>
      x.id === n.id || (!!n.related_type && !!n.related_id && x.related_type === n.related_type && x.related_id === n.related_id);
    let query = supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    query = n.related_type && n.related_id
      ? query.or(`id.eq.${n.id},and(related_type.eq.${n.related_type},related_id.eq.${n.related_id})`)
      : query.eq("id", n.id);
    const { error } = await query;
    if (!error) setNotifications((prev) => prev.map((x) => (verwandt(x) ? { ...x, is_read: true } : x)));
  }, [user]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (!error) {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetchNotifications();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications((prev) => [newNotification, ...prev]);

          // Show toast for new notification
          toast(newNotification.title, {
            description: newNotification.message || undefined,
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updatedNotification = payload.new as Notification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updatedNotification.id ? updatedNotification : n))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
