import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, 
  Mail, 
  MessageSquare, 
  Copy, 
  Check,
  ChevronRight
} from 'lucide-react';
import { CoachingPlaybook } from '@/hooks/useCoachingPlaybook';
import { toast } from 'sonner';

interface PlaybookViewerProps {
  playbook: CoachingPlaybook | null;
  open: boolean;
  onClose: () => void;
  candidateName?: string;
  companyName?: string;
}

export function PlaybookViewer({ 
  playbook, 
  open, 
  onClose,
  candidateName = '[Name]',
  companyName = '[Firma]'
}: PlaybookViewerProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    // Replace placeholders
    const processed = text
      .replace(/\[Name\]/g, candidateName)
      .replace(/\[Firma\]/g, companyName);

    await navigator.clipboard.writeText(processed);
    setCopiedField(field);
    toast.success('In Zwischenablage kopiert');
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!playbook) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            📋 {playbook.title}
          </SheetTitle>
          <SheetDescription>
            {playbook.description}
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="phone" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="phone" className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              Telefon
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              Email
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              WhatsApp
            </TabsTrigger>
          </TabsList>

          {/* Phone Script */}
          <TabsContent value="phone" className="space-y-4">
            {playbook.phone_script && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Telefon-Skript</CardTitle>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(playbook.phone_script!, 'phone')}
                    >
                      {copiedField === 'phone' ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md">
                    {playbook.phone_script
                      .replace(/\[Name\]/g, candidateName)
                      .replace(/\[Firma\]/g, companyName)}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Talking Points */}
            {playbook.talking_points.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">💬 Talking Points</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {playbook.talking_points.map((point, idx) => (
                      <li key={idx} className="text-sm flex items-start gap-2">
                        <ChevronRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Objection Handlers */}
            {playbook.objection_handlers.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">🛡️ Einwand-Behandlung</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {playbook.objection_handlers.map((handler, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="text-sm font-medium text-red-600">
                        "{handler.objection}"
                      </div>
                      <div className="text-sm text-muted-foreground pl-4 border-l-2 border-emerald-500">
                        → {handler.response}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Email Template */}
          <TabsContent value="email" className="space-y-4">
            {playbook.email_template ? (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Email-Vorlage</CardTitle>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(playbook.email_template!, 'email')}
                    >
                      {copiedField === 'email' ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md">
                    {playbook.email_template
                      .replace(/\[Name\]/g, candidateName)
                      .replace(/\[Firma\]/g, companyName)}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Keine Email-Vorlage verfügbar
              </div>
            )}
          </TabsContent>

          {/* WhatsApp Template */}
          <TabsContent value="whatsapp" className="space-y-4">
            {playbook.whatsapp_template ? (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">WhatsApp-Vorlage</CardTitle>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(playbook.whatsapp_template!, 'whatsapp')}
                    >
                      {copiedField === 'whatsapp' ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md">
                    {playbook.whatsapp_template
                      .replace(/\[Name\]/g, candidateName)
                      .replace(/\[Firma\]/g, companyName)}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Keine WhatsApp-Vorlage verfügbar
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
