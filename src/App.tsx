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
import ClientInterviews from "./pages/dashboard/ClientInterviews";
import ClientPlacements from "./pages/dashboard/ClientPlacements";

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

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminClients from "./pages/admin/AdminClients";
import AdminRecruiters from "./pages/admin/AdminRecruiters";
import AdminJobs from "./pages/admin/AdminJobs";
import AdminPlacements from "./pages/admin/AdminPlacements";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminActivity from "./pages/admin/AdminActivity";

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
      <Route path="/admin/placements" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminPlacements />
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
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
