import React, { useState, useRef, useEffect } from 'react';
import { 
  Star, 
  AlertTriangle, 
  HelpCircle, 
  MessageSquare, 
  Pin, 
  Trash2,
  Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { InterviewNote, NoteType } from '@/hooks/useLiveInterviewNotes';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface LiveNotesPanelProps {
  notes: InterviewNote[];
  pinnedNotes: InterviewNote[];
  elapsedSeconds: number;
  onAddNote: (content: string, type: NoteType, timestamp?: number) => void;
  onTogglePin: (noteId: string) => void;
  onDeleteNote: (noteId: string) => void;
}

const NOTE_TYPE_CONFIG: Record<NoteType, { icon: React.ElementType; label: string; color: string; bgColor: string }> = {
  general: { icon: MessageSquare, label: 'Allgemein', color: 'text-muted-foreground', bgColor: 'bg-muted' },
  strength: { icon: Star, label: 'Stärke', color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  concern: { icon: AlertTriangle, label: 'Bedenken', color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  question: { icon: HelpCircle, label: 'Nachfrage', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
};

export function LiveNotesPanel({
  notes,
  pinnedNotes,
  elapsedSeconds,
  onAddNote,
  onTogglePin,
  onDeleteNote,
}: LiveNotesPanelProps) {
  const [input, setInput] = useState('');
  const [selectedType, setSelectedType] = useState<NoteType>('general');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new notes are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [notes.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onAddNote(input.trim(), selectedType, elapsedSeconds);
      setInput('');
      setSelectedType('general');
    }
  };

  const formatTimestamp = (seconds: number | null): string => {
    if (seconds === null) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCreatedAt = (dateStr: string): string => {
    return new Date(dateStr).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only when not typing in an input
      if (document.activeElement?.tagName === 'INPUT') return;

      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault();
          inputRef.current?.focus();
          break;
        case 's':
          e.preventDefault();
          setSelectedType('strength');
          inputRef.current?.focus();
          break;
        case 'c':
          e.preventDefault();
          setSelectedType('concern');
          inputRef.current?.focus();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Pinned highlights */}
      {pinnedNotes.length > 0 && (
        <div className="p-3 border-b bg-muted/30">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Pin className="h-3.5 w-3.5" />
            Highlights
          </h4>
          <div className="space-y-1.5">
            {pinnedNotes.map(note => {
              const config = NOTE_TYPE_CONFIG[note.note_type as NoteType];
              const Icon = config.icon;
              return (
                <div
                  key={note.id}
                  className={cn(
                    "flex items-start gap-2 p-2 rounded-md text-sm",
                    config.bgColor
                  )}
                >
                  <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", config.color)} />
                  <span className="flex-1">{note.content}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onTogglePin(note.id)}
                  >
                    <Pin className="h-3 w-3 fill-current" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Notes list */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-3 space-y-2">
          {notes.filter(n => !n.is_pinned).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Noch keine Notizen</p>
              <p className="text-xs mt-1">
                Drücke <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">N</kbd> für neue Notiz
              </p>
            </div>
          ) : (
            notes.filter(n => !n.is_pinned).map(note => {
              const config = NOTE_TYPE_CONFIG[note.note_type as NoteType];
              const Icon = config.icon;
              return (
                <div
                  key={note.id}
                  className="group flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", config.color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{note.content}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {note.timestamp_seconds !== null && (
                        <span className="font-mono">{formatTimestamp(note.timestamp_seconds)} • </span>
                      )}
                      {formatCreatedAt(note.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onTogglePin(note.id)}
                          >
                            <Pin className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Anheften</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => onDeleteNote(note.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Löschen</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="p-3 border-t space-y-2">
        {/* Type selector */}
        <div className="flex items-center gap-1">
          {(Object.entries(NOTE_TYPE_CONFIG) as [NoteType, typeof NOTE_TYPE_CONFIG[NoteType]][]).map(([type, config]) => {
            const Icon = config.icon;
            return (
              <TooltipProvider key={type}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant={selectedType === type ? "secondary" : "ghost"}
                      size="sm"
                      className={cn(
                        "h-8 px-2",
                        selectedType === type && config.bgColor
                      )}
                      onClick={() => setSelectedType(type)}
                    >
                      <Icon className={cn("h-4 w-4", selectedType === type && config.color)} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{config.label}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>

        {/* Note input */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Notiz hinzufügen..."
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
