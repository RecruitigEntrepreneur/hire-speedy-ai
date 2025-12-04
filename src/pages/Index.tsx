import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { 
  Briefcase, 
  Users, 
  Zap, 
  Shield, 
  ArrowRight, 
  CheckCircle2,
  Building2,
  UserCheck,
  Clock,
  TrendingUp
} from 'lucide-react';

const Index = () => {
  const { user, role } = useAuth();

  const getDashboardLink = () => {
    switch (role) {
      case 'admin':
        return '/admin';
      case 'recruiter':
        return '/recruiter';
      default:
        return '/dashboard';
    }
  };

  const features = [
    {
      icon: <Clock className="h-6 w-6" />,
      title: '60-Second Job Upload',
      description: 'Post a job in under a minute. Just paste a link or fill out our quick form.',
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: 'AI-Powered Matching',
      description: 'Our AI generates requirement profiles and matches candidates automatically.',
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: 'Verified Recruiters',
      description: 'Access a network of pre-verified, professional recruiters.',
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: 'Secure Payments',
      description: 'Safe fee handling with transparent pricing and automated payouts.',
    },
  ];

  const stats = [
    { value: '2,500+', label: 'Verified Recruiters' },
    { value: '15,000+', label: 'Successful Placements' },
    { value: '98%', label: 'Client Satisfaction' },
    { value: '48hrs', label: 'Avg. Time to First Candidate' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-navy/5 via-transparent to-emerald/5" />
        <div className="container relative py-24 md:py-32">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald/10 px-4 py-2 text-sm font-medium text-emerald">
              <Zap className="h-4 w-4" />
              The Future of Recruiting
            </div>
            
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl animate-fade-in">
              Hire Top Talent{' '}
              <span className="gradient-text">10x Faster</span>
            </h1>
            
            <p className="mb-8 text-lg text-muted-foreground md:text-xl max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '0.1s' }}>
              The recruiting marketplace that connects companies with verified recruiters. 
              Post a job in 60 seconds, receive qualified candidates, and hire with confidence.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              {user ? (
                <Button size="xl" variant="hero" asChild>
                  <Link to={getDashboardLink()}>
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button size="xl" variant="hero" asChild>
                    <Link to="/auth?mode=signup&role=client">
                      <Building2 className="mr-2 h-5 w-5" />
                      I'm Hiring
                    </Link>
                  </Button>
                  <Button size="xl" variant="outline" asChild>
                    <Link to="/auth?mode=signup&role=recruiter">
                      <UserCheck className="mr-2 h-5 w-5" />
                      I'm a Recruiter
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y border-border/40 bg-muted/30">
        <div className="container py-12">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat, index) => (
              <div 
                key={stat.label} 
                className="text-center animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="text-3xl font-bold text-navy md:text-4xl">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything You Need to Hire Faster
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              From job posting to placement, we've streamlined every step of the hiring process.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <div 
                key={feature.title}
                className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-emerald/30 animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-navy text-primary-foreground">
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-muted/30 py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Get started in three simple steps
            </p>
          </div>

          <div className="mx-auto max-w-4xl">
            <div className="grid gap-8 md:grid-cols-3">
              {[
                {
                  step: '01',
                  title: 'Post Your Job',
                  description: 'Upload via link, PDF, or quick form. Our AI generates a complete requirement profile.',
                },
                {
                  step: '02',
                  title: 'Receive Candidates',
                  description: 'Verified recruiters submit qualified candidates directly to your dashboard.',
                },
                {
                  step: '03',
                  title: 'Hire & Pay Securely',
                  description: 'Interview, hire, and handle payments through our secure platform.',
                },
              ].map((item, index) => (
                <div 
                  key={item.step} 
                  className="relative animate-fade-in"
                  style={{ animationDelay: `${index * 0.15}s` }}
                >
                  <div className="text-6xl font-bold text-navy/10">{item.step}</div>
                  <h3 className="mt-4 text-xl font-semibold">{item.title}</h3>
                  <p className="mt-2 text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-navy p-12 md:p-16">
            <div className="relative z-10 mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
                Ready to Transform Your Hiring?
              </h2>
              <p className="mt-4 text-lg text-primary-foreground/80">
                Join thousands of companies that have streamlined their recruiting process.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" variant="emerald" asChild>
                  <Link to="/auth?mode=signup">
                    Get Started Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_hsl(152,69%,40%,0.2),_transparent_50%)]" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12">
        <div className="container">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-navy">
                <Briefcase className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold">TalentBridge</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 TalentBridge. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
