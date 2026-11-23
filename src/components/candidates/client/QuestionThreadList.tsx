import { useTranslation } from 'react-i18next';
import type { QuestionMessage } from './useClientQuestions';
import { fmtDayMonth } from '@/lib/localeFormat';

const tag = (iso: string) => (iso ? fmtDayMonth(iso) : '');

/** Fragen des Kunden und Antworten des Headhunters, älteste zuerst. */
export function QuestionThreadList({ messages, name, blasen = false }: { messages: QuestionMessage[]; name: string; /** Gespräch mit Blasen (Frage-Fenster, C1) */ blasen?: boolean }) {
  const { t } = useTranslation('clientCandidates');
  const last = messages[messages.length - 1];
  if (blasen) {
    return (
      <div className="space-y-2 text-sm">
        {messages.map((m) => (
          <div key={m.id} className={m.mine ? 'text-right' : 'text-left'}>
            <p className="mb-0.5 text-[11px] text-muted-foreground">{m.mine ? t('questions.you') : name} · {tag(m.createdAt)}</p>
            <p className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-1.5 text-left ${m.mine ? 'bg-klick text-klick-foreground' : 'bg-secondary'}`}>{m.content}</p>
          </div>
        ))}
        {last?.mine && <p className="text-right text-xs text-muted-foreground">{t('questions.waiting')}</p>}
      </div>
    );
  }
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
