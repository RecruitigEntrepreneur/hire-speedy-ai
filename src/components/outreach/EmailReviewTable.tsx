import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { 
  Check, X, RefreshCw, ChevronDown, ChevronRight, Building2, User, 
  Sparkles, Briefcase, MapPin, Code, ArrowUpDown, Edit2, Save,
  Target, TrendingUp, Zap, UserCheck
} from 'lucide-react';
import { OutreachEmail } from '@/hooks/useOutreach';
import { cn } from '@/lib/utils';

interface EmailReviewTableProps {
  emails: OutreachEmail[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRegenerate: (id: string) => void;
  onBulkApprove: (ids: string[]) => void;
  onBulkReject: (ids: string[]) => void;
  onSave?: (id: string, subject: string, body: string) => void;
  isLoading?: boolean;
}

type SortField = 'confidence' | 'company' | 'date' | 'trigger';
type SortDirection = 'asc' | 'desc';

const TRIGGER_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  hiring: { icon: <Briefcase className="h-3.5 w-3.5" />, label: 'Hiring', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
  transition: { icon: <UserCheck className="h-3.5 w-3.5" />, label: 'Transition', color: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
  technology: { icon: <Code className="h-3.5 w-3.5" />, label: 'Technology', color: 'bg-purple-500/10 text-purple-700 border-purple-500/20' },
  growth: { icon: <TrendingUp className="h-3.5 w-3.5" />, label: 'Growth', color: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  role: { icon: <User className="h-3.5 w-3.5" />, label: 'Role', color: 'bg-muted text-muted-foreground border-border' },
};

const ROLE_LABELS: Record<string, string> = {
  cto: 'CTO/Tech',
  hr: 'HR/Talent',
  founder: 'Founder/CEO',
  manager: 'Manager',
  other: 'Sonstige',
};

const CONFIDENCE_CONFIG: Record<string, { color: string; label: string }> = {
  high: { color: 'bg-emerald-500', label: 'Hoch' },
  medium: { color: 'bg-amber-500', label: 'Mittel' },
  low: { color: 'bg-red-500', label: 'Niedrig' },
  hoch: { color: 'bg-emerald-500', label: 'Hoch' },
  mittel: { color: 'bg-amber-500', label: 'Mittel' },
  niedrig: { color: 'bg-red-500', label: 'Niedrig' },
};

export function EmailReviewTable({ 
  emails, 
  onApprove, 
  onReject, 
  onRegenerate,
  onBulkApprove,
  onBulkReject,
  onSave,
  isLoading 
}: EmailReviewTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('confidence');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === emails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(emails.map(e => e.id)));
    }
  };

  const sortedEmails = [...emails].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'confidence':
        const confidenceOrder: Record<string, number> = { high: 3, hoch: 3, medium: 2, mittel: 2, low: 1, niedrig: 1 };
        comparison = (confidenceOrder[a.trigger_confidence || a.confidence_level || 'medium'] || 2) - 
                    (confidenceOrder[b.trigger_confidence || b.confidence_level || 'medium'] || 2);
        break;
      case 'trigger':
        const triggerOrder: Record<string, number> = { hiring: 5, transition: 4, technology: 3, growth: 2, role: 1 };
        comparison = (triggerOrder[a.trigger_type || 'role'] || 1) - (triggerOrder[b.trigger_type || 'role'] || 1);
        break;
      case 'company':
        comparison = (a.lead?.company_name || '').localeCompare(b.lead?.company_name || '');
        break;
      case 'date':
        comparison = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        break;
    }
    return sortDirection === 'desc' ? -comparison : comparison;
  });

  const getConfidenceConfig = (email: OutreachEmail) => {
    const level = email.trigger_confidence || email.confidence_level || 'medium';
    return CONFIDENCE_CONFIG[level] || CONFIDENCE_CONFIG.medium;
  };

  const startEditing = (email: OutreachEmail) => {
    setEditingId(email.id);
    setEditSubject(email.subject || '');
    setEditBody(email.body || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditSubject('');
    setEditBody('');
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Sparkles className="h-8 w-8 mx-auto mb-2 animate-pulse" />
          Lade E-Mails...
        </CardContent>
      </Card>
    );
  }

  if (!emails.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Check className="h-12 w-12 mx-auto mb-3 text-emerald-500 opacity-50" />
          <p className="font-medium">Alles geprüft!</p>
          <p className="text-sm text-muted-foreground">Keine E-Mails zur Prüfung vorhanden.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{emails.length} E-Mails zur Prüfung</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={sortField} onValueChange={(v) => handleSort(v as SortField)}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <ArrowUpDown className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="confidence">Konfidenz</SelectItem>
                <SelectItem value="trigger">Trigger</SelectItem>
                <SelectItem value="company">Firma</SelectItem>
                <SelectItem value="date">Datum</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 pt-2 mt-2 border-t">
            <span className="text-sm text-muted-foreground">{selectedIds.size} ausgewählt</span>
            <Button 
              size="sm" 
              variant="outline" 
              className="h-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              onClick={() => onBulkApprove(Array.from(selectedIds))}
            >
              <Check className="h-3 w-3 mr-1" />
              Alle freigeben
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => onBulkReject(Array.from(selectedIds))}
            >
              <X className="h-3 w-3 mr-1" />
              Alle ablehnen
            </Button>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="border-t">
          {/* Header Row */}
          <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 text-xs font-medium text-muted-foreground border-b">
            <Checkbox 
              checked={selectedIds.size === emails.length}
              onCheckedChange={toggleSelectAll}
              className="h-4 w-4"
            />
            <div className="w-2" />
            <div className="flex-1">Lead / Betreff</div>
            <div className="w-32 text-center">Trigger</div>
            <div className="w-20 text-right">Aktionen</div>
          </div>

          {/* Email Rows */}
          {sortedEmails.map(email => {
            const triggerConfig = TRIGGER_CONFIG[email.trigger_type || 'role'];
            const confidenceConfig = getConfidenceConfig(email);
            
            return (
              <Collapsible 
                key={email.id} 
                open={expandedId === email.id}
                onOpenChange={(open) => setExpandedId(open ? email.id : null)}
              >
                <div className={cn(
                  "border-b transition-colors",
                  expandedId === email.id && "bg-muted/20"
                )}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30">
                      <Checkbox 
                        checked={selectedIds.has(email.id)}
                        onCheckedChange={() => toggleSelect(email.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4"
                      />
                      
                      {/* Confidence Bar */}
                      <div className={cn("w-1.5 h-8 rounded-full", confidenceConfig.color)} />
                      
                      {/* Lead Info & Subject */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium truncate">{email.lead?.contact_name}</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-sm text-muted-foreground truncate flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {email.lead?.company_name}
                          </span>
                          {email.recipient_role && (
                            <Badge variant="outline" className="h-5 text-[10px] ml-1">
                              {ROLE_LABELS[email.recipient_role] || email.recipient_role}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{email.subject}</p>
                      </div>
                      
                      {/* Trigger Badge */}
                      <div className="w-32 flex justify-center">
                        <Badge 
                          variant="outline" 
                          className={cn("gap-1 font-normal", triggerConfig.color)}
                        >
                          {triggerConfig.icon}
                          {triggerConfig.label}
                        </Badge>
                      </div>
                      
                      {/* Actions */}
                      <div className="w-20 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          onClick={() => onApprove(email.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => onReject(email.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => onRegenerate(email.id)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {expandedId === email.id ? 
                        <ChevronDown className="h-4 w-4 text-muted-foreground" /> : 
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      }
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-4 pb-4 pt-2 ml-8 space-y-4">
                      {/* Email Content */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2 space-y-3">
                          {editingId === email.id ? (
                            <>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Betreff</label>
                                <Input 
                                  value={editSubject}
                                  onChange={(e) => setEditSubject(e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Inhalt</label>
                                <Textarea 
                                  value={editBody}
                                  onChange={(e) => setEditBody(e.target.value)}
                                  className="mt-1 min-h-[200px] text-sm"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={cancelEditing} variant="outline">
                                  Abbrechen
                                </Button>
                                <Button 
                                  size="sm" 
                                  onClick={() => {
                                    if (onSave) {
                                      onSave(email.id, editSubject, editBody);
                                    }
                                    cancelEditing();
                                  }}
                                >
                                  <Save className="h-3 w-3 mr-1" />
                                  Speichern
                                </Button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-medium text-muted-foreground">Betreff</span>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-6 text-xs"
                                    onClick={() => startEditing(email)}
                                  >
                                    <Edit2 className="h-3 w-3 mr-1" />
                                    Bearbeiten
                                  </Button>
                                </div>
                                <p className="font-medium">{email.subject}</p>
                              </div>
                              <div className="p-3 rounded-lg border bg-background">
                                <p className="text-sm whitespace-pre-wrap leading-relaxed">{email.body}</p>
                              </div>
                            </>
                          )}
                        </div>
                        
                        {/* Trigger Analysis Sidebar */}
                        <div className="space-y-3">
                          {/* Trigger Info Card */}
                          <div className="p-3 rounded-lg border-2 border-dashed" style={{ borderColor: 'hsl(var(--primary) / 0.3)' }}>
                            <div className="flex items-center gap-2 mb-2">
                              <Target className="h-4 w-4 text-primary" />
                              <span className="text-xs font-semibold text-primary">Trigger-Analyse</span>
                            </div>
                            
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Primär</span>
                                <Badge 
                                  variant="outline" 
                                  className={cn("gap-1 text-[10px]", triggerConfig.color)}
                                >
                                  {triggerConfig.icon}
                                  {triggerConfig.label}
                                </Badge>
                              </div>
                              
                              {email.trigger_secondary && (
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">Sekundär</span>
                                  <Badge variant="outline" className="gap-1 text-[10px]">
                                    {TRIGGER_CONFIG[email.trigger_secondary]?.icon}
                                    {TRIGGER_CONFIG[email.trigger_secondary]?.label}
                                  </Badge>
                                </div>
                              )}
                              
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Konfidenz</span>
                                <div className="flex items-center gap-1.5">
                                  <div className={cn("w-2 h-2 rounded-full", confidenceConfig.color)} />
                                  <span className="text-xs font-medium">{confidenceConfig.label}</span>
                                </div>
                              </div>
                              
                              {email.recipient_role && (
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">Rolle</span>
                                  <span className="text-xs font-medium">
                                    {ROLE_LABELS[email.recipient_role]}
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            {email.trigger_problem && (
                              <div className="mt-3 pt-2 border-t">
                                <p className="text-xs text-muted-foreground mb-1">Problem erkannt:</p>
                                <p className="text-xs font-medium leading-relaxed">{email.trigger_problem}</p>
                              </div>
                            )}
                          </div>
                          
                          {/* Details */}
                          <div className="p-3 rounded-lg bg-muted/30">
                            <p className="text-xs font-medium text-muted-foreground mb-2">Details</p>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Wörter</span>
                                <span className={cn(
                                  "font-medium",
                                  (email.body?.split(/\s+/).length || 0) > 120 && "text-red-500"
                                )}>
                                  {email.body?.split(/\s+/).length || 0}/120
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Kampagne</span>
                                <span className="font-medium truncate ml-2">{email.campaign?.name || '-'}</span>
                              </div>
                            </div>
                          </div>
                          
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="w-full"
                            onClick={() => onRegenerate(email.id)}
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            Alternative generieren
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
