import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Mail, Inbox } from "lucide-react";
import { CompanyListView } from "@/components/outreach/CompanyListView";
import { EmailWorkflow } from "@/components/outreach/EmailWorkflow";
import { InboxView } from "@/components/outreach/InboxView";
import { useOutreachStats } from "@/hooks/useCompanyOutreach";

export default function OutreachSlim() {
  const [activeTab, setActiveTab] = useState("companies");
  const { data: stats } = useOutreachStats();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with KPIs */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Outreach</h1>
            <p className="text-muted-foreground">
              Unternehmen akquirieren & personalisierte E-Mails versenden
            </p>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{stats?.warm || 0}</div>
              <div className="text-muted-foreground">Warm</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats?.in_kontakt || 0}</div>
              <div className="text-muted-foreground">In Kontakt</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats?.deal_gewonnen || 0}</div>
              <div className="text-muted-foreground">Deals</div>
            </div>
          </div>
        </div>

        {/* 3 Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="companies" className="gap-2">
              <Building2 className="h-4 w-4" />
              Unternehmen
            </TabsTrigger>
            <TabsTrigger value="outreach" className="gap-2">
              <Mail className="h-4 w-4" />
              Outreach
            </TabsTrigger>
            <TabsTrigger value="inbox" className="gap-2">
              <Inbox className="h-4 w-4" />
              Inbox
            </TabsTrigger>
          </TabsList>

          <TabsContent value="companies" className="mt-6">
            <CompanyListView />
          </TabsContent>

          <TabsContent value="outreach" className="mt-6">
            <EmailWorkflow />
          </TabsContent>

          <TabsContent value="inbox" className="mt-6">
            <InboxView />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
