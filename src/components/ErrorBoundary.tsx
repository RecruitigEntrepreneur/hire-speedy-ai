import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Fängt Render-Fehler der ganzen App ab. Ohne diese Grenze endet jeder
 * unbehandelte Fehler (z. B. ein Radix-SelectItem mit leerem value) in einem
 * schwarzen Bildschirm, aus dem nur ein manuelles Neuladen führt.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unbehandelter Fehler in der Oberfläche:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md space-y-3 text-center">
          <p className="text-lg font-semibold">Da ist etwas schiefgelaufen.</p>
          <p className="text-sm text-muted-foreground">
            Die Seite konnte nicht angezeigt werden. Deine Daten sind nicht verloren.
          </p>
          <Button onClick={() => window.location.reload()}>Neu laden</Button>
        </div>
      </div>
    );
  }
}
