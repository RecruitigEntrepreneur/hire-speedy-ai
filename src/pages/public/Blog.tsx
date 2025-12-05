import { Navbar } from "@/components/layout/Navbar";
import { FooterSection } from "@/components/landing/FooterSection";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Calendar, User, Clock } from "lucide-react";

const blogPosts = [
  {
    title: "Die Zukunft des Recruitings: KI und Automatisierung",
    excerpt: "Wie künstliche Intelligenz den Recruiting-Prozess revolutioniert und was das für Unternehmen bedeutet.",
    author: "Anna Schmidt",
    date: "15. Nov 2024",
    readTime: "5 min",
    category: "AI & Tech",
  },
  {
    title: "5 Tipps für erfolgreichere Stellenausschreibungen",
    excerpt: "So formulieren Sie Jobanzeigen, die Top-Talente ansprechen und Ihre Conversion-Rate steigern.",
    author: "Michael Weber",
    date: "12. Nov 2024",
    readTime: "4 min",
    category: "Best Practices",
  },
  {
    title: "Erfolgsbasiertes Recruiting: Ein Paradigmenwechsel",
    excerpt: "Warum immer mehr Unternehmen auf erfolgsbasierte Modelle setzen und wie Sie davon profitieren.",
    author: "Lisa Müller",
    date: "8. Nov 2024",
    readTime: "6 min",
    category: "Trends",
  },
];

export default function Blog() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero */}
      <section className="py-24 bg-gradient-to-br from-primary via-primary to-navy-dark text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-emerald font-semibold uppercase tracking-wider mb-4">Blog</p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Insights & Best Practices
            </h1>
            <p className="text-xl text-primary-foreground/80">
              Aktuelle Trends, Tipps und Strategien für erfolgreiches Recruiting.
            </p>
          </div>
        </div>
      </section>

      {/* Blog Posts */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-8">
            {blogPosts.map((post, index) => (
              <article key={index} className="bg-card rounded-2xl p-8 border border-border/50 hover:shadow-lg transition-shadow">
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                  <span className="px-3 py-1 rounded-full bg-emerald/10 text-emerald font-medium">
                    {post.category}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {post.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {post.readTime}
                  </span>
                </div>
                <h2 className="text-2xl font-bold mb-3 hover:text-emerald transition-colors cursor-pointer">
                  {post.title}
                </h2>
                <p className="text-muted-foreground mb-4">{post.excerpt}</p>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="w-4 h-4" />
                    {post.author}
                  </span>
                  <Button variant="ghost" size="sm" className="group">
                    Weiterlesen
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </article>
            ))}
          </div>

          <div className="text-center mt-12">
            <p className="text-muted-foreground">
              Weitere Artikel folgen in Kürze...
            </p>
          </div>
        </div>
      </section>

      <FooterSection />
    </div>
  );
}
