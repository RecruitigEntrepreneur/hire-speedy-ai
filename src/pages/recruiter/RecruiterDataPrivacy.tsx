import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DataExportRequest } from "@/components/gdpr/DataExportRequest";
import { DataDeletionRequest } from "@/components/gdpr/DataDeletionRequest";
import { ConsentManagement } from "@/components/gdpr/ConsentManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function RecruiterDataPrivacy() {
  const { t } = useTranslation('recruiterInbox');
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('privacy.title')}</h1>
            <p className="text-muted-foreground">
              {t('privacy.subtitle')}
            </p>
          </div>
        </div>

        <Tabs defaultValue="consents" className="space-y-4">
          <TabsList>
            <TabsTrigger value="consents">{t('privacy.consents')}</TabsTrigger>
            <TabsTrigger value="export">{t('privacy.export')}</TabsTrigger>
            <TabsTrigger value="delete">{t('privacy.delete')}</TabsTrigger>
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
