import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DataExportRequest } from "@/components/gdpr/DataExportRequest";
import { DataDeletionRequest } from "@/components/gdpr/DataDeletionRequest";
import { ConsentManagement } from "@/components/gdpr/ConsentManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield } from "lucide-react";

export default function RecruiterDataPrivacy() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Datenschutz</h1>
            <p className="text-muted-foreground">
              Verwalten Sie Ihre persönlichen Daten und Einwilligungen
            </p>
          </div>
        </div>

        <Tabs defaultValue="consents" className="space-y-4">
          <TabsList>
            <TabsTrigger value="consents">Einwilligungen</TabsTrigger>
            <TabsTrigger value="export">Datenexport</TabsTrigger>
            <TabsTrigger value="delete">Konto löschen</TabsTrigger>
          </TabsList>

          <TabsContent value="consents" className="space-y-4">
            <ConsentManagement />
          </TabsContent>

          <TabsContent value="export" className="space-y-4">
            <DataExportRequest />
          </TabsContent>

          <TabsContent value="delete" className="space-y-4">
            <DataDeletionRequest />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
