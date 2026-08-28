import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users } from 'lucide-react';

interface CommentRow {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
}

export function BewerberNotes({ submissionId }: { submissionId: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: comments = [] } = useQuery({
    queryKey: ['bewerber-comments', submissionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_comments')
        .select('id, user_id, content, created_at')
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as CommentRow[];
    },
    staleTime: 30_000,
  });

  const save = async () => {
    const content = text.trim();
    if (!content || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('candidate_comments')
        .insert({ submission_id: submissionId, user_id: user.id, content });
      if (error) throw error;
      setText('');
      queryClient.invalidateQueries({ queryKey: ['bewerber-comments', submissionId] });
    } catch {
      toast.error(t('bewerber.notes.save_error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 border-t">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Users className="h-3 w-3" />
        {t('bewerber.notes.title')}
      </h4>

      {comments.length === 0 ? (
        <p className="text-xs text-muted-foreground/60 mb-2">{t('bewerber.notes.empty')}</p>
      ) : (
        <div className="space-y-2 mb-2">
          {comments.map((c) => (
            <div key={c.id} className="bg-muted/40 rounded-lg px-3 py-2">
              <p className="text-[11px] font-medium text-muted-foreground">
                {c.user_id === user?.id ? t('bewerber.notes.author_you') : t('bewerber.notes.author_member')}
                <span className="font-normal text-muted-foreground/60"> · {formatWhen(c.created_at)}</span>
              </p>
              <p className="text-xs text-foreground mt-0.5 whitespace-pre-wrap">{c.content}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              save();
            }
          }}
          placeholder={t('bewerber.notes.placeholder')}
          className="h-8 text-xs"
        />
        <Button size="sm" variant="outline" className="h-8" onClick={save} disabled={saving || !text.trim()}>
          {t('bewerber.notes.save')}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground/60 mt-1.5">{t('bewerber.notes.visibility')}</p>
    </div>
  );
}
