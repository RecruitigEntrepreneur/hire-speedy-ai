import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Keyboard, Navigation, Zap, List } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShortcutItem {
  keys: string;
  description: string;
  category: 'navigation' | 'actions' | 'list';
}

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: ShortcutItem[];
}

const categoryConfig = {
  navigation: {
    icon: Navigation,
    label: 'Navigation',
    color: 'text-blue-500',
  },
  actions: {
    icon: Zap,
    label: 'Aktionen',
    color: 'text-amber-500',
  },
  list: {
    icon: List,
    label: 'Listen',
    color: 'text-green-500',
  },
};

function KeyBadge({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 text-xs font-mono font-medium bg-muted border border-border rounded shadow-sm">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsHelp({ open, onOpenChange, shortcuts }: KeyboardShortcutsHelpProps) {
  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, ShortcutItem[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" />
            Tastenkürzel
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {Object.entries(groupedShortcuts).map(([category, items]) => {
            const config = categoryConfig[category as keyof typeof categoryConfig];
            const Icon = config?.icon || Keyboard;
            
            return (
              <div key={category}>
                <h3 className={cn(
                  "text-sm font-medium mb-3 flex items-center gap-2",
                  config?.color
                )}>
                  <Icon className="h-4 w-4" />
                  {config?.label || category}
                </h3>
                <div className="space-y-2">
                  {items.map((shortcut, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50"
                    >
                      <span className="text-sm text-muted-foreground">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.split(' + ').map((key, keyIdx) => (
                          <span key={keyIdx} className="flex items-center gap-1">
                            {keyIdx > 0 && <span className="text-muted-foreground text-xs">dann</span>}
                            <KeyBadge>{key.toUpperCase()}</KeyBadge>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          
          {/* Additional common shortcuts */}
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2 text-muted-foreground">
              <List className="h-4 w-4" />
              Allgemein
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                <span className="text-sm text-muted-foreground">Suche öffnen</span>
                <KeyBadge>/</KeyBadge>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                <span className="text-sm text-muted-foreground">Dialog schließen</span>
                <KeyBadge>ESC</KeyBadge>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                <span className="text-sm text-muted-foreground">Liste: Nach unten</span>
                <div className="flex items-center gap-1">
                  <KeyBadge>J</KeyBadge>
                  <span className="text-muted-foreground text-xs">oder</span>
                  <KeyBadge>↓</KeyBadge>
                </div>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                <span className="text-sm text-muted-foreground">Liste: Nach oben</span>
                <div className="flex items-center gap-1">
                  <KeyBadge>K</KeyBadge>
                  <span className="text-muted-foreground text-xs">oder</span>
                  <KeyBadge>↑</KeyBadge>
                </div>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                <span className="text-sm text-muted-foreground">Auswahl öffnen</span>
                <KeyBadge>ENTER</KeyBadge>
              </div>
            </div>
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          Drücke <KeyBadge>?</KeyBadge> um dieses Menü jederzeit zu öffnen
        </div>
      </DialogContent>
    </Dialog>
  );
}
