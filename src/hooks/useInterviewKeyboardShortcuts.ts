import { useEffect, useCallback } from 'react';

interface UseInterviewKeyboardShortcutsProps {
  onToggleView?: () => void;
  onNextInterview?: () => void;
  onFocusSearch?: () => void;
  onCloseDialog?: () => void;
  enabled?: boolean;
}

export function useInterviewKeyboardShortcuts({
  onToggleView,
  onNextInterview,
  onFocusSearch,
  onCloseDialog,
  enabled = true,
}: UseInterviewKeyboardShortcutsProps) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // Only handle Escape in inputs
      if (event.key === 'Escape' && onCloseDialog) {
        onCloseDialog();
      }
      return;
    }

    // Don't trigger if modifier keys are pressed (except for specific combos)
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    switch (event.key.toLowerCase()) {
      case 'l':
        event.preventDefault();
        onToggleView?.();
        break;
      case 'n':
        event.preventDefault();
        onNextInterview?.();
        break;
      case 'f':
        event.preventDefault();
        onFocusSearch?.();
        break;
      case 'escape':
        onCloseDialog?.();
        break;
    }
  }, [onToggleView, onNextInterview, onFocusSearch, onCloseDialog]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}
