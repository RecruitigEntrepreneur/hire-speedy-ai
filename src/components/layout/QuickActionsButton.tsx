import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Plus, 
  Upload, 
  UserPlus, 
  Link2, 
  FileSpreadsheet,
  Settings2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { HubSpotImportDialog } from '@/components/candidates/HubSpotImportDialog';

interface QuickActionsButtonProps {
  onCandidateImported?: () => void;
  showCRMStatus?: boolean;
  crmConnected?: boolean;
}

export function QuickActionsButton({ 
  onCandidateImported, 
  showCRMStatus = true,
  crmConnected = false 
}: QuickActionsButtonProps) {
  const [hubspotOpen, setHubspotOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 border-emerald/30 hover:border-emerald hover:bg-emerald/5"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Importieren</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <div className="px-2 py-1.5">
            <p className="text-sm font-semibold">Kandidaten importieren</p>
            <p className="text-xs text-muted-foreground">Wähle eine Import-Methode</p>
          </div>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            onClick={() => setHubspotOpen(true)}
            className="cursor-pointer gap-3 py-3"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <Upload className="h-4 w-4 text-orange-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium">HubSpot Import</p>
              <p className="text-xs text-muted-foreground">Kontakte aus HubSpot CRM</p>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="cursor-pointer gap-3 py-3">
            <Link to="/recruiter/candidates?action=add">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald/10">
                <UserPlus className="h-4 w-4 text-emerald" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Manuell hinzufügen</p>
                <p className="text-xs text-muted-foreground">Kandidat einzeln erfassen</p>
              </div>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem className="cursor-pointer gap-3 py-3 opacity-60" disabled>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium">CSV Upload</p>
              <p className="text-xs text-muted-foreground">Bald verfügbar</p>
            </div>
          </DropdownMenuItem>

          {showCRMStatus && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer gap-3 py-3">
                <Link to="/dashboard/integrations">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">CRM Einstellungen</p>
                    <div className="flex items-center gap-1.5 text-xs">
                      {crmConnected ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-emerald" />
                          <span className="text-emerald">Verbunden</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3 text-amber-500" />
                          <span className="text-muted-foreground">Nicht verbunden</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <HubSpotImportDialog 
        open={hubspotOpen} 
        onOpenChange={setHubspotOpen}
        onImportComplete={() => {
          setHubspotOpen(false);
          onCandidateImported?.();
        }}
      />
    </>
  );
}
