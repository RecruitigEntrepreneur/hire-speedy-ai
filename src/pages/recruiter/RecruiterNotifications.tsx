import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  Bell,
  CheckCircle2,
  XCircle,
  Calendar,
  MessageSquare,
  DollarSign,
  UserCheck,
  Check,
  Trash2,
  Shield,
  Lock,
  Unlock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIdentityUnlock } from '@/hooks/useIdentityUnlock';
import { OptInResponseDialog } from '@/components/dialogs/OptInResponseDialog';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  related_id: string;
  related_type: string;
  is_read: boolean;
  created_at: string;
}

const NOTIFICATION_ICONS: Record<string, any> = {
  candidate_accepted: CheckCircle2,
  candidate_rejected: XCircle,
  interview_scheduled: Calendar,
  feedback_required: MessageSquare,
  placement_confirmed: DollarSign,
  payout_processed: DollarSign,
  opt_in_request: Shield,
  opt_in_approved: Unlock,
  opt_in_denied: Lock,
  default: Bell
};

const NOTIFICATION_COLORS: Record<string, string> = {
  candidate_accepted: 'text-emerald bg-emerald/10',
  candidate_rejected: 'text-destructive bg-destructive/10',
  interview_scheduled: 'text-purple-500 bg-purple-500/10',
  feedback_required: 'text-amber-500 bg-amber-500/10',
  placement_confirmed: 'text-emerald bg-emerald/10',
  payout_processed: 'text-blue-500 bg-blue-500/10',
  opt_in_request: 'text-primary bg-primary/10',
  opt_in_approved: 'text-emerald bg-emerald/10',
  opt_in_denied: 'text-destructive bg-destructive/10',
  default: 'text-muted-foreground bg-muted'
};

export default function RecruiterNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { respondToOptIn, loading: optInLoading } = useIdentityUnlock();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [optInDialogOpen, setOptInDialogOpen] = useState(false);
  const [selectedOptInNotification, setSelectedOptInNotification] = useState<Notification | null>(null);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setNotifications(data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('is_read', false);

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast({ title: 'Alle als gelesen markiert' });
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Gerade eben';
    if (diffMinutes < 60) return `Vor ${diffMinutes} Min.`;
    if (diffMinutes < 1440) return `Vor ${Math.floor(diffMinutes / 60)} Std.`;
    if (diffMinutes < 2880) return 'Gestern';
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  const getNotificationLink = (notification: Notification) => {
    if (!notification.related_id) return null;
    
    // Don't link opt_in_request - handle with dialog instead
    if (notification.type === 'opt_in_request') return null;
    
    switch (notification.related_type) {
      case 'job':
        return `/recruiter/jobs/${notification.related_id}`;
      case 'submission':
        return '/recruiter/submissions';
      case 'placement':
        return '/recruiter/earnings';
      default:
        return null;
    }
  };

  const handleOptInClick = (notification: Notification) => {
    setSelectedOptInNotification(notification);
    setOptInDialogOpen(true);
  };

  const handleOptInApprove = async (submissionId: string) => {
    await respondToOptIn(submissionId, true);
    setOptInDialogOpen(false);
    setSelectedOptInNotification(null);
    fetchNotifications();
  };

  const handleOptInDeny = async (submissionId: string, reason: string) => {
    await respondToOptIn(submissionId, false, reason);
    setOptInDialogOpen(false);
    setSelectedOptInNotification(null);
    fetchNotifications();
  };

  const filteredNotifications = notifications.filter(n => 
    filter === 'all' || !n.is_read
  );

  const unreadCount = notifications.filter(n => !n.is_read).length;

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
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Benachrichtigungen</h1>
              <p className="text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} ungelesene Nachrichten` : 'Alle Nachrichten gelesen'}
              </p>
            </div>
            {unreadCount > 0 && (
              <Button variant="outline" onClick={markAllAsRead}>
                <Check className="h-4 w-4 mr-2" />
                Alle als gelesen markieren
              </Button>
            )}
          </div>

          {/* Filter Tabs */}
          <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')}>
            <TabsList>
              <TabsTrigger value="all">
                Alle
                <Badge variant="secondary" className="ml-2">{notifications.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="unread">
                Ungelesen
                {unreadCount > 0 && (
                  <Badge className="ml-2 bg-destructive">{unreadCount}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Notifications List */}
          <Card>
            <CardContent className="p-0">
              {filteredNotifications.length === 0 ? (
                <div className="text-center py-16">
                  <Bell className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">Keine Benachrichtigungen</h3>
                  <p className="text-muted-foreground">
                    {filter === 'unread' 
                      ? 'Alle Nachrichten wurden gelesen'
                      : 'Du hast noch keine Benachrichtigungen erhalten'}
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredNotifications.map((notification) => {
                    const Icon = NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.default;
                    const colorClass = NOTIFICATION_COLORS[notification.type] || NOTIFICATION_COLORS.default;
                    const link = getNotificationLink(notification);

                    const content = (
                      <div 
                        className={`p-4 flex items-start gap-4 transition-colors ${
                          !notification.is_read ? 'bg-primary/5' : 'hover:bg-muted/30'
                        }`}
                        onClick={() => !notification.is_read && markAsRead(notification.id)}
                      >
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className={`font-medium ${!notification.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {notification.title}
                              </p>
                              {notification.message && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {notification.message}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs text-muted-foreground">
                                {formatTime(notification.created_at)}
                              </span>
                                {!notification.is_read && (
                                <div className="h-2 w-2 rounded-full bg-primary" />
                              )}
                            </div>
                          </div>
                          
                          {/* Opt-In Action Buttons */}
                          {notification.type === 'opt_in_request' && (
                            <div className="mt-3 flex gap-2">
                              <Button 
                                size="sm" 
                                className="bg-emerald hover:bg-emerald/90"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleOptInClick(notification);
                                }}
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Bearbeiten
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );

                    return link ? (
                      <Link key={notification.id} to={link}>
                        {content}
                      </Link>
                    ) : (
                      <div key={notification.id} className="cursor-pointer">
                        {content}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Opt-In Response Dialog */}
        {selectedOptInNotification && (
          <OptInResponseDialog
            open={optInDialogOpen}
            onOpenChange={setOptInDialogOpen}
            submissionId={selectedOptInNotification.related_id || ''}
            candidateName="Kandidat"
            jobIndustry="Branche"
            onApprove={handleOptInApprove}
            onDeny={handleOptInDeny}
          />
        )}
      </DashboardLayout>
    </div>
  );
}