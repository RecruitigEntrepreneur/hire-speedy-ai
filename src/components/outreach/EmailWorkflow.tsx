import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Check, Edit2, RefreshCw, Send, Mail, Eye } from "lucide-react";
import { useOutreachEmails, useApproveEmail, useRejectEmail } from "@/hooks/useOutreach";
import { useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export function EmailWorkflow() {
  const { data: emails, isLoading } = useOutreachEmails();
  const approveMutation = useApproveEmail();
  const rejectMutation = useRejectEmail();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<{ subject: string; body: string }>({ subject: '', body: '' });

  const pendingEmails = emails?.filter(e => e.status === 'draft' || e.status === 'pending_review') || [];
  const sentEmails = emails?.filter(e => e.status === 'sent' || e.status === 'delivered') || [];

  const handleStartEdit = (email: any) => {
    setEditingId(email.id);
    setEditedContent({ subject: email.subject || '', body: email.body || '' });
  };

  const handleSave = async (emailId: string) => {
    // For now just close edit mode - actual save would need mutation
    setEditingId(null);
  };

  const handleApprove = (emailId: string) => {
    approveMutation.mutate(emailId);
  };

  return (
    <div className="space-y-8">
      {/* Pending Emails */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Edit2 className="h-5 w-5" />
          Zu reviewen ({pendingEmails.length})
        </h2>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Laden...</div>
        ) : pendingEmails.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            Keine E-Mails zum Reviewen.
            <br />
            <span className="text-sm">Generieren Sie E-Mails im Unternehmen-Tab.</span>
          </Card>
        ) : (
          <div className="space-y-4">
            {pendingEmails.map((email) => (
              <Card key={email.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-medium">
                      An: {email.lead?.first_name || email.lead?.contact_name} {email.lead?.last_name || ''}
                      {email.lead?.contact_role && (
                        <span className="text-muted-foreground ml-2">
                          ({email.lead.contact_role} @ {email.lead?.company_name || 'Unbekannt'})
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{email.lead?.contact_email}</div>
                  </div>
                  <Badge variant="outline">
                    {email.trigger_type || 'Manuell'}
                  </Badge>
                </div>

                {editingId === email.id ? (
                  <div className="space-y-3">
                    <Input
                      value={editedContent.subject}
                      onChange={(e) => setEditedContent(prev => ({ ...prev, subject: e.target.value }))}
                      placeholder="Betreff"
                    />
                    <Textarea
                      value={editedContent.body}
                      onChange={(e) => setEditedContent(prev => ({ ...prev, body: e.target.value }))}
                      rows={8}
                      className="font-mono text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSave(email.id)}>
                        <Check className="h-4 w-4 mr-2" />
                        Speichern
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="border rounded-lg p-3 bg-muted/30">
                      <div className="font-medium text-sm mb-2">
                        Betreff: {email.subject}
                      </div>
                      <div className="text-sm whitespace-pre-wrap">
                        {email.body?.slice(0, 300)}
                        {(email.body?.length || 0) > 300 && '...'}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <div className="text-xs text-muted-foreground">
                        Confidence: {email.trigger_confidence || email.confidence_level || 'N/A'}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleStartEdit(email)}
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Bearbeiten
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => rejectMutation.mutate(email.id)}
                          disabled={rejectMutation.isPending}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Neu generieren
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => handleApprove(email.id)}
                          disabled={approveMutation.isPending}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Absenden
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Sent Today */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Gesendet ({sentEmails.length})
        </h2>

        {sentEmails.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            Noch keine E-Mails gesendet
          </Card>
        ) : (
          <div className="space-y-2">
            {sentEmails.slice(0, 10).map((email) => (
              <Card key={email.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="font-medium">
                        {email.lead?.first_name || email.lead?.contact_name} {email.lead?.last_name || ''}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        ({email.lead?.company_name || 'Unbekannt'})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {email.opened_at ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <Eye className="h-3 w-3 mr-1" />
                        Geöffnet
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Nicht geöffnet
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {email.sent_at && format(new Date(email.sent_at), 'dd.MM. HH:mm', { locale: de })}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
