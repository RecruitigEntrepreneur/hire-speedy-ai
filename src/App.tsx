import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Client Dashboard pages
import ClientDashboard from "./pages/dashboard/ClientDashboard";
import JobsList from "./pages/dashboard/JobsList";
import CreateJob from "./pages/dashboard/CreateJob";
import ClientJobDetail from "./pages/dashboard/ClientJobDetail";
import ClientCandidates from "./pages/dashboard/ClientCandidates";
import CandidateDetail from "./pages/dashboard/CandidateDetail";
import ClientInterviews from "./pages/dashboard/ClientInterviews";
import ClientPlacements from "./pages/dashboard/ClientPlacements";
import ClientMessages from "./pages/dashboard/ClientMessages";
import ClientSettings from "./pages/dashboard/ClientSettings";
import ClientBilling from "./pages/dashboard/ClientBilling";
import DataPrivacy from "./pages/dashboard/DataPrivacy";

// Recruiter pages
import RecruiterDashboard from "./pages/recruiter/RecruiterDashboard";
import RecruiterJobs from "./pages/recruiter/RecruiterJobs";
import JobDetail from "./pages/recruiter/JobDetail";
import RecruiterCandidates from "./pages/recruiter/RecruiterCandidates";
import RecruiterSubmissions from "./pages/recruiter/RecruiterSubmissions";
import RecruiterEarnings from "./pages/recruiter/RecruiterEarnings";
import RecruiterNotifications from "./pages/recruiter/RecruiterNotifications";
import RecruiterMessages from "./pages/recruiter/RecruiterMessages";
import RecruiterProfile from "./pages/recruiter/RecruiterProfile";
import RecruiterPayouts from "./pages/recruiter/RecruiterPayouts";
import RecruiterDataPrivacy from "./pages/recruiter/RecruiterDataPrivacy";
import RecruiterInfluence from "./pages/recruiter/RecruiterInfluence";
import RecruiterTalentPool from "./pages/recruiter/RecruiterTalentPool";

// Integration pages
import IntegrationSettings from "./pages/dashboard/IntegrationSettings";

// Organization pages
import TeamManagement from "./pages/organization/TeamManagement";
import AcceptInvite from "./pages/organization/AcceptInvite";

// Reference pages
import ProvideReference from "./pages/reference/ProvideReference";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminClients from "./pages/admin/AdminClients";
import AdminRecruiters from "./pages/admin/AdminRecruiters";
import AdminJobs from "./pages/admin/AdminJobs";
import AdminCandidates from "./pages/admin/AdminCandidates";
import AdminInterviews from "./pages/admin/AdminInterviews";
import AdminPlacements from "./pages/admin/AdminPlacements";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminActivity from "./pages/admin/AdminActivity";
import AdminPayoutApproval from "./pages/admin/AdminPayoutApproval";
import AdminFraud from "./pages/admin/AdminFraud";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminDealHealth from "./pages/admin/AdminDealHealth";

// Client Analytics
import ClientAnalytics from "./pages/dashboard/ClientAnalytics";

// Onboarding
import ClientOnboarding from "./pages/onboarding/ClientOnboarding";
import RecruiterOnboarding from "./pages/onboarding/RecruiterOnboarding";

// Public pages
import SelectSlot from "./pages/interview/SelectSlot";
import ClientOffers from "./pages/dashboard/ClientOffers";
import ViewOffer from "./pages/offer/ViewOffer";
import OfferAccepted from "./pages/offer/OfferAccepted";

// New Public pages
import About from "./pages/public/About";
import Contact from "./pages/public/Contact";
import Blog from "./pages/public/Blog";
import Guides from "./pages/public/Guides";
import Docs from "./pages/public/Docs";
import Help from "./pages/public/Help";
import Careers from "./pages/public/Careers";
import Press from "./pages/public/Press";

// GDPR Components
import { CookieConsentBanner } from "@/components/gdpr/CookieConsentBanner";

const queryClient = new QueryClient();

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Admins haben Zugriff auf alle Bereiche
  if (role === 'admin') {
    return <>{children}</>;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    const dashboardPath = role === 'recruiter' ? '/recruiter' : '/dashboard';
    return <Navigate to={dashboardPath} replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      
      {/* Client Routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientDashboard />
        </ProtectedRoute>
      } />
      <Route path="/dashboard/jobs" element={
        <ProtectedRoute allowedRoles={['client']}>
          <JobsList />
        </ProtectedRoute>
      } />
      <Route path="/dashboard/jobs/new" element={
        <ProtectedRoute allowedRoles={['client']}>
          <CreateJob />
        </ProtectedRoute>
      } />
      <Route path="/dashboard/jobs/:id" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientJobDetail />
        </ProtectedRoute>
      } />
      <Route path="/dashboard/candidates" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientCandidates />
        </ProtectedRoute>
      } />
      <Route path="/dashboard/candidates/:id" element={
        <ProtectedRoute allowedRoles={['client']}>
          <CandidateDetail />
        </ProtectedRoute>
      } />
      <Route path="/dashboard/interviews" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientInterviews />
        </ProtectedRoute>
      } />
      <Route path="/dashboard/placements" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientPlacements />
        </ProtectedRoute>
      } />
      <Route path="/dashboard/messages" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientMessages />
        </ProtectedRoute>
      } />
      <Route path="/dashboard/settings" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientSettings />
        </ProtectedRoute>
      } />
      <Route path="/dashboard/billing" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientBilling />
        </ProtectedRoute>
      } />
      <Route path="/dashboard/privacy" element={
        <ProtectedRoute allowedRoles={['client']}>
          <DataPrivacy />
        </ProtectedRoute>
      } />
      <Route path="/dashboard/offers" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientOffers />
        </ProtectedRoute>
      } />
      <Route path="/dashboard/analytics" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientAnalytics />
        </ProtectedRoute>
      } />
      <Route path="/dashboard/team" element={
        <ProtectedRoute allowedRoles={['client']}>
          <TeamManagement />
        </ProtectedRoute>
      } />
      <Route path="/dashboard/integrations" element={
        <ProtectedRoute allowedRoles={['client']}>
          <IntegrationSettings />
        </ProtectedRoute>
      } />
      
      {/* Recruiter Routes */}
      <Route path="/recruiter" element={
        <ProtectedRoute allowedRoles={['recruiter']}>
          <RecruiterDashboard />
        </ProtectedRoute>
      } />
      <Route path="/recruiter/jobs" element={
        <ProtectedRoute allowedRoles={['recruiter']}>
          <RecruiterJobs />
        </ProtectedRoute>
      } />
      <Route path="/recruiter/jobs/:id" element={
        <ProtectedRoute allowedRoles={['recruiter']}>
          <JobDetail />
        </ProtectedRoute>
      } />
      <Route path="/recruiter/candidates" element={
        <ProtectedRoute allowedRoles={['recruiter']}>
          <RecruiterCandidates />
        </ProtectedRoute>
      } />
      <Route path="/recruiter/submissions" element={
        <ProtectedRoute allowedRoles={['recruiter']}>
          <RecruiterSubmissions />
        </ProtectedRoute>
      } />
      <Route path="/recruiter/earnings" element={
        <ProtectedRoute allowedRoles={['recruiter']}>
          <RecruiterEarnings />
        </ProtectedRoute>
      } />
      <Route path="/recruiter/notifications" element={
        <ProtectedRoute allowedRoles={['recruiter']}>
          <RecruiterNotifications />
        </ProtectedRoute>
      } />
      <Route path="/recruiter/messages" element={
        <ProtectedRoute allowedRoles={['recruiter']}>
          <RecruiterMessages />
        </ProtectedRoute>
      } />
      <Route path="/recruiter/profile" element={
        <ProtectedRoute allowedRoles={['recruiter']}>
          <RecruiterProfile />
        </ProtectedRoute>
      } />
      <Route path="/recruiter/payouts" element={
        <ProtectedRoute allowedRoles={['recruiter']}>
          <RecruiterPayouts />
        </ProtectedRoute>
      } />
      <Route path="/recruiter/privacy" element={
        <ProtectedRoute allowedRoles={['recruiter']}>
          <RecruiterDataPrivacy />
        </ProtectedRoute>
      } />
      <Route path="/recruiter/influence" element={
        <ProtectedRoute allowedRoles={['recruiter']}>
          <RecruiterInfluence />
        </ProtectedRoute>
      } />
      <Route path="/recruiter/talent-pool" element={
        <ProtectedRoute allowedRoles={['recruiter']}>
          <RecruiterTalentPool />
        </ProtectedRoute>
      } />
      
      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/clients" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminClients />
        </ProtectedRoute>
      } />
      <Route path="/admin/recruiters" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminRecruiters />
        </ProtectedRoute>
      } />
      <Route path="/admin/jobs" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminJobs />
        </ProtectedRoute>
      } />
      <Route path="/admin/candidates" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminCandidates />
        </ProtectedRoute>
      } />
      <Route path="/admin/interviews" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminInterviews />
        </ProtectedRoute>
      } />
      <Route path="/admin/placements" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminPlacements />
        </ProtectedRoute>
      } />
      <Route path="/admin/deal-health" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminDealHealth />
        </ProtectedRoute>
      } />
      <Route path="/admin/payments" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminPayments />
        </ProtectedRoute>
      } />
      <Route path="/admin/activity" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminActivity />
        </ProtectedRoute>
      } />
      <Route path="/admin/payouts" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminPayoutApproval />
        </ProtectedRoute>
      } />
      <Route path="/admin/fraud" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminFraud />
        </ProtectedRoute>
      } />
      <Route path="/admin/analytics" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminAnalytics />
        </ProtectedRoute>
      } />
      
      {/* Onboarding */}
      <Route path="/onboarding" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientOnboarding />
        </ProtectedRoute>
      } />
      <Route path="/recruiter/onboarding" element={
        <ProtectedRoute allowedRoles={['recruiter']}>
          <RecruiterOnboarding />
        </ProtectedRoute>
      } />
      
      {/* Public Routes */}
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/blog" element={<Blog />} />
      <Route path="/guides" element={<Guides />} />
      <Route path="/docs" element={<Docs />} />
      <Route path="/help" element={<Help />} />
      <Route path="/careers" element={<Careers />} />
      <Route path="/press" element={<Press />} />
      <Route path="/interview/select/:token" element={<SelectSlot />} />
      <Route path="/offer/view/:token" element={<ViewOffer />} />
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route path="/reference/:token" element={<ProvideReference />} />
      <Route path="/offer/accepted" element={<OfferAccepted />} />
      
      {/* Settings */}
      <Route path="/settings" element={
        <ProtectedRoute>
          <ClientDashboard />
        </ProtectedRoute>
      } />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <CookieConsentBanner />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
