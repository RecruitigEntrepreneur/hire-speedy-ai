import { useTranslation } from 'react-i18next';
import type { QuestionMessage } from './useClientQuestions';
import { fmtDayMonth } from '@/lib/localeFormat';

const tag = (iso: string) => (iso ? fmtDayMonth(iso) : '');

/** Fragen des Kunden und Antworten des Headhunters, älteste zuerst. */
export function QuestionThreadList({ messages, name }: { messages: QuestionMessage[]; name: string }) {
  const { t } = useTranslation('clientCandidates');
  const last = messages[messages.length - 1];
  return (
    <div className="space-y-2 rounded-md bg-muted/50 p-3 text-sm">
      {messages.map((m) =>
        m.mine ? (
          <div key={m.id}>
            <p className="text-xs text-muted-foreground">{t('questions.you')} · {tag(m.createdAt)}</p>
            <p className="whitespace-pre-wrap">{m.content}</p>
          </div>
        ) : (
          <div key={m.id} className="border-l-2 border-primary/60 pl-2.5">
            <p className="text-xs text-muted-foreground">{name} · {tag(m.createdAt)}</p>
            <p className="whitespace-pre-wrap">{m.content}</p>
          </div>
        ),
      )}
      {last?.mine && <p className="text-xs text-muted-foreground">{t('questions.waiting')}</p>}
    </div>
  );
}
