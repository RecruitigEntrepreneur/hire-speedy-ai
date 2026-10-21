import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface QuestionMessage {
  id: string;
  conversationId: string;
  mine: boolean;
  content: string;
  createdAt: string;
}

export interface QuestionThread {
  messages: QuestionMessage[];
  /** Eigene Fragen (für „schon gefragt“). */
  asked: string[];
  /** Letzte eigene Frage ist noch ohne Antwort. */
  waiting: boolean;
}

/**
 * Fragen des Kunden an den Headhunter zu genau dieser Einreichung. Die Nachrichten
 * liegen in `messages` (Stelle + Kandidat); RLS zeigt nur, was man selbst geschrieben
 * oder bekommen hat.
 */
export function useClientQuestions(jobId: string | undefined, candidateId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ['client-questions', jobId, candidateId, user?.id];

  const query = useQuery<QuestionThread>({
    queryKey: key,
    enabled: !!jobId && !!candidateId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, recipient_id, content, created_at, is_read')
        .eq('job_id', jobId!)
        .eq('candidate_id', candidateId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const rows = data ?? [];
      // Antworten als gelesen markieren, sobald der Kunde sie sieht.
      const unread = rows.filter((m) => m.recipient_id === user!.id && !m.is_read).map((m) => m.id);
      if (unread.length) void supabase.from('messages').update({ is_read: true }).in('id', unread);
      const messages = rows.map((m) => ({
        id: m.id,
        conversationId: m.conversation_id,
        mine: m.sender_id === user!.id,
        content: m.content,
        createdAt: m.created_at ?? '',
      }));
      const last = messages[messages.length - 1];
      return { messages, asked: messages.filter((m) => m.mine).map((m) => m.content), waiting: !!last?.mine };
    },
  });

  /**
   * Frage senden. Die Function client-question legt die Nachricht an, setzt die Glocke
   * beim Headhunter und schickt ihm eine Mail.
   */
  const ask = async (p: { submissionId: string; text: string }) => {
    const { data, error } = await supabase.functions.invoke('client-question', {
      body: { action: 'ask', submission_id: p.submissionId, text: p.text },
    });
    if (error || (data as { error?: string } | null)?.error) {
      throw new Error((data as { error?: string } | null)?.error ?? error?.message ?? 'Senden fehlgeschlagen');
    }
    await qc.invalidateQueries({ queryKey: key });
  };

  return { ...query, ask };
}
