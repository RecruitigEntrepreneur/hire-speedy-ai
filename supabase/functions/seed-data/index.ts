import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SEED_DATA = {
  clients: [
    {
      email: "client@demo.de",
      password: "Demo1234!",
      profile: {
        full_name: "Thomas Weber",
        company_name: "TechCorp GmbH",
        phone: "+49 30 12345678",
      },
      company: {
        company_name: "TechCorp GmbH",
        industry: "Technology",
        website: "https://techcorp.de",
        description: "Führender Anbieter für Enterprise Software Lösungen",
        address: "Hauptstraße 123, 10115 Berlin",
      },
      jobs: [
        {
          title: "Senior React Developer",
          description: "Wir suchen einen erfahrenen React Developer für unser Frontend-Team.",
          requirements: "- 5+ Jahre React Erfahrung\n- TypeScript Kenntnisse\n- Erfahrung mit State Management",
          skills: ["React", "TypeScript", "Redux", "GraphQL"],
          must_haves: ["React", "TypeScript"],
          nice_to_haves: ["GraphQL", "AWS"],
          salary_min: 80000,
          salary_max: 100000,
          location: "Berlin",
          remote_type: "hybrid",
          employment_type: "full-time",
          experience_level: "senior",
          status: "published",
        },
        {
          title: "DevOps Engineer",
          description: "Verstärken Sie unser DevOps Team und gestalten Sie unsere Cloud-Infrastruktur.",
          requirements: "- AWS/GCP Erfahrung\n- Kubernetes Kenntnisse\n- CI/CD Expertise",
          skills: ["AWS", "Kubernetes", "Terraform", "Docker"],
          must_haves: ["AWS", "Kubernetes"],
          nice_to_haves: ["Terraform"],
          salary_min: 70000,
          salary_max: 95000,
          location: "Berlin",
          remote_type: "remote",
          employment_type: "full-time",
          experience_level: "mid",
          status: "published",
        },
      ],
    },
    {
      email: "client2@demo.de",
      password: "Demo1234!",
      profile: {
        full_name: "Maria Schmidt",
        company_name: "StartupXYZ",
        phone: "+49 89 87654321",
      },
      company: {
        company_name: "StartupXYZ",
        industry: "FinTech",
        website: "https://startupxyz.de",
        description: "Innovatives FinTech Startup für moderne Zahlungslösungen",
        address: "Innovationsweg 42, 80333 München",
      },
      jobs: [
        {
          title: "Full-Stack Developer",
          description: "Werde Teil unseres Gründerteams und baue unsere Plattform mit auf.",
          requirements: "- Full-Stack Erfahrung\n- Node.js & React\n- Startup-Mentalität",
          skills: ["Node.js", "React", "PostgreSQL", "TypeScript"],
          must_haves: ["Node.js", "React"],
          nice_to_haves: ["PostgreSQL"],
          salary_min: 60000,
          salary_max: 80000,
          location: "München",
          remote_type: "hybrid",
          employment_type: "full-time",
          experience_level: "mid",
          status: "published",
        },
      ],
    },
  ],
  recruiters: [
    {
      email: "recruiter@demo.de",
      password: "Demo1234!",
      profile: {
        full_name: "Max Mustermann",
        company_name: "TalentFinder GmbH",
        phone: "+49 40 11223344",
      },
      candidates: [
        {
          full_name: "Anna Schmidt",
          email: "anna.schmidt@email.de",
          phone: "+49 170 1234567",
          skills: ["React", "TypeScript", "Node.js", "AWS"],
          experience_years: 5,
          expected_salary: 85000,
          current_salary: 72000,
          notice_period: "3 Monate",
          linkedin_url: "https://linkedin.com/in/annaschmidt",
          summary: "Erfahrene Frontend-Entwicklerin mit Fokus auf React und modernem JavaScript.",
        },
        {
          full_name: "Peter Müller",
          email: "peter.mueller@email.de",
          phone: "+49 171 7654321",
          skills: ["DevOps", "AWS", "Kubernetes", "Terraform", "Python"],
          experience_years: 7,
          expected_salary: 90000,
          current_salary: 78000,
          notice_period: "2 Monate",
          linkedin_url: "https://linkedin.com/in/petermueller",
          summary: "Senior DevOps Engineer mit umfangreicher Cloud-Erfahrung.",
        },
        {
          full_name: "Lisa Wagner",
          email: "lisa.wagner@email.de",
          phone: "+49 172 9876543",
          skills: ["React", "Vue.js", "TypeScript", "GraphQL", "PostgreSQL"],
          experience_years: 4,
          expected_salary: 70000,
          current_salary: 58000,
          notice_period: "1 Monat",
          linkedin_url: "https://linkedin.com/in/lisawagner",
          summary: "Full-Stack Entwicklerin mit Leidenschaft für sauberen Code.",
        },
      ],
    },
    {
      email: "recruiter2@demo.de",
      password: "Demo1234!",
      profile: {
        full_name: "Sandra Berger",
        company_name: "Elite Recruiting",
        phone: "+49 69 55667788",
      },
      candidates: [
        {
          full_name: "Michael Braun",
          email: "michael.braun@email.de",
          phone: "+49 173 1112233",
          skills: ["Java", "Spring Boot", "Microservices", "Docker"],
          experience_years: 8,
          expected_salary: 95000,
          current_salary: 85000,
          notice_period: "3 Monate",
          linkedin_url: "https://linkedin.com/in/michaelbraun",
          summary: "Senior Backend Developer mit Enterprise Java Erfahrung.",
        },
      ],
    },
  ],
  admin: {
    email: "admin@demo.de",
    password: "Admin1234!",
    profile: {
      full_name: "Admin User",
      phone: "+49 30 00000000",
    },
  },
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: Record<string, unknown> = {
      clients: [],
      recruiters: [],
      admin: null,
    };

    // Create clients
    for (const clientData of SEED_DATA.clients) {
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: clientData.email,
        password: clientData.password,
        email_confirm: true,
        user_metadata: {
          full_name: clientData.profile.full_name,
          role: "client",
        },
      });

      if (authError) {
        console.log("Client creation skipped (may exist):", clientData.email, authError.message);
        continue;
      }

      const userId = authUser.user.id;

      // Update profile
      await supabase
        .from("profiles")
        .update(clientData.profile)
        .eq("user_id", userId);

      // Create company profile
      await supabase.from("company_profiles").insert({
        user_id: userId,
        ...clientData.company,
      });

      // Create jobs
      const jobIds: string[] = [];
      for (const jobData of clientData.jobs) {
        const { data: job } = await supabase
          .from("jobs")
          .insert({
            client_id: userId,
            company_name: clientData.company.company_name,
            ...jobData,
          })
          .select()
          .single();
        if (job) jobIds.push(job.id);
      }

      (results.clients as Array<unknown>).push({
        email: clientData.email,
        userId,
        jobsCreated: jobIds.length,
      });
    }

    // Create recruiters
    for (const recruiterData of SEED_DATA.recruiters) {
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: recruiterData.email,
        password: recruiterData.password,
        email_confirm: true,
        user_metadata: {
          full_name: recruiterData.profile.full_name,
          role: "recruiter",
        },
      });

      if (authError) {
        console.log("Recruiter creation skipped (may exist):", recruiterData.email, authError.message);
        continue;
      }

      const userId = authUser.user.id;

      // Update profile
      await supabase
        .from("profiles")
        .update(recruiterData.profile)
        .eq("user_id", userId);

      // Create candidates
      const candidateIds: string[] = [];
      for (const candidateData of recruiterData.candidates) {
        const { data: candidate } = await supabase
          .from("candidates")
          .insert({
            recruiter_id: userId,
            ...candidateData,
          })
          .select()
          .single();
        if (candidate) candidateIds.push(candidate.id);
      }

      (results.recruiters as Array<unknown>).push({
        email: recruiterData.email,
        userId,
        candidatesCreated: candidateIds.length,
      });
    }

    // Create admin
    const { data: adminUser, error: adminError } = await supabase.auth.admin.createUser({
      email: SEED_DATA.admin.email,
      password: SEED_DATA.admin.password,
      email_confirm: true,
      user_metadata: {
        full_name: SEED_DATA.admin.profile.full_name,
        role: "admin",
      },
    });

    if (!adminError && adminUser) {
      await supabase
        .from("profiles")
        .update(SEED_DATA.admin.profile)
        .eq("user_id", adminUser.user.id);

      results.admin = {
        email: SEED_DATA.admin.email,
        userId: adminUser.user.id,
      };
    } else {
      console.log("Admin creation skipped (may exist):", adminError?.message);
    }

    console.log("Seed data created:", results);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Seed data created successfully",
        results,
        credentials: {
          clients: SEED_DATA.clients.map((c) => ({ email: c.email, password: c.password })),
          recruiters: SEED_DATA.recruiters.map((r) => ({ email: r.email, password: r.password })),
          admin: { email: SEED_DATA.admin.email, password: SEED_DATA.admin.password },
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Seed data error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
