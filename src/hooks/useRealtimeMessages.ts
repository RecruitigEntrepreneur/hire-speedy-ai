import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  is_read: boolean;
  job_id: string | null;
  candidate_id: string | null;
  created_at: string;
}

export function useRealtimeMessages(conversationId?: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchMessages = useCallback(async () => {
    if (!user) return;

    let query = supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: true });

    if (conversationId) {
      query = query.eq("conversation_id", conversationId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching messages:", error);
      return;
    }

    setMessages(data || []);
    setUnreadCount(data?.filter((m) => m.recipient_id === user.id && !m.is_read).length || 0);
    setLoading(false);
  }, [user, conversationId]);

  const sendMessage = useCallback(
    async (params: {
      recipientId: string;
      content: string;
      conversationId: string;
      jobId?: string;
      candidateId?: string;
    }) => {
      if (!user) return { error: "Not authenticated" };

      const { data, error } = await supabase
        .from("messages")
        .insert({
          sender_id: user.id,
          recipient_id: params.recipientId,
          conversation_id: params.conversationId,
          content: params.content,
          job_id: params.jobId || null,
          candidate_id: params.candidateId || null,
        })
        .select()
        .single();

      if (error) {
        console.error("Error sending message:", error);
        return { error: error.message };
      }

      return { data };
    },
    [user]
  );

  const markAsRead = useCallback(
    async (messageId: string) => {
      if (!user) return;

      const { error } = await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("id", messageId)
        .eq("recipient_id", user.id);

      if (!error) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, is_read: true } : m))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    },
    [user]
  );

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetchMessages();

    // Build filter for realtime subscription
    const filterParts = [];
    if (conversationId) {
      filterParts.push(`conversation_id=eq.${conversationId}`);
    }

    const channel = supabase
      .channel(`messages-${conversationId || "all"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: conversationId ? `conversation_id=eq.${conversationId}` : undefined,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          // Only add if relevant to current user
          if (newMessage.sender_id === user.id || newMessage.recipient_id === user.id) {
            setMessages((prev) => [...prev, newMessage]);
            if (newMessage.recipient_id === user.id && !newMessage.is_read) {
              setUnreadCount((prev) => prev + 1);
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: conversationId ? `conversation_id=eq.${conversationId}` : undefined,
        },
        (payload) => {
          const updatedMessage = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updatedMessage.id ? updatedMessage : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, conversationId, fetchMessages]);

  return {
    messages,
    loading,
    unreadCount,
    sendMessage,
    markAsRead,
    refetch: fetchMessages,
  };
}
