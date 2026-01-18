import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInterviewAnalytics } from '@/hooks/useInterviewAnalytics';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { 
  Calendar, 
  Clock, 
  Users, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Star,
  Download,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

const dayLabels = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export default function InterviewAnalytics() {
  const [period, setPeriod] = useState('30');
  
  const startDate = new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000);
  const endDate = new Date();

  const { 
    overviewMetrics, 
    interviewerStats, 
    timeSlotStats,
    weeklyTrend,
    isLoading,
  } = useInterviewAnalytics({ start: startDate, end: endDate });

  // Transform time slot data for heatmap
  const heatmapData = Array.from({ length: 7 }, (_, day) => ({
    day: dayLabels[day],
    ...Array.from({ length: 12 }, (_, hour) => {
      const slot = timeSlotStats?.find(s => s.dayOfWeek === day && s.hour === hour + 8);
      return { [`h${hour + 8}`]: slot?.count || 0 };
    }).reduce((acc, curr) => ({ ...acc, ...curr }), {}),
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Interview Analytics</h1>
            <p className="text-muted-foreground">
              Übersicht über Interview-Performance und Metriken
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Letzte 7 Tage</SelectItem>
                <SelectItem value="30">Letzte 30 Tage</SelectItem>
                <SelectItem value="90">Letzte 90 Tage</SelectItem>
                <SelectItem value="365">Letztes Jahr</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Interviews gesamt</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold">{overviewMetrics?.totalInterviews || 0}</p>
                  )}
                </div>
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ø Zeit bis Interview</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-20 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold">
                      {overviewMetrics?.avgTimeToInterview.toFixed(1) || 0} Tage
                    </p>
                  )}
                </div>
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">No-Show Rate</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold">
                      {overviewMetrics?.noShowRate.toFixed(1) || 0}%
                    </p>
                  )}
                </div>
                <AlertTriangle className={`h-8 w-8 ${
                  (overviewMetrics?.noShowRate || 0) > 10 
                    ? 'text-destructive' 
                    : 'text-muted-foreground'
                }`} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Feedback Rate</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold">
                      {overviewMetrics?.feedbackRate.toFixed(0) || 0}%
                    </p>
                  )}
                </div>
                <Star className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weekly Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Interview-Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={weeklyTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="week" 
                      tickFormatter={(v) => new Date(v).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                      className="text-xs"
                    />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="total" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      name="Gesamt"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="completed" 
                      stroke="hsl(var(--accent))" 
                      strokeWidth={2}
                      name="Abgeschlossen"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Interview-Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <div className="flex items-center gap-8">
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Abgeschlossen', value: overviewMetrics?.completedInterviews || 0 },
                          { name: 'Abgesagt', value: overviewMetrics?.cancelledInterviews || 0 },
                          { name: 'Geplant', value: (overviewMetrics?.totalInterviews || 0) - (overviewMetrics?.completedInterviews || 0) - (overviewMetrics?.cancelledInterviews || 0) },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {COLORS.map((color, index) => (
                          <Cell key={`cell-${index}`} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[0] }} />
                      <span className="text-sm">Abgeschlossen</span>
                      <span className="text-sm font-bold ml-auto">
                        {overviewMetrics?.completedInterviews || 0}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[1] }} />
                      <span className="text-sm">Abgesagt</span>
                      <span className="text-sm font-bold ml-auto">
                        {overviewMetrics?.cancelledInterviews || 0}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[2] }} />
                      <span className="text-sm">Geplant</span>
                      <span className="text-sm font-bold ml-auto">
                        {(overviewMetrics?.totalInterviews || 0) - (overviewMetrics?.completedInterviews || 0) - (overviewMetrics?.cancelledInterviews || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Interviewer Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Interviewer-Übersicht
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : interviewerStats && interviewerStats.length > 0 ? (
              <div className="space-y-4">
                {interviewerStats.slice(0, 5).map((stat, index) => (
                  <div key={stat.evaluatorId} className="flex items-center gap-4">
                    <Badge 
                      variant={index === 0 ? 'default' : 'secondary'}
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                    >
                      {index + 1}
                    </Badge>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">
                          Interviewer {stat.evaluatorId.slice(0, 8)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {stat.interviewCount} Interviews
                        </span>
                      </div>
                      <Progress 
                        value={stat.avgRating * 20} 
                        className="h-2"
                      />
                    </div>
                    <div className="flex items-center gap-1 w-16">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      <span className="text-sm font-medium">
                        {stat.avgRating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Noch keine Interviewer-Daten vorhanden.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Time Heatmap - Simplified */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Beliebte Interview-Zeiten
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left p-2 font-medium text-muted-foreground">Tag</th>
                      {Array.from({ length: 10 }, (_, i) => (
                        <th key={i} className="p-2 font-medium text-muted-foreground text-center">
                          {i + 8}:00
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmapData.map((row) => (
                      <tr key={row.day}>
                        <td className="p-2 font-medium">{row.day}</td>
                        {Array.from({ length: 10 }, (_, i) => {
                          const count = (row as Record<string, unknown>)[`h${i + 8}`] as number || 0;
                          const intensity = Math.min(count / 5, 1);
                          return (
                            <td key={i} className="p-1">
                              <div 
                                className="w-8 h-8 rounded flex items-center justify-center text-xs"
                                style={{ 
                                  backgroundColor: `hsl(var(--primary) / ${0.1 + intensity * 0.8})`,
                                  color: intensity > 0.5 ? 'white' : 'inherit',
                                }}
                              >
                                {count > 0 && count}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
