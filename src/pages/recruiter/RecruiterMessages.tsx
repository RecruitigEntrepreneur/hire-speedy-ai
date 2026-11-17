import { useEffect, useState, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { intlLocale } from '@/i18n/languages';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  ArrowLeft,
  Loader2,
  MessageSquare,
  Send,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  job_id: string | null;
  candidate_id: string | null;
}

interface Conversation {
  id: string;
  otherUserId: string;
  otherUserName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  jobTitle?: string;
  /** Frage eines Kunden zu einem Kandidaten: Antworten laufen über client-question. */
  submissionId?: string | null;
  candidateId?: string | null;
  candidateName?: string | null;
  companyName?: string | null;
  needsAnswer?: boolean;
  /** Verlauf (Posteingang, 15.11.2026): wann vorgestellt */
  submittedAt?: string | null;
}

export default function RecruiterMessages() {
  const { t, i18n } = useTranslation('recruiterInbox');
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Link aus Glocke und Mail: /recruiter/messages?c=<Gespräch>
  const [searchParams] = useSearchParams();
  const linkedConversation = searchParams.get('c');
  // Handy (16.11.2026): erst die Liste, ein Tipp öffnet das Gespräch; über einen Link (?c=) gleich das Gespräch.
  const [handyGespraech, setHandyGespraech] = useState(!!linkedConversation);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation);
    }
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user?.id},recipient_id.eq.${user?.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group messages by conversation
      const conversationMap = new Map<string, Message[]>();
      messagesData?.forEach((msg) => {
        if (!conversationMap.has(msg.conversation_id)) {
          conversationMap.set(msg.conversation_id, []);
        }
        conversationMap.get(msg.conversation_id)?.push(msg);
      });

      // Build conversation list
      const convList: Conversation[] = [];
      for (const [convId, msgs] of conversationMap.entries()) {
        const lastMsg = msgs[0];
        const otherUserId = lastMsg.sender_id === user?.id ? lastMsg.recipient_id : lastMsg.sender_id;
        const unreadCount = msgs.filter(m => m.recipient_id === user?.id && !m.is_read).length;

        // Fetch other user's profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', otherUserId)
          .single();

        convList.push({
          id: convId,
          otherUserId,
          otherUserName: profileData?.full_name || t('messages.unknown'),
          lastMessage: lastMsg.content,
          lastMessageAt: lastMsg.created_at,
          unreadCount,
          // Posteingang: wartet auf dich, solange die neueste Nachricht nicht von dir ist
          needsAnswer: lastMsg.sender_id !== user?.id,
        });
      }

      // Kundenfragen: Kandidat, Stelle und Firma statt „Unbekannt“
      const withContext = [...conversationMap.values()].map((m) => m[0]).filter((m) => m.job_id && m.candidate_id);
      if (withContext.length) {
        const jobIds = [...new Set(withContext.map((m) => m.job_id as string))];
        const candIds = [...new Set(withContext.map((m) => m.candidate_id as string))];
        const [jobsRes, candRes, subRes] = await Promise.all([
          supabase.from('recruiter_jobs_view').select('id, title, company_name').in('id', jobIds),
          supabase.from('candidates').select('id, full_name').in('id', candIds),
          supabase.from('submissions').select('id, job_id, candidate_id, submitted_at').eq('recruiter_id', user!.id).in('job_id', jobIds),
        ]);
        for (const conv of convList) {
          const first = conversationMap.get(conv.id)?.[0];
          if (!first?.job_id || !first.candidate_id) continue;
          const job = (jobsRes.data ?? []).find((j: any) => j.id === first.job_id);
          const sub = (subRes.data ?? []).find((x: any) => x.job_id === first.job_id && x.candidate_id === first.candidate_id);
          conv.jobTitle = job?.title ?? undefined;
          conv.companyName = job?.company_name ?? null;
          conv.candidateId = first.candidate_id;
          conv.candidateName = (candRes.data ?? []).find((c: any) => c.id === first.candidate_id)?.full_name ?? null;
          conv.submissionId = sub?.id ?? null;
          conv.submittedAt = (sub as { submitted_at?: string | null } | undefined)?.submitted_at ?? null;
          conv.needsAnswer = first.sender_id !== user?.id;
          if (conv.otherUserName === t('messages.unknown')) conv.otherUserName = job?.company_name ? t('messages.clientOf', { company: job.company_name }) : t('messages.client');
        }
      }

      setConversations(convList);
      if (linkedConversation && convList.some((c) => c.id === linkedConversation)) {
        setSelectedConversation(linkedConversation);
      } else {
        // Ohne Link gleich das erste, das auf dich wartet (Posteingang, 15.11.2026)
        const erstes = convList.find((c) => c.needsAnswer) ?? convList[0];
        if (erstes) setSelectedConversation(erstes.id);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data);

        // Mark as read
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('conversation_id', conversationId)
          .eq('recipient_id', user?.id)
          .eq('is_read', false);

        // Update unread count
        setConversations(prev => prev.map(c => 
          c.id === conversationId ? { ...c, unreadCount: 0 } : c
        ));
        queryClient.invalidateQueries({ queryKey: ['posteingang-zahl'] });
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;

    const conversation = conversations.find(c => c.id === selectedConversation);
    if (!conversation) return;

    setSending(true);
    try {
      if (conversation.submissionId) {
        // Antwort auf eine Kundenfrage: Glocke und Mail beim Kunden, Namen geschwärzt
        const { data: res, error: fnError } = await supabase.functions.invoke('client-question', {
          body: { action: 'answer', submission_id: conversation.submissionId, text: newMessage.trim() },
        });
        if (fnError || (res as { error?: string } | null)?.error) {
          throw new Error((res as { error?: string } | null)?.error ?? fnError?.message);
        }
        if ((res as { scrubbed?: boolean } | null)?.scrubbed) {
          toast({ title: t('messages.sent'), description: t('messages.scrubbed') });
        }
        setNewMessage('');
        await fetchMessages(selectedConversation);
        setConversations((prev) => prev.map((c) => (c.id === selectedConversation ? { ...c, needsAnswer: false, lastMessage: newMessage.trim(), lastMessageAt: new Date().toISOString() } : c)));
        queryClient.invalidateQueries({ queryKey: ['posteingang-zahl'] });
        return;
      }
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation,
          sender_id: user.id,
          recipient_id: conversation.otherUserId,
          content: newMessage.trim()
        })
        .select()
        .single();

      if (error) throw error;

      setMessages(prev => [...prev, data]);
      setNewMessage('');

      // Update conversation list
      setConversations(prev => prev.map(c => 
        c.id === selectedConversation 
          ? { ...c, needsAnswer: false, lastMessage: newMessage.trim(), lastMessageAt: new Date().toISOString() }
          : c
      ));
      queryClient.invalidateQueries({ queryKey: ['posteingang-zahl'] });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: t('messages.error'),
        description: t('messages.sendFailed'),
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString(intlLocale(i18n.language), { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString(intlLocale(i18n.language), { day: '2-digit', month: '2-digit' });
  };

  const warten = conversations.filter((c) => c.needsAnswer);
  const beantwortet = conversations.filter((c) => !c.needsAnswer);
  const aktiv = conversations.find((c) => c.id === selectedConversation) ?? null;
  const datum = (d: string) => new Date(d).toLocaleDateString(intlLocale(i18n.language), { day: '2-digit', month: '2-digit' });
  // Verlauf zum Vorgang: vorgestellt, Fragen und Antworten (Posteingang, 15.11.2026)
  const verlauf = aktiv ? [
    ...(aktiv.submittedAt ? [{ at: aktiv.submittedAt, text: t('messages.histSubmitted') }] : []),
    ...messages.map((m) => ({ at: m.created_at, text: m.sender_id === user?.id ? t('messages.histAnswered') : aktiv.submissionId ? t('messages.histClientQuestion') : t('messages.histReceived') })),
  ].sort((a, b) => a.at.localeCompare(b.at)) : [];

  const zeile = (conv: Conversation) => (
    <button
      key={conv.id}
      type="button"
      onClick={() => { setSelectedConversation(conv.id); setHandyGespraech(true); }}
      className={`w-full p-3 text-left transition-colors ${selectedConversation === conv.id ? 'bg-muted' : 'hover:bg-muted/50'}`}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">{conv.otherUserName.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-sm font-medium">
              {conv.companyName && conv.candidateName ? t('messages.asks', { company: conv.companyName, name: conv.candidateName.replace(/^test\s+/i, '') }) : conv.otherUserName}
            </p>
            <span className="shrink-0 text-xs text-muted-foreground">{formatTime(conv.lastMessageAt)}</span>
          </div>
          {conv.jobTitle && <p className="truncate text-xs text-muted-foreground">{conv.jobTitle}</p>}
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {conv.needsAnswer ? t('messages.quoted', { text: conv.lastMessage }) : t('messages.youWrote', { text: conv.lastMessage })}
          </p>
        </div>
      </div>
    </button>
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Posteingang (15.11.2026): erreichbar über die Sprechblase oben, kein Menüpunkt */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('messages.inboxTitle')}</h1>
          <p className="text-muted-foreground">{t('messages.inboxSubtitle')}</p>
        </div>

        <div className="grid gap-6 md:h-[calc(100vh-280px)] md:min-h-[500px] md:grid-cols-3">
          {/* Links: was auf dich wartet, darunter Beantwortetes */}
          <Card className={handyGespraech ? 'max-md:hidden md:col-span-1' : 'md:col-span-1'}>
            <CardContent className="p-0">
              <ScrollArea className="md:h-[calc(100vh-300px)] md:min-h-[450px] [&_[data-radix-scroll-area-viewport]>div]:!block">
                {conversations.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-2 text-sm text-muted-foreground">{t('messages.noneYet')}</p>
                  </div>
                ) : (
                  <>
                    <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('messages.waiting', { count: warten.length })}</p>
                    {warten.length ? <div className="divide-y">{warten.map(zeile)}</div> : <p className="px-3 pb-3 text-sm text-muted-foreground">{t('messages.nothingOpen')}</p>}
                    <p className="border-t px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('messages.answered', { count: beantwortet.length })}</p>
                    {beantwortet.length ? <div className="divide-y">{beantwortet.map(zeile)}</div> : <p className="px-3 pb-3 text-sm text-muted-foreground">{t('messages.nothingYet')}</p>}
                  </>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Rechts: das Gespräch mit Antwortfeld und Verlauf */}
          <Card className={handyGespraech ? 'flex flex-col md:col-span-2' : 'flex flex-col max-md:hidden md:col-span-2'}>
            {aktiv ? (
              <>
                <CardHeader className="border-b pb-4">
                  <button type="button" onClick={() => setHandyGespraech(false)} className="-mt-1 mb-2 inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground md:hidden">
                    <ArrowLeft className="h-4 w-4" />{t('messages.backToList')}
                  </button>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{aktiv.otherUserName.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base">{aktiv.otherUserName}</CardTitle>
                        {aktiv.jobTitle && (
                          <p className="text-xs text-muted-foreground">
                            <Trans
                              t={t}
                              i18nKey="messages.questionAbout"
                              values={{ name: aktiv.candidateName ?? t('messages.yourCandidate'), job: aktiv.jobTitle }}
                              components={{
                                link: aktiv.candidateId
                                  ? <Link to={`/recruiter/candidates/${aktiv.candidateId}`} className="underline underline-offset-2 hover:text-foreground" />
                                  : <span />,
                              }}
                            />
                          </p>
                        )}
                      </div>
                    </div>
                    {aktiv.candidateId && (
                      <Link to={`/recruiter/candidates/${aktiv.candidateId}`} className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">{t('messages.toProfile')}</Link>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col p-0">
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] sm:max-w-[70%] rounded-lg p-3 ${msg.sender_id === user?.id ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            <p className="text-sm">{msg.content}</p>
                            <p className={`mt-1 text-xs ${msg.sender_id === user?.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{formatTime(msg.created_at)}</p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                  <div className="border-t p-4">
                    {aktiv.submissionId && (
                      <p className="mb-2 text-xs text-muted-foreground">
                        {t('messages.replyNote')}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Input
                        placeholder={aktiv.companyName ? t('messages.replyTo', { company: aktiv.companyName }) : t('messages.writeShort')}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                      />
                      <Button onClick={sendMessage} disabled={sending || !newMessage.trim()}>
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="mr-1.5 h-4 w-4" />{t('messages.send')}</>}
                      </Button>
                    </div>
                    {verlauf.length > 0 && (
                      <div className="mt-4 border-t pt-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('messages.history')}</p>
                        {verlauf.map((v, i) => <p key={i} className="mt-1 text-xs text-muted-foreground">{datum(v.at)} · {v.text}</p>)}
                      </div>
                    )}
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">{t('messages.noneYet')}</h3>
                  <p className="text-muted-foreground">{t('messages.emptyText')}</p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
