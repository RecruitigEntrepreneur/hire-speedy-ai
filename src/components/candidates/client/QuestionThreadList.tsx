import type { QuestionMessage } from './useClientQuestions';

const tag = (iso: string) => (iso ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '');

/** Fragen des Kunden und Antworten des Headhunters, älteste zuerst. */
export function QuestionThreadList({ messages, name }: { messages: QuestionMessage[]; name: string }) {
  const last = messages[messages.length - 1];
  return (
    <div className="space-y-2 rounded-md bg-muted/50 p-3 text-sm">
      {messages.map((m) =>
        m.mine ? (
          <div key={m.id}>
            <p className="text-xs text-muted-foreground">Sie · {tag(m.createdAt)}</p>
            <p className="whitespace-pre-wrap">{m.content}</p>
          </div>
        ) : (
          <div key={m.id} className="border-l-2 border-primary/60 pl-2.5">
            <p className="text-xs text-muted-foreground">{name} · {tag(m.createdAt)}</p>
            <p className="whitespace-pre-wrap">{m.content}</p>
          </div>
        ),
      )}
      {last?.mine && <p className="text-xs text-muted-foreground">wartet auf Antwort</p>}
    </div>
  );
}
