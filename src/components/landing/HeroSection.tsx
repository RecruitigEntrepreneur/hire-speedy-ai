import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Clock, Users, CheckCircle, Sparkles, Zap, FileText, MessageSquare, Calendar } from "lucide-react";

export const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary via-navy-light to-primary">
      {/* Aurora/Mesh Gradient Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Animated Gradient Orbs */}
        <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-emerald/20 rounded-full blur-[120px] animate-aurora-1" />
        <div className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-blue-500/15 rounded-full blur-[100px] animate-aurora-2" />
        <div className="absolute bottom-0 left-1/4 w-[700px] h-[700px] bg-purple-500/10 rounded-full blur-[100px] animate-aurora-3" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-cyan-500/15 rounded-full blur-[80px] animate-aurora-1" style={{ animationDelay: "2s" }} />
        <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-emerald/25 rounded-full blur-[80px] animate-glow-pulse" />
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }} />
        
        {/* Radial Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-primary/50" />
        
        {/* Light Beams */}
        <div className="absolute top-0 left-1/4 w-[2px] h-full bg-gradient-to-b from-emerald/20 via-emerald/5 to-transparent animate-beam" />
        <div className="absolute top-0 right-1/3 w-[1px] h-full bg-gradient-to-b from-blue-400/20 via-blue-400/5 to-transparent animate-beam" style={{ animationDelay: "1s" }} />
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white/30 rounded-full animate-particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${5 + Math.random() * 10}s`,
            }}
          />
        ))}
      </div>

      {/* Floating UI Cards with Connection Lines */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Connection Lines SVG */}
        <svg className="absolute inset-0 w-full h-full opacity-20" preserveAspectRatio="none">
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(152, 69%, 40%)" stopOpacity="0" />
              <stop offset="50%" stopColor="hsl(152, 69%, 40%)" stopOpacity="1" />
              <stop offset="100%" stopColor="hsl(152, 69%, 40%)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M 10% 15% Q 25% 25% 40% 20%" stroke="url(#lineGradient)" strokeWidth="1" fill="none" className="animate-draw-line" />
          <path d="M 40% 20% Q 55% 35% 70% 25%" stroke="url(#lineGradient)" strokeWidth="1" fill="none" className="animate-draw-line" style={{ animationDelay: "0.5s" }} />
          <path d="M 70% 25% Q 60% 50% 50% 60%" stroke="url(#lineGradient)" strokeWidth="1" fill="none" className="animate-draw-line" style={{ animationDelay: "1s" }} />
          <path d="M 15% 70% Q 35% 65% 50% 60%" stroke="url(#lineGradient)" strokeWidth="1" fill="none" className="animate-draw-line" style={{ animationDelay: "1.5s" }} />
          <path d="M 50% 60% Q 70% 70% 85% 65%" stroke="url(#lineGradient)" strokeWidth="1" fill="none" className="animate-draw-line" style={{ animationDelay: "2s" }} />
        </svg>

        {/* Card 1: Job Upload */}
        <div className="absolute top-[12%] left-[8%] glass-card-dark p-4 rounded-xl animate-float-slow opacity-90 shadow-2xl shadow-emerald/10" style={{ animationDelay: "0s" }}>
          <div className="flex items-center gap-3 text-primary-foreground/90">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald to-emerald-light flex items-center justify-center shadow-lg shadow-emerald/30">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-sm font-semibold block">Job Upload</span>
              <span className="text-xs text-primary-foreground/50">PDF, Link oder Text</span>
            </div>
          </div>
        </div>

        {/* Card 2: AI Analysis */}
        <div className="absolute top-[18%] right-[12%] glass-card-dark p-4 rounded-xl animate-float-slow opacity-90 shadow-2xl shadow-blue-500/10" style={{ animationDelay: "0.5s" }}>
          <div className="flex items-center gap-3 text-primary-foreground/90">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30 animate-glow-pulse">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-sm font-semibold block">AI Analyse</span>
              <span className="text-xs text-emerald">Skills extrahiert...</span>
            </div>
          </div>
          <div className="mt-3 h-1.5 bg-primary-foreground/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-emerald w-3/4 rounded-full animate-pulse" />
          </div>
        </div>

        {/* Card 3: Recruiter Matching */}
        <div className="absolute top-[40%] left-[5%] glass-card-dark p-4 rounded-xl animate-float-slow opacity-90 shadow-2xl shadow-purple-500/10" style={{ animationDelay: "1s" }}>
          <div className="flex items-center gap-3 text-primary-foreground/90">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-sm font-semibold block">Recruiter Match</span>
              <span className="text-xs text-primary-foreground/50">247 verfügbar</span>
            </div>
          </div>
        </div>

        {/* Card 4: Candidates */}
        <div className="absolute bottom-[35%] left-[12%] glass-card-dark p-4 rounded-xl animate-float-slow opacity-90 shadow-2xl shadow-emerald/20" style={{ animationDelay: "1.5s" }}>
          <div className="flex items-center gap-3 text-primary-foreground/90">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald to-teal-500 border-2 border-primary" />
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 border-2 border-primary" />
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 border-2 border-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">3 Kandidaten</p>
              <p className="text-xs text-emerald font-medium">Match Score: 94%</p>
            </div>
          </div>
        </div>

        {/* Card 5: Interview */}
        <div className="absolute top-[35%] right-[8%] glass-card-dark p-4 rounded-xl animate-float-slow opacity-90 shadow-2xl shadow-orange-500/10" style={{ animationDelay: "2s" }}>
          <div className="flex items-center gap-3 text-primary-foreground/90">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-sm font-semibold block">Interview</span>
              <span className="text-xs text-primary-foreground/50">Automatisch geplant</span>
            </div>
          </div>
        </div>

        {/* Card 6: Messages */}
        <div className="absolute bottom-[28%] right-[15%] glass-card-dark p-4 rounded-xl animate-float-slow opacity-90 shadow-2xl shadow-cyan-500/10" style={{ animationDelay: "2.5s" }}>
          <div className="flex items-center gap-3 text-primary-foreground/90">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-sm font-semibold block">Kommunikation</span>
              <span className="text-xs text-primary-foreground/50">Multi-Channel</span>
            </div>
          </div>
        </div>

        {/* Card 7: Offer Accepted - Prominent */}
        <div className="absolute bottom-[18%] right-[25%] glass-card-dark p-5 rounded-xl animate-float-slow opacity-95 shadow-2xl shadow-emerald/30 border border-emerald/30" style={{ animationDelay: "3s" }}>
          <div className="flex items-center gap-3 text-primary-foreground">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald to-emerald-light flex items-center justify-center shadow-lg shadow-emerald/40">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-base font-bold block">Offer Accepted</span>
              <span className="text-xs text-emerald font-medium">In nur 3,8 Tagen</span>
            </div>
          </div>
        </div>

        {/* Card 8: Speed Indicator */}
        <div className="absolute top-[55%] left-[25%] glass-card-dark px-4 py-2 rounded-full animate-float-slow opacity-80" style={{ animationDelay: "0.8s" }}>
          <div className="flex items-center gap-2 text-primary-foreground/80">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium">60 Sekunden Setup</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 relative z-10 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Main Headline */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-primary-foreground leading-tight tracking-tight">
            Hiring.{" "}
            <span className="bg-gradient-to-r from-emerald via-cyan-400 to-emerald bg-clip-text text-transparent animate-gradient-x bg-[length:200%_auto]">
              Rebuilt from Zero.
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-primary-foreground/80 font-medium">
            Powered by AI. Delivered by Experts. Engineered for Results.
          </p>

          {/* German Description */}
          <div className="text-primary-foreground/70 text-lg md:text-xl space-y-1 max-w-2xl mx-auto">
            <p>Laden Sie Ihren Job hoch.</p>
            <p>Unsere KI versteht, was Sie wirklich suchen.</p>
            <p>Top-Recruiter liefern passende Kandidaten.</p>
            <p className="font-medium text-primary-foreground/90">Alles automatisiert – vom Matching bis zum Offer.</p>
          </div>

          {/* CTA Zone */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <Button asChild size="lg" className="bg-emerald hover:bg-emerald-light text-white px-8 py-6 text-lg font-semibold shadow-lg shadow-emerald/30 hover:shadow-emerald/50 hover:scale-105 transition-all duration-300">
              <Link to="/auth?tab=register&role=client">
                Job in 60 Sekunden starten
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 px-8 py-6 text-lg backdrop-blur-sm">
              <a href="#why-us">
                Warum Unternehmen uns wählen
              </a>
            </Button>
          </div>

          {/* Ghost CTA for Recruiters */}
          <div className="pt-2">
            <Link 
              to="/auth?tab=register&role=recruiter" 
              className="text-primary-foreground/60 hover:text-emerald transition-colors text-sm font-medium inline-flex items-center gap-1 group"
            >
              Recruiter werden
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Trust Line */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 pt-8 text-primary-foreground/60 text-sm">
            <div className="flex items-center gap-2 hover:text-primary-foreground/80 transition-colors">
              <Shield className="w-4 h-4" />
              <span>DSGVO-konform</span>
            </div>
            <div className="flex items-center gap-2 hover:text-primary-foreground/80 transition-colors">
              <CheckCircle className="w-4 h-4" />
              <span>Escrow-gesichert</span>
            </div>
            <div className="flex items-center gap-2 hover:text-primary-foreground/80 transition-colors">
              <CheckCircle className="w-4 h-4" />
              <span>Erfolgsbasiert</span>
            </div>
            <div className="flex items-center gap-2 hover:text-primary-foreground/80 transition-colors">
              <Users className="w-4 h-4" />
              <span>12.000+ Recruiter</span>
            </div>
            <div className="flex items-center gap-2 hover:text-primary-foreground/80 transition-colors">
              <Clock className="w-4 h-4" />
              <span>3,8 Tage bis zum ersten Interview</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-background via-background/80 to-transparent" />
    </section>
  );
};
