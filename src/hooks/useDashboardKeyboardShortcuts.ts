import { useEffect, useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

interface ShortcutConfig {
  keys: string[];
  action: () => void;
  description: string;
  category: 'navigation' | 'actions' | 'list';
}

export function useDashboardKeyboardShortcuts(onHelpOpen?: () => void) {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();
  const [keyBuffer, setKeyBuffer] = useState<string[]>([]);
  const [bufferTimeout, setBufferTimeout] = useState<NodeJS.Timeout | null>(null);

  // Get dashboard base path based on role
  const getBasePath = useCallback(() => {
    switch (role) {
      case 'admin':
        return '/admin';
      case 'recruiter':
        return '/recruiter';
      case 'client':
      default:
        return '/dashboard';
    }
  }, [role]);

  const shortcuts: ShortcutConfig[] = [
    // Navigation shortcuts (g + key)
    { 
      keys: ['g', 'd'], 
      action: () => navigate(getBasePath()), 
      description: 'Dashboard',
      category: 'navigation'
    },
    { 
      keys: ['g', 'j'], 
      action: () => navigate(`${getBasePath()}/jobs`), 
      description: 'Jobs',
      category: 'navigation'
    },
    { 
      keys: ['g', 't'], 
      action: () => navigate(`${getBasePath()}/talent`), 
      description: 'Talent Hub',
      category: 'navigation'
    },
    { 
      keys: ['g', 'i'], 
      action: () => navigate(`${getBasePath()}/interviews`), 
      description: 'Interviews',
      category: 'navigation'
    },
    { 
      keys: ['g', 'm'], 
      action: () => navigate(`${getBasePath()}/messages`), 
      description: 'Nachrichten',
      category: 'navigation'
    },
    { 
      keys: ['g', 's'], 
      action: () => navigate(`${getBasePath()}/settings`), 
      description: 'Einstellungen',
      category: 'navigation'
    },
    // Action shortcuts
    { 
      keys: ['n', 'j'], 
      action: () => navigate(`${getBasePath()}/jobs/new`), 
      description: 'Neuer Job',
      category: 'actions'
    },
    // Help
    { 
      keys: ['?'], 
      action: () => onHelpOpen?.(), 
      description: 'Shortcuts anzeigen',
      category: 'actions'
    },
  ];

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignore if typing in input, textarea, or contenteditable
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      target.closest('[role="dialog"]') ||
      target.closest('[role="combobox"]')
    ) {
      return;
    }

    const key = event.key.toLowerCase();

    // Handle Escape separately
    if (key === 'escape') {
      // Could close modals, clear selection, etc.
      return;
    }

    // Handle ? for help (with shift)
    if (event.key === '?' && event.shiftKey) {
      event.preventDefault();
      onHelpOpen?.();
      return;
    }

    // Add key to buffer
    const newBuffer = [...keyBuffer, key];
    setKeyBuffer(newBuffer);

    // Clear existing timeout
    if (bufferTimeout) {
      clearTimeout(bufferTimeout);
    }

    // Check for matching shortcut
    const matchingShortcut = shortcuts.find(shortcut => 
      shortcut.keys.length === newBuffer.length &&
      shortcut.keys.every((k, i) => k === newBuffer[i])
    );

    if (matchingShortcut) {
      event.preventDefault();
      matchingShortcut.action();
      setKeyBuffer([]);
      return;
    }

    // Check if any shortcut could still match (partial match)
    const couldMatch = shortcuts.some(shortcut =>
      shortcut.keys.length > newBuffer.length &&
      shortcut.keys.slice(0, newBuffer.length).every((k, i) => k === newBuffer[i])
    );

    if (!couldMatch) {
      // No possible match, clear buffer
      setKeyBuffer([]);
    } else {
      // Set timeout to clear buffer after 1 second
      const timeout = setTimeout(() => {
        setKeyBuffer([]);
      }, 1000);
      setBufferTimeout(timeout);
    }
  }, [keyBuffer, shortcuts, bufferTimeout, onHelpOpen, navigate, getBasePath]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (bufferTimeout) {
        clearTimeout(bufferTimeout);
      }
    };
  }, [handleKeyDown, bufferTimeout]);

  // Return shortcuts for help modal
  return {
    shortcuts: shortcuts.map(s => ({
      keys: s.keys.join(' + '),
      description: s.description,
      category: s.category,
    })),
    currentBuffer: keyBuffer,
  };
}

// Simplified list navigation hook for use in list components
export function useListKeyboardNavigation(
  items: any[],
  selectedIndex: number,
  onSelect: (index: number) => void,
  onAction?: () => void
) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }

    switch (event.key.toLowerCase()) {
      case 'j':
      case 'arrowdown':
        event.preventDefault();
        if (selectedIndex < items.length - 1) {
          onSelect(selectedIndex + 1);
        }
        break;
      case 'k':
      case 'arrowup':
        event.preventDefault();
        if (selectedIndex > 0) {
          onSelect(selectedIndex - 1);
        }
        break;
      case 'enter':
        event.preventDefault();
        onAction?.();
        break;
    }
  }, [items.length, selectedIndex, onSelect, onAction]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
