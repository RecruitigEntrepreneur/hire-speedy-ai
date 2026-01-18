import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickRatingStarsProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  maxStars?: number;
}

export function QuickRatingStars({ 
  label, 
  value, 
  onChange, 
  maxStars = 5 
}: QuickRatingStarsProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const displayValue = hoverValue ?? value;

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground min-w-[100px]">{label}:</span>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: maxStars }, (_, i) => i + 1).map((star) => (
          <button
            key={star}
            type="button"
            className="p-0.5 hover:scale-110 transition-transform"
            onMouseEnter={() => setHoverValue(star)}
            onMouseLeave={() => setHoverValue(null)}
            onClick={() => onChange(star)}
          >
            <Star
              className={cn(
                "h-5 w-5 transition-colors",
                star <= displayValue
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/30"
              )}
            />
          </button>
        ))}
        {value > 0 && (
          <span className="ml-2 text-xs text-muted-foreground">
            ({value * 20}%)
          </span>
        )}
      </div>
    </div>
  );
}
