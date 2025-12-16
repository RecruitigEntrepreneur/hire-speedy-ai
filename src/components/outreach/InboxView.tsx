import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, ThumbsUp, Minus, Reply, Check } from "lucide-react";
import { useOutreachConversations } from "@/hooks/useOutreach";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export function InboxView() {
  const { data: conversations, isLoading } = useOutreachConversations();

  // Filter conversations that have replies
  const replies = conversations?.filter(c => c.message_count > 0) || [];
  const positiveReplies = replies.filter(r => r.sentiment === 'positive');
  const neutralReplies = replies.filter(r => r.sentiment === 'neutral' || !r.sentiment);
  const negativeReplies = replies.filter(r => r.sentiment === 'negative');

  const ReplyCard = ({ conversation }: { conversation: any }) => (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-medium">
            {conversation.lead?.first_name || conversation.lead?.contact_name} {conversation.lead?.last_name || ''}
            {conversation.lead?.company_name && (
              <span className="text-muted-foreground ml-2">
                @ {conversation.lead.company_name}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {conversation.last_message_at && format(new Date(conversation.last_message_at), 'dd.MM.yyyy HH:mm', { locale: de })}
          </div>
        </div>
        <Badge 
          variant={
            conversation.sentiment === 'positive' ? 'default' : 
            conversation.sentiment === 'negative' ? 'destructive' : 
            'secondary'
          }
        >
          {conversation.sentiment === 'positive' ? 'Positiv' : 
           conversation.sentiment === 'negative' ? 'Negativ' : 
           'Neutral'}
        </Badge>
      </div>

      <div className="border rounded-lg p-3 bg-muted/30 text-sm mb-4">
        {conversation.subject || 'Keine Betreff'}
        <div className="text-xs text-muted-foreground mt-1">
          {conversation.message_count} Nachrichten
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="outline">
          <Reply className="h-4 w-4 mr-2" />
          Antworten
        </Button>
        {conversation.sentiment === 'positive' && (
          <Button size="sm">
            <Check className="h-4 w-4 mr-2" />
            Als Deal markieren
          </Button>
        )}
      </div>
    </Card>
  );

  return (
    <div>
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">
            Alle ({replies.length})
          </TabsTrigger>
          <TabsTrigger value="positive" className="text-green-600">
            <ThumbsUp className="h-4 w-4 mr-2" />
            Positiv ({positiveReplies.length})
          </TabsTrigger>
          <TabsTrigger value="neutral">
            <Minus className="h-4 w-4 mr-2" />
            Neutral ({neutralReplies.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Laden...</div>
          ) : !replies.length ? (
            <Card className="p-8 text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">Noch keine Antworten</h3>
              <p className="text-sm text-muted-foreground">
                Antworten auf Ihre E-Mails erscheinen hier
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {replies.map((conversation) => (
                <ReplyCard key={conversation.id} conversation={conversation} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="positive" className="mt-6">
          {positiveReplies.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              Keine positiven Antworten
            </Card>
          ) : (
            <div className="space-y-4">
              {positiveReplies.map((conversation) => (
                <ReplyCard key={conversation.id} conversation={conversation} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="neutral" className="mt-6">
          {neutralReplies.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              Keine neutralen Antworten
            </Card>
          ) : (
            <div className="space-y-4">
              {neutralReplies.map((conversation) => (
                <ReplyCard key={conversation.id} conversation={conversation} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
