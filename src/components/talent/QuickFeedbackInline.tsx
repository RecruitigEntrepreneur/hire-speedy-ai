import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ThumbsUp, Meh, ThumbsDown, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickFeedbackInlineProps {
  onSubmit: (rating: 'positive' | 'neutral' | 'negative', note?: string) => Promise<void>;
  onCancel: () => void;
}

export function QuickFeedbackInline({ onSubmit, onCancel }: QuickFeedbackInlineProps) {
  const [rating, setRating] = useState<'positive' | 'neutral' | 'negative' | null>(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!rating) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(rating, note || undefined);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-muted/50 rounded-lg p-3 mb-3 space-y-3" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">Wie war das Interview?</span>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6"
          onClick={onCancel}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      
      {/* Rating Buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "flex-1 h-10 text-xs gap-1.5 transition-all",
            rating === 'positive' && "bg-green-100 border-green-400 text-green-700 hover:bg-green-100"
          )}
          onClick={() => setRating('positive')}
        >
          <ThumbsUp className="h-4 w-4" />
          Weiter
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "flex-1 h-10 text-xs gap-1.5 transition-all",
            rating === 'neutral' && "bg-amber-100 border-amber-400 text-amber-700 hover:bg-amber-100"
          )}
          onClick={() => setRating('neutral')}
        >
          <Meh className="h-4 w-4" />
          Unsicher
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "flex-1 h-10 text-xs gap-1.5 transition-all",
            rating === 'negative' && "bg-red-100 border-red-400 text-red-700 hover:bg-red-100"
          )}
          onClick={() => setRating('negative')}
        >
          <ThumbsDown className="h-4 w-4" />
          Ablehnen
        </Button>
      </div>

      {/* Note Field (shows after rating) */}
      {rating && (
        <>
          <Textarea
            placeholder="Kurze Notiz (optional)..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-[60px] text-xs resize-none"
          />
          <Button 
            size="sm" 
            className="w-full h-8 text-xs"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Feedback speichern'
            )}
          </Button>
        </>
      )}
    </div>
  );
}
