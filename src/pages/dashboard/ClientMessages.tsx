import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { candidateAnonCode } from '@/lib/anonymization';
import { getJobSearchers } from '@/lib/jobSearch';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Send, 
  Search,
  MessageSquare,
  User,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  recipient_id: string;
  is_read: boolean;
  conversation_id: string;
  job_id?: string | null;
  candidate_id?: string | null;
}

interface Conversation {
  id: string;
  participant: {
    id: string;
    full_name: string | null;
    email: string;
  };
  lastMessage: Message | null;
  unreadCount: number;
  /** Frage zu einem Kandidaten: Einreichung, Kürzel, Stelle */
  submissionId?: string | null;
  code?: string | null;
  jobTitle?: string | null;
}

export default function ClientMessages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Link aus Glocke und Mail: /dashboard/messages?c=<Gespräch>
  const [searchParams] = useSearchParams();
  const linkedConversation = searchParams.get('c');

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      // Get all messages for the user
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user?.id},recipient_id.eq.${user?.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by conversation
      const conversationMap = new Map<string, { messages: Message[], participantId: string }>();
      
      messagesData?.forEach((msg) => {
        const convId = msg.conversation_id;
        const participantId = msg.sender_id === user?.id ? msg.recipient_id : msg.sender_id;
        
        if (!conversationMap.has(convId)) {
          conversationMap.set(convId, { messages: [], participantId });
        }
        conversationMap.get(convId)!.messages.push(msg);
      });

      // Fetch participant profiles
      const participantIds = Array.from(new Set(
        Array.from(conversationMap.values()).map(c => c.participantId)
      ));

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', participantIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Build conversations list
      const convList: Conversation[] = Array.from(conversationMap.entries()).map(([convId, data]) => {
        const profile = profileMap.get(data.participantId);
        const unreadCount = data.messages.filter(m => m.recipient_id === user?.id && !m.is_read).length;
        
        return {
          id: convId,
          participant: {
            id: data.participantId,
            full_name: profile?.full_name || null,
            email: profile?.email || 'Unbekannt',
          },
          lastMessage: data.messages[0] || null,
          unreadCount,
        };
      });

      // Sort by last message date
      convList.sort((a, b) => {
        const dateA = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
        const dateB = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
        return dateB - dateA;
      });

      // Fragen zu Kandidaten: Kürzel, Stelle, Einreichung und der Name des Headhunters
      // (Profile anderer darf der Kunde nicht lesen, die Suchenden-Liste der Stelle schon).
      const firstOf = (convId: string) => conversationMap.get(convId)?.messages.find((m) => m.job_id && m.candidate_id);
      const ctx = convList.map((c) => firstOf(c.id)).filter(Boolean) as Message[];
      if (ctx.length) {
        const jobIds = [...new Set(ctx.map((m) => m.job_id as string))];
        const [subsRes, jobsRes, searcherLists] = await Promise.all([
          supabase.from('submissions').select('id, job_id, candidate_id').in('job_id', jobIds),
          supabase.from('jobs').select('id, title').in('id', jobIds),
          Promise.all(jobIds.map((j) => getJobSearchers(j).catch(() => null))),
        ]);
        const names = new Map<string, string>();
        for (const list of searcherLists) for (const x of list ?? []) if (x.full_name) names.set(x.recruiter_id, x.full_name);
        for (const conv of convList) {
          const m = firstOf(conv.id);
          if (!m) continue;
          conv.code = candidateAnonCode(m.candidate_id);
          conv.jobTitle = (jobsRes.data ?? []).find((j) => j.id === m.job_id)?.title ?? null;
          conv.submissionId = (subsRes.data ?? []).find((x) => x.job_id === m.job_id && x.candidate_id === m.candidate_id)?.id ?? null;
          if (!conv.participant.full_name) conv.participant.full_name = names.get(conv.participant.id) ?? 'Ihr Headhunter';
        }
      }

      setConversations(convList);
      const linked = linkedConversation ? convList.find((c) => c.id === linkedConversation) : null;
      if (linked) {
        setSelectedConversation(linked);
        fetchMessages(linked.id);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({ title: 'Fehler beim Laden', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    setMessagesLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Mark as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .eq('recipient_id', user?.id);
      
      // Update unread count in conversations
      setConversations(convs => convs.map(c => 
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      ));
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    fetchMessages(conv.id);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;
    setSending(true);

    try {
      if (selectedConversation.submissionId) {
        // Frage zu einem Kandidaten: Glocke und Mail beim Headhunter
        const { data, error: fnError } = await supabase.functions.invoke('client-question', {
          body: { action: 'ask', submission_id: selectedConversation.submissionId, text: newMessage.trim() },
        });
        if (fnError || (data as { error?: string } | null)?.error) throw new Error((data as { error?: string } | null)?.error ?? fnError?.message);
        setNewMessage('');
        fetchMessages(selectedConversation.id);
        return;
      }
      const { error } = await supabase
        .from('messages')
        .insert({
          content: newMessage,
          sender_id: user.id,
          recipient_id: selectedConversation.participant.id,
          conversation_id: selectedConversation.id,
        });

      if (error) throw error;
      
      setNewMessage('');
      fetchMessages(selectedConversation.id);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({ title: 'Fehler beim Senden', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const filteredConversations = conversations.filter(conv => {
    const q = searchQuery.toLowerCase();
    return [conv.participant.full_name, conv.participant.email, conv.code, conv.jobTitle].some((v) => (v ?? '').toLowerCase().includes(q));
  });

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
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Nachrichten</h1>
            <p className="text-muted-foreground">Ihre Fragen an die Headhunter, je Kandidat</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-250px)]">
            {/* Conversations List */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Suchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-380px)]">
                  {filteredConversations.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50" />
                      <p className="text-muted-foreground mt-2">Noch keine Fragen</p>
                      <p className="text-xs text-muted-foreground mt-1 px-6">Fragen stellen Sie im Bewerberprofil über „Frage an …“.</p>
                    </div>
                  ) : (
                    filteredConversations.map((conv) => (
                      <div
                        key={conv.id}
                        onClick={() => handleSelectConversation(conv)}
                        className={`flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors border-b ${
                          selectedConversation?.id === conv.id ? 'bg-muted' : ''
                        }`}
                      >
                        <Avatar>
                          <AvatarFallback>
                            {(conv.participant.full_name || conv.participant.email)
                              .split(' ')
                              .map(n => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium truncate">
                              {conv.participant.full_name || conv.participant.email}
                            </p>
                            {conv.unreadCount > 0 && (
                              <Badge className="bg-primary">{conv.unreadCount}</Badge>
                            )}
                          </div>
                          {conv.code && (
                            <p className="text-xs text-muted-foreground truncate">
                              {conv.code}{conv.jobTitle ? ` · ${conv.jobTitle}` : ''}
                            </p>
                          )}
                          {conv.lastMessage && (
                            <>
                              <p className="text-sm text-muted-foreground truncate">
                                {conv.lastMessage.content}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(conv.lastMessage.created_at), 'PP', { locale: de })}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Messages Area */}
            <Card className="lg:col-span-2 flex flex-col">
              {selectedConversation ? (
                <>
                  <CardHeader className="border-b">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {(selectedConversation.participant.full_name || selectedConversation.participant.email)
                            .split(' ')
                            .map(n => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base">
                          {selectedConversation.participant.full_name || selectedConversation.participant.email}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Headhunter{selectedConversation.code ? ` · zu ${selectedConversation.code}` : ''}
                          {selectedConversation.jobTitle ? ` · ${selectedConversation.jobTitle}` : ''}
                        </p>
                      </div>
                      {selectedConversation.submissionId && (
                        <Button asChild variant="outline" size="sm" className="ml-auto">
                          <Link to={`/dashboard/candidates/${selectedConversation.submissionId}`}>Zum Bewerberprofil</Link>
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 p-4 overflow-hidden">
                    <ScrollArea className="h-[calc(100vh-480px)] pr-4">
                      {messagesLoading ? (
                        <div className="flex items-center justify-center h-full">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {messages.map((msg) => {
                            const isMine = msg.sender_id === user?.id;
                            return (
                              <div
                                key={msg.id}
                                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                              >
                                <div
                                  className={`max-w-[70%] rounded-lg px-4 py-2 ${
                                    isMine
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-muted'
                                  }`}
                                >
                                  <p className="text-sm">{msg.content}</p>
                                  <p className={`text-xs mt-1 ${
                                    isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                  }`}>
                                    {format(new Date(msg.created_at), 'HH:mm', { locale: de })}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                          <div ref={messagesEndRef} />
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                  <div className="p-4 border-t">
                    <div className="flex gap-2">
                      <Input
                        placeholder={selectedConversation.submissionId ? 'Weitere Frage …' : 'Nachricht schreiben …'}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        disabled={sending}
                      />
                      <Button onClick={handleSendMessage} disabled={sending || !newMessage.trim()}>
                        {sending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground/50" />
                    <p className="text-muted-foreground mt-4">
                      Wählen Sie links ein Gespräch aus
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </DashboardLayout>
  );
}