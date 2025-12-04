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
          fee_percentage: 20,
          recruiter_fee_percentage: 15,
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
          fee_percentage: 18,
          recruiter_fee_percentage: 14,
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
          fee_percentage: 15,
          recruiter_fee_percentage: 12,
        },
        {
          title: "Product Manager",
          description: "Steuere die Produktentwicklung unserer FinTech Plattform.",
          requirements: "- 3+ Jahre PM Erfahrung\n- FinTech Background\n- Agile Methoden",
          skills: ["Product Management", "Agile", "Scrum", "User Research"],
          must_haves: ["Product Management", "Agile"],
          nice_to_haves: ["FinTech"],
          salary_min: 70000,
          salary_max: 90000,
          location: "München",
          remote_type: "hybrid",
          employment_type: "full-time",
          experience_level: "senior",
          status: "published",
          fee_percentage: 18,
          recruiter_fee_percentage: 14,
        },
      ],
    },
    {
      email: "enterprise@demo.de",
      password: "Demo1234!",
      profile: {
        full_name: "Carla Heinz",
        company_name: "Enterprise AG",
        phone: "+49 211 99887766",
      },
      company: {
        company_name: "Enterprise AG",
        industry: "Automotive",
        website: "https://enterprise-ag.de",
        description: "Internationaler Automobilzulieferer mit 5000+ Mitarbeitern",
        address: "Industriestraße 1, 40210 Düsseldorf",
        team_size_range: "1000-5000",
      },
      jobs: [
        {
          title: "Engineering Manager",
          description: "Leiten Sie ein Team von 15 Ingenieuren in unserem Entwicklungszentrum.",
          requirements: "- 10+ Jahre Erfahrung\n- Führungserfahrung\n- Automotive Background",
          skills: ["Leadership", "Automotive", "Project Management", "German"],
          must_haves: ["Leadership", "Automotive"],
          nice_to_haves: ["German"],
          salary_min: 100000,
          salary_max: 130000,
          location: "Düsseldorf",
          remote_type: "onsite",
          employment_type: "full-time",
          experience_level: "lead",
          status: "published",
          fee_percentage: 22,
          recruiter_fee_percentage: 17,
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
        {
          full_name: "Thomas Klein",
          email: "thomas.klein@email.de",
          phone: "+49 173 5556667",
          skills: ["Product Management", "Agile", "Scrum", "Jira", "Analytics"],
          experience_years: 6,
          expected_salary: 80000,
          current_salary: 68000,
          notice_period: "3 Monate",
          linkedin_url: "https://linkedin.com/in/thomasklein",
          summary: "Erfahrener Product Manager mit FinTech Hintergrund.",
        },
        {
          full_name: "Sarah Becker",
          email: "sarah.becker@email.de",
          phone: "+49 174 8889990",
          skills: ["Leadership", "Automotive", "Project Management", "German", "English"],
          experience_years: 12,
          expected_salary: 115000,
          current_salary: 98000,
          notice_period: "6 Monate",
          linkedin_url: "https://linkedin.com/in/sarahbecker",
          summary: "Engineering Lead mit 12 Jahren Erfahrung in der Automobilbranche.",
        },
        {
          full_name: "Jonas Fischer",
          email: "jonas.fischer@email.de",
          phone: "+49 175 1112223",
          skills: ["React", "TypeScript", "Next.js", "TailwindCSS"],
          experience_years: 3,
          expected_salary: 65000,
          current_salary: 52000,
          notice_period: "1 Monat",
          linkedin_url: "https://linkedin.com/in/jonasfischer",
          summary: "Aufstrebender Frontend Developer mit modernem Tech Stack.",
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
        {
          full_name: "Julia Hoffmann",
          email: "julia.hoffmann@email.de",
          phone: "+49 176 4445556",
          skills: ["AWS", "Azure", "Kubernetes", "CI/CD", "Python"],
          experience_years: 5,
          expected_salary: 82000,
          current_salary: 70000,
          notice_period: "2 Monate",
          linkedin_url: "https://linkedin.com/in/juliahoffmann",
          summary: "Cloud Engineer mit Multi-Cloud Expertise.",
        },
        {
          full_name: "Markus Weber",
          email: "markus.weber@email.de",
          phone: "+49 177 7778889",
          skills: ["Node.js", "React", "MongoDB", "GraphQL", "AWS"],
          experience_years: 6,
          expected_salary: 78000,
          current_salary: 65000,
          notice_period: "2 Monate",
          linkedin_url: "https://linkedin.com/in/markusweber",
          summary: "Full-Stack Developer mit Startup-Erfahrung.",
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

    console.log("Starting comprehensive seed data creation...");

    const results: Record<string, unknown> = {
      clients: [],
      recruiters: [],
      admin: null,
      organizations: [],
      submissions: [],
      offers: [],
      placements: [],
      interviews: [],
      talentPool: [],
      references: [],
      dealHealth: [],
      funnelMetrics: [],
      notifications: [],
      messages: [],
      fraudSignals: [],
    };

    const clientUserIds: { email: string; userId: string; jobIds: string[] }[] = [];
    const recruiterUserIds: { email: string; userId: string; candidateIds: string[] }[] = [];

    // ========== CREATE CLIENTS ==========
    for (const clientData of SEED_DATA.clients) {
      let userId: string;
      
      // Check if user exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === clientData.email);
      
      if (existingUser) {
        userId = existingUser.id;
        console.log(`Client exists: ${clientData.email}`);
      } else {
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
          console.log("Client creation error:", clientData.email, authError.message);
          continue;
        }
        userId = authUser.user.id;
        
        await supabase.from("profiles").update(clientData.profile).eq("user_id", userId);
        await supabase.from("company_profiles").insert({ user_id: userId, ...clientData.company });
      }

      // Create or fetch jobs
      const { data: existingJobs } = await supabase.from("jobs").select("id, title").eq("client_id", userId);
      const jobIds: string[] = existingJobs?.map(j => j.id) || [];

      for (const jobData of clientData.jobs) {
        const exists = existingJobs?.find(j => j.title === jobData.title);
        if (!exists) {
          const { data: job } = await supabase.from("jobs").insert({
            client_id: userId,
            company_name: clientData.company.company_name,
            ...jobData,
          }).select().single();
          if (job) jobIds.push(job.id);
        }
      }

      clientUserIds.push({ email: clientData.email, userId, jobIds });
      (results.clients as Array<unknown>).push({ email: clientData.email, userId, jobsCreated: jobIds.length });
    }

    // ========== CREATE RECRUITERS ==========
    for (const recruiterData of SEED_DATA.recruiters) {
      let userId: string;
      
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === recruiterData.email);
      
      if (existingUser) {
        userId = existingUser.id;
        console.log(`Recruiter exists: ${recruiterData.email}`);
      } else {
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
          console.log("Recruiter creation error:", recruiterData.email, authError.message);
          continue;
        }
        userId = authUser.user.id;
        
        await supabase.from("profiles").update(recruiterData.profile).eq("user_id", userId);
      }

      // Create or fetch candidates
      const { data: existingCandidates } = await supabase.from("candidates").select("id, email").eq("recruiter_id", userId);
      const candidateIds: string[] = existingCandidates?.map(c => c.id) || [];

      for (const candidateData of recruiterData.candidates) {
        const exists = existingCandidates?.find(c => c.email === candidateData.email);
        if (!exists) {
          const { data: candidate } = await supabase.from("candidates").insert({
            recruiter_id: userId,
            ...candidateData,
          }).select().single();
          if (candidate) candidateIds.push(candidate.id);
        }
      }

      recruiterUserIds.push({ email: recruiterData.email, userId, candidateIds });
      (results.recruiters as Array<unknown>).push({ email: recruiterData.email, userId, candidatesCreated: candidateIds.length });
    }

    // ========== CREATE ADMIN ==========
    const { data: existingAdmins } = await supabase.auth.admin.listUsers();
    const existingAdmin = existingAdmins?.users?.find(u => u.email === SEED_DATA.admin.email);
    
    if (!existingAdmin) {
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
        await supabase.from("profiles").update(SEED_DATA.admin.profile).eq("user_id", adminUser.user.id);
        results.admin = { email: SEED_DATA.admin.email, userId: adminUser.user.id };
      }
    } else {
      results.admin = { email: SEED_DATA.admin.email, userId: existingAdmin.id };
    }

    // ========== CREATE ORGANIZATION (for Enterprise Client) ==========
    const enterpriseClient = clientUserIds.find(c => c.email === "enterprise@demo.de");
    if (enterpriseClient) {
      const { data: existingOrg } = await supabase.from("organizations").select("id").eq("owner_id", enterpriseClient.userId).single();
      
      if (!existingOrg) {
        const { data: org } = await supabase.from("organizations").insert({
          name: "Enterprise AG",
          type: "client",
          owner_id: enterpriseClient.userId,
          settings: { allow_team_invites: true, default_job_visibility: "team" },
        }).select().single();

        if (org) {
          await supabase.from("organization_members").insert({
            organization_id: org.id,
            user_id: enterpriseClient.userId,
            role: "owner",
            permissions: ["*"],
            status: "active",
          });
          (results.organizations as Array<unknown>).push({ name: "Enterprise AG", id: org.id });
        }
      }
    }

    // ========== CREATE SUBMISSIONS IN ALL STAGES ==========
    const submissionStatuses = [
      "submitted", "submitted", "submitted",
      "opt_in_pending", "opt_in_pending",
      "opt_in_accepted", "opt_in_accepted",
      "reviewing", "reviewing",
      "interview", "interview",
      "interview_completed", "interview_completed",
      "offer_pending",
      "offer_extended",
      "offer_accepted",
      "placed", "placed",
      "rejected", "rejected",
    ];

    const recruiter1 = recruiterUserIds.find(r => r.email === "recruiter@demo.de");
    const recruiter2 = recruiterUserIds.find(r => r.email === "recruiter2@demo.de");
    const client1 = clientUserIds.find(c => c.email === "client@demo.de");
    const client2 = clientUserIds.find(c => c.email === "client2@demo.de");

    if (recruiter1 && recruiter2 && client1 && client2) {
      // Get all candidates
      const { data: allCandidates } = await supabase.from("candidates").select("id, recruiter_id, full_name");
      
      // Check existing submissions
      const { data: existingSubmissions } = await supabase.from("submissions").select("id, candidate_id, job_id");
      
      let submissionIndex = 0;
      const allJobs = [...client1.jobIds, ...client2.jobIds];
      const createdSubmissions: { id: string; status: string; candidateId: string; jobId: string; recruiterId: string }[] = [];

      for (const status of submissionStatuses) {
        if (!allCandidates || allCandidates.length === 0) break;
        
        const candidateIndex = submissionIndex % allCandidates.length;
        const jobIndex = submissionIndex % allJobs.length;
        const candidate = allCandidates[candidateIndex];
        const jobId = allJobs[jobIndex];

        // Skip if submission already exists
        const exists = existingSubmissions?.find(s => s.candidate_id === candidate.id && s.job_id === jobId);
        if (exists) {
          submissionIndex++;
          continue;
        }

        const matchScore = Math.floor(Math.random() * 30) + 70; // 70-100
        const daysAgo = Math.floor(Math.random() * 30);

        const { data: submission } = await supabase.from("submissions").insert({
          job_id: jobId,
          candidate_id: candidate.id,
          recruiter_id: candidate.recruiter_id,
          status,
          match_score: matchScore,
          pitch: `${candidate.full_name} ist ein exzellenter Kandidat für diese Position. Mit starkem technischen Background und großer Motivation.`,
          screening_answers: { "Verfügbarkeit": "Sofort", "Gehaltsvorstellung": "Verhandelbar" },
          created_at: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
        }).select().single();

        if (submission) {
          createdSubmissions.push({ 
            id: submission.id, 
            status, 
            candidateId: candidate.id, 
            jobId, 
            recruiterId: candidate.recruiter_id 
          });
          
          // Create candidate behavior for each submission
          await supabase.from("candidate_behavior").insert({
            candidate_id: candidate.id,
            submission_id: submission.id,
            emails_opened: Math.floor(Math.random() * 10),
            links_clicked: Math.floor(Math.random() * 5),
            company_profile_viewed: Math.random() > 0.3,
            prep_materials_viewed: Math.floor(Math.random() * 3),
            engagement_level: ["low", "medium", "high"][Math.floor(Math.random() * 3)],
            confidence_score: Math.floor(Math.random() * 40) + 60,
            closing_probability: Math.floor(Math.random() * 50) + 50,
            interview_readiness_score: Math.floor(Math.random() * 30) + 70,
          });
        }

        submissionIndex++;
      }

      (results.submissions as Array<unknown>).push(...createdSubmissions.map(s => ({ id: s.id, status: s.status })));
      console.log(`Created ${createdSubmissions.length} submissions`);

      // ========== CREATE INTERVIEWS ==========
      const interviewSubmissions = createdSubmissions.filter(s => 
        ["interview", "interview_completed", "offer_pending", "offer_extended", "offer_accepted", "placed"].includes(s.status)
      );

      for (const sub of interviewSubmissions) {
        const { data: existingInterview } = await supabase.from("interviews").select("id").eq("submission_id", sub.id).single();
        if (existingInterview) continue;

        const isCompleted = ["interview_completed", "offer_pending", "offer_extended", "offer_accepted", "placed"].includes(sub.status);
        const scheduledDate = isCompleted 
          ? new Date(Date.now() - Math.floor(Math.random() * 14) * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + Math.floor(Math.random() * 7 + 1) * 24 * 60 * 60 * 1000);

        const { data: interview } = await supabase.from("interviews").insert({
          submission_id: sub.id,
          scheduled_at: scheduledDate.toISOString(),
          duration_minutes: [30, 45, 60][Math.floor(Math.random() * 3)],
          meeting_type: ["video", "phone", "onsite"][Math.floor(Math.random() * 3)],
          meeting_link: "https://meet.google.com/abc-defg-hij",
          status: isCompleted ? "completed" : "scheduled",
          feedback: isCompleted ? "Sehr guter Kandidat. Technische Fähigkeiten überzeugen, kultureller Fit vorhanden." : null,
          candidate_confirmed: true,
          client_confirmed: true,
        }).select().single();

        if (interview) {
          (results.interviews as Array<unknown>).push({ id: interview.id, status: interview.status });
          
          // Create interview intelligence for completed interviews
          if (isCompleted) {
            await supabase.from("interview_intelligence").insert({
              interview_id: interview.id,
              submission_id: sub.id,
              candidate_summary: "Kandidat zeigt starke technische Kompetenz und gute Kommunikationsfähigkeiten.",
              interviewer_guide: {
                focus_areas: ["Technische Tiefe", "Teamfit", "Motivation"],
                suggested_questions: ["Beschreiben Sie ein komplexes Projekt", "Wie gehen Sie mit Konflikten um?"],
              },
              candidate_prep: {
                company_overview: "Innovatives Tech-Unternehmen mit Fokus auf Qualität",
                interview_tips: ["Pünktlich sein", "Konkrete Beispiele vorbereiten"],
              },
              ai_assessment: {
                technical_score: 85,
                cultural_fit: 80,
                communication: 90,
              },
              hiring_recommendation: "strong_yes",
              recommendation_reasoning: "Kandidat erfüllt alle Anforderungen und zeigt hohes Potential.",
            });
          }
        }
      }

      // ========== CREATE OFFERS ==========
      const offerSubmissions = createdSubmissions.filter(s => 
        ["offer_pending", "offer_extended", "offer_accepted", "placed"].includes(s.status)
      );

      const createdOffers: { id: string; submissionId: string; status: string }[] = [];

      for (const sub of offerSubmissions) {
        const { data: existingOffer } = await supabase.from("offers").select("id").eq("submission_id", sub.id).single();
        if (existingOffer) {
          createdOffers.push({ id: existingOffer.id, submissionId: sub.id, status: sub.status });
          continue;
        }

        // Get job and candidate details
        const { data: job } = await supabase.from("jobs").select("*").eq("id", sub.jobId).single();
        const { data: candidate } = await supabase.from("candidates").select("*").eq("id", sub.candidateId).single();

        if (!job || !candidate) continue;

        const offerStatus = sub.status === "offer_pending" ? "draft" 
          : sub.status === "offer_extended" ? "sent" 
          : "accepted";

        const salaryOffered = Math.floor((job.salary_min + job.salary_max) / 2);

        const { data: offer } = await supabase.from("offers").insert({
          submission_id: sub.id,
          job_id: sub.jobId,
          candidate_id: sub.candidateId,
          client_id: job.client_id,
          recruiter_id: sub.recruiterId,
          position_title: job.title,
          salary_offered: salaryOffered,
          salary_currency: "EUR",
          start_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          status: offerStatus,
          expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          benefits: { vacation_days: 30, home_office: true, equipment_budget: 2000 },
          sent_at: offerStatus !== "draft" ? new Date().toISOString() : null,
          access_token: crypto.randomUUID(),
          decision_at: offerStatus === "accepted" ? new Date().toISOString() : null,
        }).select().single();

        if (offer) {
          createdOffers.push({ id: offer.id, submissionId: sub.id, status: offerStatus });
          (results.offers as Array<unknown>).push({ id: offer.id, status: offerStatus });
        }
      }

      // ========== CREATE PLACEMENTS ==========
      const placedSubmissions = createdSubmissions.filter(s => s.status === "placed");

      for (const sub of placedSubmissions) {
        const { data: existingPlacement } = await supabase.from("placements").select("id").eq("submission_id", sub.id).single();
        if (existingPlacement) continue;

        const offer = createdOffers.find(o => o.submissionId === sub.id);
        const { data: job } = await supabase.from("jobs").select("*").eq("id", sub.jobId).single();

        if (!job) continue;

        const salary = Math.floor((job.salary_min + job.salary_max) / 2);
        const feePercentage = job.fee_percentage || 20;
        const feeAmount = Math.floor(salary * (feePercentage / 100));

        const { data: placement } = await supabase.from("placements").insert({
          submission_id: sub.id,
          offer_id: offer?.id || null,
          job_id: sub.jobId,
          candidate_id: sub.candidateId,
          client_id: job.client_id,
          recruiter_id: sub.recruiterId,
          start_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          salary,
          fee_percentage: feePercentage,
          fee_amount: feeAmount,
          status: "confirmed",
          guarantee_end_date: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        }).select().single();

        if (placement) {
          (results.placements as Array<unknown>).push({ id: placement.id, feeAmount });
        }
      }

      // ========== CREATE TALENT POOL ENTRIES ==========
      const rejectedSubmissions = createdSubmissions.filter(s => s.status === "rejected");
      
      for (const sub of rejectedSubmissions) {
        const { data: existing } = await supabase.from("talent_pool").select("id").eq("candidate_id", sub.candidateId).single();
        if (existing) continue;

        const poolType = Math.random() > 0.5 ? "silver_medalist" : "future_fit";
        const { data: candidate } = await supabase.from("candidates").select("*").eq("id", sub.candidateId).single();

        const { data: poolEntry } = await supabase.from("talent_pool").insert({
          candidate_id: sub.candidateId,
          recruiter_id: sub.recruiterId,
          pool_type: poolType,
          added_reason: poolType === "silver_medalist" 
            ? "Sehr guter Kandidat, nur knapp hinter dem Platzierten"
            : "Noch 1-2 Jahre Erfahrung nötig, dann ideal",
          skills: candidate?.skills || [],
          experience_level: candidate?.experience_years > 5 ? "senior" : "mid",
          target_roles: ["Developer", "Engineer"],
          notes: "Im Talent Pool für zukünftige Positionen",
          status: "active",
        }).select().single();

        if (poolEntry) {
          (results.talentPool as Array<unknown>).push({ id: poolEntry.id, poolType });
        }
      }

      // ========== CREATE REFERENCE REQUESTS ==========
      const offerAcceptedSubs = createdSubmissions.filter(s => ["offer_accepted", "placed"].includes(s.status));

      for (const sub of offerAcceptedSubs) {
        const { data: existing } = await supabase.from("reference_requests").select("id").eq("submission_id", sub.id).single();
        if (existing) continue;

        const { data: candidate } = await supabase.from("candidates").select("full_name").eq("id", sub.candidateId).single();

        const { data: refRequest } = await supabase.from("reference_requests").insert({
          submission_id: sub.id,
          candidate_id: sub.candidateId,
          reference_name: "Dr. Martin Schneider",
          reference_email: "martin.schneider@ex-company.de",
          reference_company: "Ex-Arbeitgeber AG",
          reference_title: "Engineering Manager",
          relationship: "manager",
          access_token: crypto.randomUUID(),
          status: sub.status === "placed" ? "completed" : "pending",
          expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        }).select().single();

        if (refRequest) {
          (results.references as Array<unknown>).push({ id: refRequest.id, status: refRequest.status });

          // Create response for completed references
          if (refRequest.status === "completed") {
            await supabase.from("reference_responses").insert({
              request_id: refRequest.id,
              overall_rating: 5,
              technical_skills: 5,
              communication: 4,
              teamwork: 5,
              reliability: 5,
              leadership: 4,
              would_rehire: true,
              recommendation_level: "strong_yes",
              strengths: "Technisch exzellent, hervorragender Teamplayer, sehr zuverlässig",
              areas_for_improvement: "Könnte bei Präsentationen noch selbstbewusster auftreten",
              additional_comments: "Würde jederzeit wieder mit dieser Person zusammenarbeiten.",
              ai_summary: "Hervorragende Referenz. Der Kandidat wird als hochkompetent, teamfähig und sehr zuverlässig beschrieben. Klare Empfehlung.",
              ai_sentiment: "very_positive",
            });
          }
        }
      }

      // ========== CREATE DEAL HEALTH SCORES ==========
      for (const sub of createdSubmissions.slice(0, 15)) {
        const { data: existing } = await supabase.from("deal_health").select("id").eq("submission_id", sub.id).single();
        if (existing) continue;

        const healthScore = Math.floor(Math.random() * 40) + 60;
        const riskLevel = healthScore >= 80 ? "low" : healthScore >= 60 ? "medium" : "high";

        await supabase.from("deal_health").insert({
          submission_id: sub.id,
          health_score: healthScore,
          risk_level: riskLevel,
          drop_off_probability: (100 - healthScore) / 100,
          days_since_last_activity: Math.floor(Math.random() * 7),
          bottleneck: riskLevel === "high" ? "client_review" : null,
          bottleneck_days: riskLevel === "high" ? Math.floor(Math.random() * 5) + 3 : 0,
          risk_factors: riskLevel !== "low" ? ["Lange Reaktionszeit", "Gehaltsdiskrepanz"] : [],
          recommended_actions: ["Follow-up senden", "Interview-Feedback einholen", "Gehaltsspanne klären"],
          ai_assessment: `Deal Health Score: ${healthScore}%. ${riskLevel === "high" ? "Sofortige Aktion empfohlen." : "Kandidat ist auf gutem Weg."}`,
        });

        (results.dealHealth as Array<unknown>).push({ submissionId: sub.id, healthScore, riskLevel });
      }

      // ========== CREATE FUNNEL METRICS ==========
      const periods = [
        { start: "2024-10-01", end: "2024-10-31" },
        { start: "2024-11-01", end: "2024-11-30" },
        { start: "2024-12-01", end: "2024-12-31" },
      ];

      for (const recruiter of [recruiter1, recruiter2]) {
        for (const period of periods) {
          const { data: existing } = await supabase.from("funnel_metrics")
            .select("id")
            .eq("entity_id", recruiter.userId)
            .eq("period_start", period.start)
            .single();
          
          if (existing) continue;

          const totalSubmissions = Math.floor(Math.random() * 15) + 10;
          const optInRate = 0.7 + Math.random() * 0.2;
          const interviewRate = 0.6 + Math.random() * 0.3;
          const offerRate = 0.4 + Math.random() * 0.3;

          await supabase.from("funnel_metrics").insert({
            entity_type: "recruiter",
            entity_id: recruiter.userId,
            period_start: period.start,
            period_end: period.end,
            total_submissions: totalSubmissions,
            submissions_to_opt_in: Math.floor(totalSubmissions * optInRate),
            opt_in_to_interview: Math.floor(totalSubmissions * optInRate * interviewRate),
            interview_to_offer: Math.floor(totalSubmissions * optInRate * interviewRate * offerRate),
            offer_to_placement: Math.floor(totalSubmissions * optInRate * interviewRate * offerRate * 0.8),
            opt_in_rate: optInRate,
            interview_rate: interviewRate,
            offer_rate: offerRate,
            acceptance_rate: 0.75 + Math.random() * 0.2,
            avg_time_to_opt_in_hours: Math.floor(Math.random() * 48) + 12,
            avg_time_to_interview_days: Math.floor(Math.random() * 7) + 3,
            avg_time_to_offer_days: Math.floor(Math.random() * 14) + 7,
            avg_time_to_fill_days: Math.floor(Math.random() * 30) + 20,
            avg_match_score: 75 + Math.random() * 15,
          });
        }
        (results.funnelMetrics as Array<unknown>).push({ recruiterId: recruiter.userId, periods: periods.length });
      }

      // ========== CREATE NOTIFICATIONS ==========
      const notificationTypes = [
        { type: "new_submission", title: "Neue Bewerbung eingegangen", message: "Anna Schmidt hat sich auf Senior React Developer beworben" },
        { type: "interview_scheduled", title: "Interview geplant", message: "Interview mit Peter Müller am 15.01.2025 um 14:00 Uhr" },
        { type: "offer_accepted", title: "Angebot angenommen", message: "Lisa Wagner hat das Angebot für Full-Stack Developer akzeptiert" },
        { type: "deadline_warning", title: "SLA Warnung", message: "Antwortfrist für Bewerbung läuft in 24h ab" },
        { type: "new_message", title: "Neue Nachricht", message: "Sie haben eine neue Nachricht von TechCorp GmbH" },
      ];

      for (const client of [client1, client2]) {
        for (const notif of notificationTypes.slice(0, 3)) {
          await supabase.from("notifications").insert({
            user_id: client.userId,
            type: notif.type,
            title: notif.title,
            message: notif.message,
            is_read: Math.random() > 0.5,
            related_type: "submission",
            related_id: createdSubmissions[0]?.id,
          });
        }
      }

      for (const recruiter of [recruiter1, recruiter2]) {
        for (const notif of notificationTypes) {
          await supabase.from("notifications").insert({
            user_id: recruiter.userId,
            type: notif.type,
            title: notif.title,
            message: notif.message,
            is_read: Math.random() > 0.5,
            related_type: "submission",
            related_id: createdSubmissions[0]?.id,
          });
        }
      }

      (results.notifications as Array<unknown>).push({ created: notificationTypes.length * 4 });

      // ========== CREATE MESSAGES ==========
      const messageContents = [
        "Der Kandidat ist sehr motiviert und könnte sofort starten.",
        "Können wir den Interview-Termin auf nächste Woche verschieben?",
        "Hier sind die gewünschten Referenzen des Kandidaten.",
        "Das Gehalt liegt leicht über unserem Budget - gibt es Spielraum?",
        "Der Kandidat hat alle technischen Fragen hervorragend beantwortet.",
      ];

      for (const msg of messageContents) {
        const senderId = Math.random() > 0.5 ? recruiter1.userId : client1.userId;
        const recipientId = senderId === recruiter1.userId ? client1.userId : recruiter1.userId;
        
        await supabase.from("messages").insert({
          sender_id: senderId,
          recipient_id: recipientId,
          conversation_id: `${recruiter1.userId}-${client1.userId}`,
          content: msg,
          is_read: Math.random() > 0.3,
          job_id: client1.jobIds[0],
        });
      }

      (results.messages as Array<unknown>).push({ created: messageContents.length });

      // ========== CREATE FRAUD SIGNALS ==========
      const fraudTypes = [
        { type: "duplicate_candidate", severity: "medium", details: { reason: "Ähnlicher Kandidat bereits im System gefunden" } },
        { type: "suspicious_activity", severity: "low", details: { reason: "Ungewöhnlich schnelle Bewerbungsrate" } },
      ];

      for (const fraud of fraudTypes) {
        const sub = createdSubmissions[Math.floor(Math.random() * createdSubmissions.length)];
        if (!sub) continue;

        await supabase.from("fraud_signals").insert({
          signal_type: fraud.type,
          severity: fraud.severity,
          candidate_id: sub.candidateId,
          submission_id: sub.id,
          confidence_score: 0.65 + Math.random() * 0.25,
          status: "pending",
          details: fraud.details,
          evidence: [{ type: "pattern_match", score: 0.78 }],
        });
      }

      (results.fraudSignals as Array<unknown>).push({ created: fraudTypes.length });

      // ========== CREATE INFLUENCE ALERTS ==========
      for (const sub of createdSubmissions.slice(0, 5)) {
        await supabase.from("influence_alerts").insert({
          recruiter_id: sub.recruiterId,
          submission_id: sub.id,
          alert_type: ["engagement_drop", "deadline_approaching", "high_potential"][Math.floor(Math.random() * 3)],
          title: "Handlungsbedarf erkannt",
          message: "Kandidaten-Engagement ist in den letzten 3 Tagen gesunken.",
          recommended_action: "Persönlichen Kontakt aufnehmen und Interesse bestätigen.",
          priority: ["low", "medium", "high"][Math.floor(Math.random() * 3)],
          is_read: false,
          is_dismissed: false,
        });
      }
    }

    console.log("Seed data creation completed:", results);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Extended seed data created successfully",
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    return new Response(JSON.stringify({ error: errorMessage, stack: errorStack }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
