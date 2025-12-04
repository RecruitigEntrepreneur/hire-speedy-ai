import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Search, Activity, User, Briefcase, FileText, UserCheck, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  user_id: string | null;
  details: any;
  created_at: string;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  job: <Briefcase className="h-4 w-4" />,
  submission: <FileText className="h-4 w-4" />,
  placement: <UserCheck className="h-4 w-4" />,
  user: <User className="h-4 w-4" />,
  interview: <Clock className="h-4 w-4" />,
};

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-green-500',
  updated: 'bg-blue-500',
  deleted: 'bg-red-500',
  published: 'bg-purple-500',
  accepted: 'bg-green-500',
  rejected: 'bg-red-500',
  hired: 'bg-green-600',
};

export default function AdminActivity() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setLogs(data);
    }
    setLoading(false);
  };

  const getActionBadge = (action: string) => {
    const color = ACTION_COLORS[action.toLowerCase()] || 'bg-gray-500';
    return (
      <Badge className={`${color} text-white`}>
        {action}
      </Badge>
    );
  };

  const getEntityIcon = (entityType: string | null) => {
    return ACTION_ICONS[entityType || ''] || <Activity className="h-4 w-4" />;
  };

  const formatAction = (log: ActivityLog) => {
    const entityName = log.entity_type || 'Item';
    const details = log.details as Record<string, any> | null;
    
    switch (log.action.toLowerCase()) {
      case 'created':
        return `${entityName} erstellt${details?.title ? `: "${details.title}"` : ''}`;
      case 'updated':
        return `${entityName} aktualisiert${details?.field ? ` (${details.field})` : ''}`;
      case 'deleted':
        return `${entityName} gelöscht`;
      case 'published':
        return `Job veröffentlicht${details?.title ? `: "${details.title}"` : ''}`;
      case 'accepted':
        return `Kandidat akzeptiert${details?.candidate ? `: ${details.candidate}` : ''}`;
      case 'rejected':
        return `Kandidat abgelehnt${details?.candidate ? `: ${details.candidate}` : ''}`;
      case 'hired':
        return `Kandidat eingestellt${details?.candidate ? `: ${details.candidate}` : ''}`;
      default:
        return `${log.action} - ${entityName}`;
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(log.details).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEntity = entityFilter === 'all' || log.entity_type === entityFilter;
    return matchesSearch && matchesEntity;
  });

  const entityTypes = [...new Set(logs.map(l => l.entity_type).filter(Boolean))];

  if (loading) {
    return (
      <>
        <Navbar />
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DashboardLayout>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Aktivitäts-Log</h1>
            <p className="text-muted-foreground mt-1">
              Übersicht aller Systemaktivitäten
            </p>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gesamt Aktivitäten</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{logs.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Heute</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {logs.filter(l => {
                    const today = new Date();
                    const logDate = new Date(l.created_at);
                    return logDate.toDateString() === today.toDateString();
                  }).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Jobs</CardTitle>
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {logs.filter(l => l.entity_type === 'job').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Submissions</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {logs.filter(l => l.entity_type === 'submission').length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suche nach Aktion oder Details..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                {entityTypes.map((type) => (
                  <SelectItem key={type} value={type!}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Activity Feed */}
          <Card>
            <CardHeader>
              <CardTitle>Letzte Aktivitäten</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Keine Aktivitäten gefunden</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredLogs.map((log, index) => (
                    <div 
                      key={log.id} 
                      className={`flex items-start gap-4 pb-4 ${
                        index < filteredLogs.length - 1 ? 'border-b' : ''
                      }`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        {getEntityIcon(log.entity_type)}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{formatAction(log)}</p>
                          {getActionBadge(log.action)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>
                            {formatDistanceToNow(new Date(log.created_at), { 
                              addSuffix: true, 
                              locale: de 
                            })}
                          </span>
                          <span>•</span>
                          <span>
                            {format(new Date(log.created_at), 'PPp', { locale: de })}
                          </span>
                        </div>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <div className="mt-2 text-sm text-muted-foreground bg-muted/50 rounded p-2">
                            <pre className="whitespace-pre-wrap">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </>
  );
}
