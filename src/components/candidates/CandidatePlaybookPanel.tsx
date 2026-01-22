import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  BookOpen, 
  Phone, 
  Mail, 
  MessageSquare, 
  Copy, 
  Check, 
  Lightbulb,
  Shield,
  ChevronUp,
  Sparkles,
  CheckSquare,
  AlertTriangle,
  ThumbsUp,
  MessageCircle
} from 'lucide-react';
import { CoachingPlaybook } from '@/hooks/useCoachingPlaybook';
import { toast } from 'sonner';

interface CandidatePlaybookPanelProps {
  playbook: CoachingPlaybook | null;
  alertTitle?: string;
  candidateName?: string;
  companyName?: string;
  onClose?: () => void;
}

export function CandidatePlaybookPanel({
  playbook,
  alertTitle,
  candidateName = '[Name]',
  companyName = '[Firma]',
}: CandidatePlaybookPanelProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  if (!playbook) return null;

  const replacePlaceholders = (text: string) => {
    return text
      .replace(/\[Name\]/g, candidateName)
      .replace(/\[Firma\]/g, companyName)
      .replace(/\[Unternehmen\]/g, companyName)
      .replace(/\[CANDIDATE_NAME\]/g, candidateName)
      .replace(/\[COMPANY_NAME\]/g, companyName);
  };

  const copyToClipboard = async (text: string, field: string) => {
    const processedText = replacePlaceholders(text);
    await navigator.clipboard.writeText(processedText);
    setCopiedField(field);
    toast.success('In Zwischenablage kopiert');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const toggleCheckItem = (item: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(item)) {
      newChecked.delete(item);
    } else {
      newChecked.add(item);
    }
    setCheckedItems(newChecked);
  };

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2"
      onClick={() => copyToClipboard(text, field)}
    >
      {copiedField === field ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );

  // Compact collapsed state
  if (!isExpanded) {
    return (
      <Card className="border-muted hover:border-primary/30 transition-colors">
        <button 
          onClick={() => setIsExpanded(true)}
          className="w-full p-3 flex items-center justify-between text-left hover:bg-accent/30 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2 text-sm min-w-0">
            <Lightbulb className="h-4 w-4 text-primary shrink-0" />
            <span className="text-muted-foreground shrink-0">Hilfe:</span>
            <span className="font-medium truncate">{alertTitle || playbook.title}</span>
          </div>
          <Badge variant="outline" className="text-xs shrink-0 ml-2">
            Tipps
          </Badge>
        </button>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" />
            Coaching-Playbook
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setIsExpanded(false)}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
        </div>
        {alertTitle && (
          <Badge variant="secondary" className="w-fit text-xs mt-1">
            <Sparkles className="h-3 w-3 mr-1" />
            {alertTitle}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="pt-2 space-y-4">
        {/* Quick Checklist */}
        {playbook.quick_checklist && playbook.quick_checklist.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckSquare className="h-4 w-4 text-primary" />
              Quick-Checklist
            </div>
            <div className="space-y-1.5 pl-1">
              {playbook.quick_checklist.map((item, i) => (
                <label 
                  key={i} 
                  className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/30 p-1 rounded"
                >
                  <Checkbox 
                    checked={checkedItems.has(item)}
                    onCheckedChange={() => toggleCheckItem(item)}
                    className="h-4 w-4"
                  />
                  <span className={checkedItems.has(item) ? 'line-through text-muted-foreground' : ''}>
                    {item}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Sample Phrases */}
        {playbook.sample_phrases && playbook.sample_phrases.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MessageCircle className="h-4 w-4 text-primary" />
              Formulierungen
            </div>
            <div className="space-y-2">
              {playbook.sample_phrases.map((group, i) => (
                <div key={i} className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">{group.category}</span>
                  {group.phrases.map((phrase, j) => (
                    <div 
                      key={j} 
                      className="flex items-center justify-between p-2 bg-muted/50 rounded-md text-sm group"
                    >
                      <span className="flex-1 pr-2">"{replacePlaceholders(phrase)}"</span>
                      <CopyButton text={phrase} field={`phrase-${i}-${j}`} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Talking Points */}
        {playbook.talking_points?.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lightbulb className="h-4 w-4 text-primary" />
              Talking Points
            </div>
            <ul className="space-y-1.5 pl-6">
              {playbook.talking_points.map((point, i) => (
                <li key={i} className="text-sm text-muted-foreground list-disc">
                  {replacePlaceholders(point)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Red Flags & Success Indicators */}
        <div className="grid grid-cols-2 gap-3">
          {playbook.red_flags && playbook.red_flags.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Red Flags
              </div>
              <ul className="space-y-1 text-xs">
                {playbook.red_flags.slice(0, 4).map((flag, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-destructive mt-0.5">•</span>
                    <span className="text-muted-foreground">{flag}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {playbook.success_indicators && playbook.success_indicators.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                <ThumbsUp className="h-4 w-4" />
                Gute Zeichen
              </div>
              <ul className="space-y-1 text-xs">
                {playbook.success_indicators.slice(0, 4).map((indicator, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-emerald-600 mt-0.5">•</span>
                    <span className="text-muted-foreground">{indicator}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Objection Handlers */}
        {playbook.objection_handlers?.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Shield className="h-4 w-4 text-primary" />
              Bei Einwänden
            </div>
            <div className="space-y-2">
              {playbook.objection_handlers.slice(0, 4).map((handler, i) => (
                <div key={i} className="p-2 bg-muted/50 rounded-md text-sm">
                  <p className="font-medium text-xs text-muted-foreground mb-1">
                    "{handler.objection}"
                  </p>
                  <p className="text-foreground">→ {replacePlaceholders(handler.response)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions Tabs */}
        <Tabs defaultValue="phone" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="phone" className="text-xs gap-1">
              <Phone className="h-3 w-3" />
              Telefon
            </TabsTrigger>
            <TabsTrigger value="email" className="text-xs gap-1">
              <Mail className="h-3 w-3" />
              Email
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="text-xs gap-1">
              <MessageSquare className="h-3 w-3" />
              WhatsApp
            </TabsTrigger>
          </TabsList>

          <TabsContent value="phone" className="mt-2">
            {playbook.phone_script ? (
              <div className="relative">
                <ScrollArea className="h-40 rounded-md border bg-muted/30 p-3">
                  <p className="text-sm whitespace-pre-wrap pr-6">
                    {replacePlaceholders(playbook.phone_script)}
                  </p>
                </ScrollArea>
                <div className="absolute top-2 right-2">
                  <CopyButton text={playbook.phone_script} field="phone" />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Kein Telefon-Skript verfügbar
              </p>
            )}
          </TabsContent>

          <TabsContent value="email" className="mt-2">
            {playbook.email_template ? (
              <div className="relative">
                <ScrollArea className="h-40 rounded-md border bg-muted/30 p-3">
                  <p className="text-sm whitespace-pre-wrap pr-6">
                    {replacePlaceholders(playbook.email_template)}
                  </p>
                </ScrollArea>
                <div className="absolute top-2 right-2">
                  <CopyButton text={playbook.email_template} field="email" />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Keine Email-Vorlage verfügbar
              </p>
            )}
          </TabsContent>

          <TabsContent value="whatsapp" className="mt-2">
            {playbook.whatsapp_template ? (
              <div className="relative">
                <ScrollArea className="h-40 rounded-md border bg-muted/30 p-3">
                  <p className="text-sm whitespace-pre-wrap pr-6">
                    {replacePlaceholders(playbook.whatsapp_template)}
                  </p>
                </ScrollArea>
                <div className="absolute top-2 right-2">
                  <CopyButton text={playbook.whatsapp_template} field="whatsapp" />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Keine WhatsApp-Vorlage verfügbar
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
