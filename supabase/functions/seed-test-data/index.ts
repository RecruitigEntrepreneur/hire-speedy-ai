import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Test accounts - Leon (Client) & Marko (Recruiter)
const TEST_ACCOUNTS = {
  client: {
    email: "leon.benko92@gmail.com",
    name: "Leon Benko",
    company: "Bluewater Bridge GmbH",
  },
  recruiter: {
    email: "marko.benko@malmalhigh.de", 
    name: "Marko Benko",
    company: "MalmalHigh Recruiting",
  },
};

// Realistic test jobs for Leon
const TEST_JOBS = [
  {
    title: "Senior Frontend Developer (React/TypeScript)",
    description: `Wir suchen einen erfahrenen Frontend Developer für unser wachsendes Entwicklungsteam.

Du wirst an unserer SaaS-Plattform arbeiten und modernste Technologien einsetzen.

**Deine Aufgaben:**
- Entwicklung von React-Komponenten mit TypeScript
- Code Reviews und Mentoring von Junior Devs
- Enge Zusammenarbeit mit UX/Design Team
- Performance-Optimierung der Web-Applikation`,
    requirements: `- 5+ Jahre Erfahrung mit React/TypeScript
- Solide Kenntnisse in State Management (Redux/Zustand)
- Erfahrung mit Testing (Jest, Cypress)
- Fließend Deutsch und Englisch`,
    skills: ["React", "TypeScript", "TailwindCSS", "Jest", "GraphQL"],
    must_haves: ["React", "TypeScript"],
    nice_to_haves: ["GraphQL", "AWS", "Next.js"],
    salary_min: 75000,
    salary_max: 95000,
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
    description: `Gestalte unsere Cloud-Infrastruktur und CI/CD Pipelines.

Als DevOps Engineer bist du verantwortlich für die Automatisierung und Optimierung unserer Deployment-Prozesse.

**Was dich erwartet:**
- Aufbau und Wartung von Kubernetes Clustern
- Infrastructure as Code mit Terraform
- Monitoring & Alerting Setup
- Security Best Practices implementieren`,
    requirements: `- 4+ Jahre DevOps/SRE Erfahrung
- AWS oder GCP Expertise
- Kubernetes & Docker
- CI/CD Pipeline Erfahrung (GitHub Actions, GitLab CI)`,
    skills: ["AWS", "Kubernetes", "Terraform", "Docker", "Python"],
    must_haves: ["AWS", "Kubernetes", "Docker"],
    nice_to_haves: ["Terraform", "ArgoCD"],
    salary_min: 70000,
    salary_max: 90000,
    location: "Berlin",
    remote_type: "remote",
    employment_type: "full-time",
    experience_level: "mid",
    status: "published",
    fee_percentage: 18,
    recruiter_fee_percentage: 14,
  },
  {
    title: "Product Manager - B2B SaaS",
    description: `Werde Teil unseres Produktteams und gestalte die Zukunft unserer B2B Plattform.

**Verantwortlichkeiten:**
- Entwicklung der Produkt-Roadmap
- Stakeholder Management
- User Research & Data-Driven Decisions
- Sprint Planning mit dem Entwicklungsteam`,
    requirements: `- 4+ Jahre PM Erfahrung im B2B SaaS
- Erfahrung mit agilen Methoden
- Technisches Verständnis
- Starke Kommunikationsfähigkeiten`,
    skills: ["Product Management", "Agile", "Scrum", "Jira", "SQL"],
    must_haves: ["Product Management", "Agile"],
    nice_to_haves: ["B2B SaaS", "SQL"],
    salary_min: 75000,
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
    title: "Data Engineer",
    description: `Baue und optimiere unsere Daten-Infrastruktur.

**Deine Aufgaben:**
- Design und Implementierung von Data Pipelines
- Data Warehouse Architektur
- Zusammenarbeit mit Data Science Team
- Datenqualität und Governance`,
    requirements: `- 4+ Jahre Data Engineering
- Python & SQL Expertise
- Erfahrung mit Spark/Airflow
- Cloud Data Platforms (BigQuery, Snowflake)`,
    skills: ["Python", "SQL", "Spark", "Airflow", "BigQuery"],
    must_haves: ["Python", "SQL", "Spark"],
    nice_to_haves: ["dbt", "BigQuery"],
    salary_min: 70000,
    salary_max: 95000,
    location: "Berlin",
    remote_type: "hybrid",
    employment_type: "full-time",
    experience_level: "mid",
    status: "published",
    fee_percentage: 18,
    recruiter_fee_percentage: 14,
  },
  {
    title: "UX/UI Designer",
    description: `Gestalte intuitive und ansprechende Benutzeroberflächen für unsere Produkte.

**Was du mitbringst:**
- Portfolio mit Web/Mobile Projekten
- Erfahrung mit Design Systems
- User Research Skills
- Prototyping & Testing`,
    requirements: `- 3+ Jahre UX/UI Design
- Figma Expertise
- Verständnis für Frontend Development
- Agile Team-Erfahrung`,
    skills: ["Figma", "UX Design", "UI Design", "Prototyping", "User Research"],
    must_haves: ["Figma", "UX Design"],
    nice_to_haves: ["Frontend", "Animation"],
    salary_min: 55000,
    salary_max: 75000,
    location: "Berlin",
    remote_type: "hybrid",
    employment_type: "full-time",
    experience_level: "mid",
    status: "paused", // For testing paused jobs
    fee_percentage: 15,
    recruiter_fee_percentage: 12,
  },
];

// Realistic candidates for Marko
const TEST_CANDIDATES = [
  {
    full_name: "Anna Weber",
    email: "anna.weber@testmail.de",
    phone: "+49 170 1234567",
    skills: ["React", "TypeScript", "Node.js", "GraphQL", "AWS"],
    experience_years: 5,
    expected_salary: 88000,
    current_salary: 72000,
    notice_period: "3 Monate",
    linkedin_url: "https://linkedin.com/in/anna-weber-dev",
    summary: "Erfahrene Frontend-Entwicklerin mit Fokus auf React und modernem JavaScript. Aktuell bei einem FinTech Startup tätig.",
    preferred_channel: "email",
  },
  {
    full_name: "Thomas Schmidt",
    email: "thomas.schmidt@testmail.de",
    phone: "+49 171 2345678",
    skills: ["AWS", "Kubernetes", "Terraform", "Docker", "Python", "Go"],
    experience_years: 7,
    expected_salary: 95000,
    current_salary: 82000,
    notice_period: "2 Monate",
    linkedin_url: "https://linkedin.com/in/thomas-schmidt-devops",
    summary: "Senior DevOps Engineer mit 7 Jahren Cloud-Erfahrung. AWS Certified Solutions Architect.",
    preferred_channel: "phone",
  },
  {
    full_name: "Julia Müller",
    email: "julia.mueller@testmail.de",
    phone: "+49 172 3456789",
    skills: ["Product Management", "Agile", "Scrum", "SQL", "Jira", "Confluence"],
    experience_years: 4,
    expected_salary: 78000,
    current_salary: 65000,
    notice_period: "3 Monate",
    linkedin_url: "https://linkedin.com/in/julia-mueller-pm",
    summary: "Product Manager mit B2B SaaS Erfahrung. Leidenschaft für User-Centric Design.",
    preferred_channel: "email",
  },
  {
    full_name: "Michael Braun",
    email: "michael.braun@testmail.de",
    phone: "+49 173 4567890",
    skills: ["Python", "SQL", "Spark", "Airflow", "BigQuery", "dbt"],
    experience_years: 6,
    expected_salary: 90000,
    current_salary: 76000,
    notice_period: "3 Monate",
    linkedin_url: "https://linkedin.com/in/michael-braun-data",
    summary: "Data Engineer mit Erfahrung in der Entwicklung skalierbarer Data Pipelines.",
    preferred_channel: "whatsapp",
  },
  {
    full_name: "Sarah Fischer",
    email: "sarah.fischer@testmail.de",
    phone: "+49 174 5678901",
    skills: ["Figma", "UX Design", "UI Design", "Prototyping", "HTML", "CSS"],
    experience_years: 3,
    expected_salary: 62000,
    current_salary: 52000,
    notice_period: "1 Monat",
    linkedin_url: "https://linkedin.com/in/sarah-fischer-design",
    summary: "UX/UI Designerin mit Fokus auf B2B Produkte. Portfolio mit Web & Mobile Projekten.",
    preferred_channel: "email",
  },
  {
    full_name: "Maximilian Koch",
    email: "max.koch@testmail.de",
    phone: "+49 175 6789012",
    skills: ["React", "TypeScript", "Node.js", "PostgreSQL", "GraphQL"],
    experience_years: 4,
    expected_salary: 75000,
    current_salary: 62000,
    notice_period: "2 Monate",
    linkedin_url: "https://linkedin.com/in/max-koch-fullstack",
    summary: "Full-Stack Developer mit Fokus auf moderne Web-Technologien. Startup-erfahren.",
    preferred_channel: "email",
  },
  {
    full_name: "Laura Hoffmann",
    email: "laura.hoffmann@testmail.de",
    phone: "+49 176 7890123",
    skills: ["Java", "Spring Boot", "PostgreSQL", "Docker", "Microservices"],
    experience_years: 5,
    expected_salary: 85000,
    current_salary: 70000,
    notice_period: "3 Monate",
    linkedin_url: "https://linkedin.com/in/laura-hoffmann-backend",
    summary: "Backend Entwicklerin mit Enterprise Java Erfahrung. Clean Code Enthusiast.",
    preferred_channel: "phone",
  },
  {
    full_name: "Daniel Wagner",
    email: "daniel.wagner@testmail.de",
    phone: "+49 177 8901234",
    skills: ["AWS", "GCP", "Kubernetes", "Terraform", "Python", "CI/CD"],
    experience_years: 8,
    expected_salary: 105000,
    current_salary: 92000,
    notice_period: "3 Monate",
    linkedin_url: "https://linkedin.com/in/daniel-wagner-cloud",
    summary: "Cloud Architect mit 8 Jahren Erfahrung. Multi-Cloud Expertise.",
    preferred_channel: "email",
  },
];

// Submission stages for testing the full funnel
const SUBMISSION_STAGES = [
  { stage: "submitted", status: "submitted" },
  { stage: "submitted", status: "submitted" },
  { stage: "opt_in_pending", status: "opt_in_pending" },
  { stage: "opt_in_accepted", status: "opt_in_accepted" },
  { stage: "screening", status: "screening" },
  { stage: "interview", status: "interview" },
  { stage: "offer_extended", status: "offer_extended" },
  { stage: "placed", status: "placed" },
  { stage: "rejected", status: "rejected" },
  { stage: "rejected", status: "rejected" },
];

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("🚀 Starting test data creation for Leon & Marko...");

    const results = {
      client: null as any,
      recruiter: null as any,
      jobs: [] as any[],
      candidates: [] as any[],
      submissions: [] as any[],
      interviews: [] as any[],
      offers: [] as any[],
      placements: [] as any[],
      messages: [] as any[],
      notifications: [] as any[],
      dealHealth: [] as any[],
      influenceAlerts: [] as any[],
      candidateBehavior: [] as any[],
    };

    // ========== FIND LEON (CLIENT) ==========
    console.log("📧 Looking for Leon (Client)...");
    const { data: allUsers } = await supabase.auth.admin.listUsers();
    const leonUser = allUsers?.users?.find(u => u.email === TEST_ACCOUNTS.client.email);
    
    if (!leonUser) {
      return new Response(JSON.stringify({ 
        error: `Client account not found: ${TEST_ACCOUNTS.client.email}. Please create this account first.` 
      }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    
    const leonId = leonUser.id;
    results.client = { email: TEST_ACCOUNTS.client.email, id: leonId };
    console.log(`✅ Found Leon: ${leonId}`);

    // ========== FIND MARKO (RECRUITER) ==========
    console.log("📧 Looking for Marko (Recruiter)...");
    const markoUser = allUsers?.users?.find(u => u.email === TEST_ACCOUNTS.recruiter.email);
    
    if (!markoUser) {
      return new Response(JSON.stringify({ 
        error: `Recruiter account not found: ${TEST_ACCOUNTS.recruiter.email}. Please create this account first.` 
      }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    
    const markoId = markoUser.id;
    results.recruiter = { email: TEST_ACCOUNTS.recruiter.email, id: markoId };
    console.log(`✅ Found Marko: ${markoId}`);

    // ========== ENSURE COMPANY PROFILE FOR LEON ==========
    console.log("🏢 Setting up company profile for Leon...");
    const { data: existingCompany } = await supabase
      .from("company_profiles")
      .select("*")
      .eq("user_id", leonId)
      .single();

    if (!existingCompany) {
      await supabase.from("company_profiles").insert({
        user_id: leonId,
        company_name: TEST_ACCOUNTS.client.company,
        industry: "Technology",
        website: "https://bluewater-bridge.de",
        description: "Innovative SaaS-Lösungen für den Mittelstand",
        address: "Torstraße 150, 10115 Berlin",
        team_size_range: "50-100",
        remote_policy: "hybrid",
        work_style: "Flexibel mit viel Eigenverantwortung",
      });
      console.log("✅ Company profile created");
    }

    // ========== CREATE JOBS FOR LEON ==========
    console.log("💼 Creating jobs for Leon...");
    const createdJobIds: string[] = [];
    
    for (const jobData of TEST_JOBS) {
      // Check if job already exists
      const { data: existingJob } = await supabase
        .from("jobs")
        .select("id")
        .eq("client_id", leonId)
        .eq("title", jobData.title)
        .single();

      if (existingJob) {
        createdJobIds.push(existingJob.id);
        console.log(`  ⏩ Job already exists: ${jobData.title}`);
        continue;
      }

      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .insert({
          client_id: leonId,
          company_name: TEST_ACCOUNTS.client.company,
          ...jobData,
        })
        .select()
        .single();

      if (job) {
        createdJobIds.push(job.id);
        results.jobs.push({ id: job.id, title: job.title });
        console.log(`  ✅ Created job: ${job.title}`);
      } else {
        console.log(`  ❌ Error creating job: ${jobData.title}`, jobError);
      }
    }

    // ========== CREATE CANDIDATES FOR MARKO ==========
    console.log("👤 Creating candidates for Marko...");
    const createdCandidateIds: string[] = [];
    
    for (const candidateData of TEST_CANDIDATES) {
      // Check if candidate already exists
      const { data: existingCandidate } = await supabase
        .from("candidates")
        .select("id")
        .eq("recruiter_id", markoId)
        .eq("email", candidateData.email)
        .single();

      if (existingCandidate) {
        createdCandidateIds.push(existingCandidate.id);
        console.log(`  ⏩ Candidate already exists: ${candidateData.full_name}`);
        continue;
      }

      const { data: candidate, error: candError } = await supabase
        .from("candidates")
        .insert({
          recruiter_id: markoId,
          ...candidateData,
        })
        .select()
        .single();

      if (candidate) {
        createdCandidateIds.push(candidate.id);
        results.candidates.push({ id: candidate.id, name: candidate.full_name });
        console.log(`  ✅ Created candidate: ${candidate.full_name}`);
      } else {
        console.log(`  ❌ Error creating candidate: ${candidateData.full_name}`, candError);
      }
    }

    // ========== CREATE SUBMISSIONS IN ALL STAGES ==========
    console.log("📝 Creating submissions across all stages...");
    const createdSubmissionIds: string[] = [];
    const publishedJobIds = createdJobIds.slice(0, 4); // Only use published jobs (not the paused one)

    for (let i = 0; i < Math.min(SUBMISSION_STAGES.length, createdCandidateIds.length); i++) {
      const candidateId = createdCandidateIds[i];
      const jobId = publishedJobIds[i % publishedJobIds.length];
      const stageData = SUBMISSION_STAGES[i];

      // Check if submission already exists
      const { data: existingSubmission } = await supabase
        .from("submissions")
        .select("id")
        .eq("candidate_id", candidateId)
        .eq("job_id", jobId)
        .single();

      if (existingSubmission) {
        createdSubmissionIds.push(existingSubmission.id);
        console.log(`  ⏩ Submission already exists for candidate ${i + 1}`);
        continue;
      }

      // Calculate match score based on stage
      const matchScore = 60 + Math.floor(Math.random() * 35);
      
      const submissionData: Record<string, any> = {
        job_id: jobId,
        candidate_id: candidateId,
        recruiter_id: markoId,
        status: stageData.status,
        stage: stageData.stage,
        match_score: matchScore,
        recruiter_notes: `Sehr guter Kandidat für diese Position. Match Score: ${matchScore}%.`,
        submitted_at: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000).toISOString(), // Different dates
      };

      // Add opt-in timestamp for accepted candidates
      if (["opt_in_accepted", "screening", "interview", "offer_extended", "placed"].includes(stageData.stage)) {
        submissionData.opt_in_requested_at = new Date(Date.now() - (i + 2) * 24 * 60 * 60 * 1000).toISOString();
        submissionData.opt_in_responded_at = new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000).toISOString();
        submissionData.identity_unlocked = true;
        submissionData.identity_unlocked_at = new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000).toISOString();
      }

      // Add rejection reason for rejected
      if (stageData.status === "rejected") {
        submissionData.client_notes = "Leider nicht passend für die aktuelle Position.";
      }

      const { data: submission, error: subError } = await supabase
        .from("submissions")
        .insert(submissionData)
        .select()
        .single();

      if (submission) {
        createdSubmissionIds.push(submission.id);
        results.submissions.push({ 
          id: submission.id, 
          stage: stageData.stage,
          candidateIndex: i + 1
        });
        console.log(`  ✅ Created submission: Stage ${stageData.stage}`);
      } else {
        console.log(`  ❌ Error creating submission`, subError);
      }
    }

    // ========== CREATE INTERVIEWS ==========
    console.log("📅 Creating interviews...");
    const interviewSubmissions = createdSubmissionIds.filter((_, i) => 
      ["interview", "offer_extended", "placed"].includes(SUBMISSION_STAGES[i]?.stage || "")
    );

    for (let i = 0; i < interviewSubmissions.length; i++) {
      const submissionId = interviewSubmissions[i];
      
      // Check if interview exists
      const { data: existingInterview } = await supabase
        .from("interviews")
        .select("id")
        .eq("submission_id", submissionId)
        .single();

      if (existingInterview) {
        console.log(`  ⏩ Interview already exists`);
        continue;
      }

      const scheduledDate = new Date(Date.now() + (i + 1) * 2 * 24 * 60 * 60 * 1000);
      const statuses = ["confirmed", "completed", "pending"];
      const status = statuses[i % statuses.length];

      const { data: interview, error: intError } = await supabase
        .from("interviews")
        .insert({
          submission_id: submissionId,
          scheduled_at: scheduledDate.toISOString(),
          duration_minutes: 60,
          meeting_type: i % 2 === 0 ? "video" : "onsite",
          status,
          meeting_link: status === "confirmed" ? `https://meet.google.com/abc-def-${i}` : null,
          candidate_confirmed: status !== "pending",
          client_confirmed: status !== "pending",
          feedback: status === "completed" ? "Sehr gutes Gespräch. Kandidat hat überzeugt." : null,
        })
        .select()
        .single();

      if (interview) {
        results.interviews.push({ id: interview.id, status });
        console.log(`  ✅ Created interview: ${status}`);
      }
    }

    // ========== CREATE OFFERS ==========
    console.log("💰 Creating offers...");
    const offerSubmissions = createdSubmissionIds.filter((_, i) => 
      ["offer_extended", "placed"].includes(SUBMISSION_STAGES[i]?.stage || "")
    );

    for (let i = 0; i < offerSubmissions.length; i++) {
      const submissionId = offerSubmissions[i];
      const stageIndex = createdSubmissionIds.indexOf(submissionId);
      const candidateId = createdCandidateIds[stageIndex];
      const jobId = publishedJobIds[stageIndex % publishedJobIds.length];
      
      // Check if offer exists
      const { data: existingOffer } = await supabase
        .from("offers")
        .select("id")
        .eq("submission_id", submissionId)
        .single();

      if (existingOffer) {
        console.log(`  ⏩ Offer already exists`);
        continue;
      }

      const isPlaced = SUBMISSION_STAGES[stageIndex]?.stage === "placed";
      const status = isPlaced ? "accepted" : "sent";
      
      const { data: offer, error: offError } = await supabase
        .from("offers")
        .insert({
          submission_id: submissionId,
          job_id: jobId,
          candidate_id: candidateId,
          recruiter_id: markoId,
          client_id: leonId,
          status,
          base_salary: 80000 + i * 5000,
          bonus: 5000,
          total_compensation: 85000 + i * 5000,
          start_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          benefits: ["25 Urlaubstage", "Home Office", "Weiterbildungsbudget", "JobRad"],
          valid_until: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          notes_client: "Attraktives Gesamtpaket mit Entwicklungsmöglichkeiten.",
          access_token: crypto.randomUUID(),
          sent_at: new Date().toISOString(),
          viewed_at: isPlaced ? new Date().toISOString() : null,
          accepted_at: isPlaced ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (offer) {
        results.offers.push({ id: offer.id, status });
        console.log(`  ✅ Created offer: ${status}`);

        // Create placement for accepted offer
        if (isPlaced) {
          const { data: placement, error: placementError } = await supabase
            .from("placements")
            .insert({
              submission_id: submissionId,
              job_id: jobId,
              candidate_id: candidateId,
              recruiter_id: markoId,
              client_id: leonId,
              offer_id: offer.id,
              status: "confirmed",
              start_date: offer.start_date,
              salary: offer.base_salary,
              fee_amount: Math.round(offer.base_salary * 0.20),
              fee_percentage: 20,
              placed_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (placement) {
            results.placements.push({ id: placement.id });
            console.log(`  ✅ Created placement`);
          }
        }
      }
    }

    // ========== CREATE MESSAGES ==========
    console.log("💬 Creating messages...");
    const messageThreads = [
      {
        messages: [
          { sender: "recruiter", content: "Hallo! Ich habe einen sehr starken Kandidaten für die Senior Frontend Position." },
          { sender: "client", content: "Super, klingt interessant! Können Sie mir mehr Details schicken?" },
          { sender: "recruiter", content: "Natürlich! Der Kandidat hat 5 Jahre React-Erfahrung und passt perfekt zu Ihrem Tech Stack." },
          { sender: "client", content: "Sehr gut. Bitte schicken Sie mir das Profil zur Ansicht." },
        ]
      },
      {
        messages: [
          { sender: "recruiter", content: "Kurze Rückfrage zum Interview-Termin morgen - steht der noch?" },
          { sender: "client", content: "Ja, alles wie geplant. 14:00 Uhr Video-Call." },
          { sender: "recruiter", content: "Perfekt, der Kandidat ist vorbereitet und freut sich!" },
        ]
      }
    ];

    for (let i = 0; i < messageThreads.length && i < createdSubmissionIds.length; i++) {
      const submissionId = createdSubmissionIds[i];
      const thread = messageThreads[i];

      // Check if messages exist for this submission
      const { data: existingMessages } = await supabase
        .from("messages")
        .select("id")
        .eq("submission_id", submissionId)
        .limit(1);

      if (existingMessages && existingMessages.length > 0) {
        console.log(`  ⏩ Messages already exist for submission ${i + 1}`);
        continue;
      }

      for (let j = 0; j < thread.messages.length; j++) {
        const msg = thread.messages[j];
        const senderId = msg.sender === "recruiter" ? markoId : leonId;
        const receiverId = msg.sender === "recruiter" ? leonId : markoId;
        
        const { error: msgError } = await supabase
          .from("messages")
          .insert({
            submission_id: submissionId,
            sender_id: senderId,
            receiver_id: receiverId,
            content: msg.content,
            is_read: j < thread.messages.length - 1, // Last message unread
            created_at: new Date(Date.now() - (thread.messages.length - j) * 60 * 60 * 1000).toISOString(),
          });

        if (!msgError) {
          results.messages.push({ submissionId, content: msg.content.substring(0, 30) + "..." });
        }
      }
      console.log(`  ✅ Created ${thread.messages.length} messages for submission ${i + 1}`);
    }

    // ========== CREATE NOTIFICATIONS ==========
    console.log("🔔 Creating notifications...");
    const notifications = [
      { user_id: leonId, type: "new_submission", title: "Neuer Kandidat vorgeschlagen", message: "Anna Weber wurde für 'Senior Frontend Developer' vorgeschlagen." },
      { user_id: leonId, type: "interview_scheduled", title: "Interview geplant", message: "Interview mit Thomas Schmidt am 15.12.2025 um 14:00 Uhr." },
      { user_id: leonId, type: "offer_accepted", title: "Angebot angenommen!", message: "Herzlichen Glückwunsch! Der Kandidat hat Ihr Angebot akzeptiert." },
      { user_id: markoId, type: "opt_in_accepted", title: "Opt-In erhalten", message: "Anna Weber hat dem Opt-In zugestimmt." },
      { user_id: markoId, type: "submission_update", title: "Status Update", message: "Ihr Kandidat Thomas Schmidt ist in die Interview-Phase übergegangen." },
      { user_id: markoId, type: "payout_available", title: "Auszahlung verfügbar", message: "Eine neue Vermittlungsprovision steht zur Auszahlung bereit." },
    ];

    for (const notif of notifications) {
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          ...notif,
          is_read: false,
          created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

      if (!notifError) {
        results.notifications.push({ title: notif.title });
      }
    }
    console.log(`  ✅ Created ${notifications.length} notifications`);

    // ========== CREATE DEAL HEALTH RECORDS ==========
    console.log("🏥 Creating deal health records...");
    for (let i = 0; i < createdSubmissionIds.length; i++) {
      const submissionId = createdSubmissionIds[i];
      const stage = SUBMISSION_STAGES[i]?.stage || "submitted";
      
      // Skip rejected submissions
      if (stage === "rejected") continue;

      // Check if deal health exists
      const { data: existingHealth } = await supabase
        .from("deal_health")
        .select("id")
        .eq("submission_id", submissionId)
        .single();

      if (existingHealth) continue;

      const healthScore = stage === "placed" ? 95 : 
                         stage === "offer_extended" ? 85 :
                         stage === "interview" ? 70 :
                         50 + Math.floor(Math.random() * 30);

      const riskLevel = healthScore >= 80 ? "low" : healthScore >= 60 ? "medium" : "high";

      const { error: healthError } = await supabase
        .from("deal_health")
        .insert({
          submission_id: submissionId,
          health_score: healthScore,
          risk_level: riskLevel,
          days_since_last_activity: Math.floor(Math.random() * 5),
          drop_off_probability: 100 - healthScore,
          risk_factors: riskLevel === "high" ? ["Lange Inaktivität", "Niedrige Engagement-Rate"] : [],
          recommended_actions: riskLevel !== "low" ? ["Follow-up Anruf", "Status Update einholen"] : [],
          ai_assessment: `Deal ist ${riskLevel === "low" ? "auf gutem Weg" : riskLevel === "medium" ? "unter Beobachtung" : "gefährdet"}.`,
        });

      if (!healthError) {
        results.dealHealth.push({ submissionId, healthScore, riskLevel });
      }
    }
    console.log(`  ✅ Created deal health records`);

    // ========== CREATE INFLUENCE ALERTS FOR MARKO ==========
    console.log("⚡ Creating influence alerts...");
    const alerts = [
      {
        submission_id: createdSubmissionIds[0],
        recruiter_id: markoId,
        alert_type: "engagement_drop",
        title: "Engagement gesunken",
        message: "Anna Weber hat seit 3 Tagen keine Emails geöffnet.",
        priority: "high",
        recommended_action: "Jetzt anrufen und Status klären",
      },
      {
        submission_id: createdSubmissionIds[1],
        recruiter_id: markoId,
        alert_type: "interview_prep",
        title: "Interview in 24h",
        message: "Thomas Schmidt hat morgen ein Interview. Prep-Call empfohlen.",
        priority: "critical",
        recommended_action: "15-Minuten Prep-Call durchführen",
      },
      {
        submission_id: createdSubmissionIds[2],
        recruiter_id: markoId,
        alert_type: "opt_in_pending",
        title: "Opt-In ausstehend",
        message: "Julia Müller hat noch nicht auf den Opt-In reagiert.",
        priority: "medium",
        recommended_action: "Erinnerungs-Email senden",
      },
    ];

    for (const alert of alerts) {
      if (!alert.submission_id) continue;

      // Check if alert exists
      const { data: existingAlert } = await supabase
        .from("influence_alerts")
        .select("id")
        .eq("submission_id", alert.submission_id)
        .eq("alert_type", alert.alert_type)
        .single();

      if (existingAlert) continue;

      const { error: alertError } = await supabase
        .from("influence_alerts")
        .insert({
          ...alert,
          is_read: false,
          is_dismissed: false,
          created_at: new Date().toISOString(),
        });

      if (!alertError) {
        results.influenceAlerts.push({ type: alert.alert_type, priority: alert.priority });
      }
    }
    console.log(`  ✅ Created influence alerts`);

    // ========== CREATE CANDIDATE BEHAVIOR SCORES ==========
    console.log("📊 Creating candidate behavior scores...");
    for (let i = 0; i < createdSubmissionIds.length; i++) {
      const submissionId = createdSubmissionIds[i];
      const candidateId = createdCandidateIds[i];
      
      if (!candidateId) continue;

      // Check if behavior exists
      const { data: existingBehavior } = await supabase
        .from("candidate_behavior")
        .select("id")
        .eq("submission_id", submissionId)
        .single();

      if (existingBehavior) continue;

      const engagementLevel = ["high", "medium", "low"][i % 3];
      const confidenceScore = 50 + Math.floor(Math.random() * 50);

      const { error: behaviorError } = await supabase
        .from("candidate_behavior")
        .insert({
          submission_id: submissionId,
          candidate_id: candidateId,
          engagement_level: engagementLevel,
          confidence_score: confidenceScore,
          closing_probability: confidenceScore - 10 + Math.floor(Math.random() * 20),
          interview_readiness_score: 40 + Math.floor(Math.random() * 60),
          emails_opened: Math.floor(Math.random() * 10),
          emails_sent: Math.floor(Math.random() * 5) + 1,
          links_clicked: Math.floor(Math.random() * 8),
          company_profile_viewed: Math.random() > 0.3,
          prep_materials_viewed: Math.floor(Math.random() * 5),
          last_engagement_at: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000).toISOString(),
          days_since_engagement: Math.floor(Math.random() * 5),
        });

      if (!behaviorError) {
        results.candidateBehavior.push({ candidateId, engagementLevel, confidenceScore });
      }
    }
    console.log(`  ✅ Created candidate behavior scores`);

    // ========== CREATE RECRUITER INFLUENCE SCORE ==========
    console.log("🎯 Creating recruiter influence score...");
    const { data: existingInfluence } = await supabase
      .from("recruiter_influence_scores")
      .select("id")
      .eq("recruiter_id", markoId)
      .single();

    if (!existingInfluence) {
      await supabase.from("recruiter_influence_scores").insert({
        recruiter_id: markoId,
        influence_score: 78,
        candidate_satisfaction_score: 82,
        employer_satisfaction_score: 75,
        total_influenced_placements: 5,
        avg_time_to_placement_days: 28,
        response_rate: 0.92,
        alert_action_rate: 0.85,
        total_alerts_received: 24,
        alerts_actioned: 20,
      });
      console.log("  ✅ Created recruiter influence score");
    }

    // ========== SUMMARY ==========
    console.log("\n🎉 Test data creation complete!");
    console.log("=".repeat(50));
    console.log(`📧 Client: ${TEST_ACCOUNTS.client.email}`);
    console.log(`📧 Recruiter: ${TEST_ACCOUNTS.recruiter.email}`);
    console.log(`💼 Jobs created: ${results.jobs.length}`);
    console.log(`👤 Candidates created: ${results.candidates.length}`);
    console.log(`📝 Submissions created: ${results.submissions.length}`);
    console.log(`📅 Interviews created: ${results.interviews.length}`);
    console.log(`💰 Offers created: ${results.offers.length}`);
    console.log(`✅ Placements created: ${results.placements.length}`);
    console.log(`💬 Messages created: ${results.messages.length}`);
    console.log(`🔔 Notifications created: ${results.notifications.length}`);
    console.log("=".repeat(50));

    return new Response(
      JSON.stringify({
        success: true,
        message: "Test data created successfully!",
        accounts: {
          client: TEST_ACCOUNTS.client,
          recruiter: TEST_ACCOUNTS.recruiter,
        },
        summary: {
          jobs: results.jobs.length,
          candidates: results.candidates.length,
          submissions: results.submissions.length,
          interviews: results.interviews.length,
          offers: results.offers.length,
          placements: results.placements.length,
          messages: results.messages.length,
          notifications: results.notifications.length,
          dealHealth: results.dealHealth.length,
          influenceAlerts: results.influenceAlerts.length,
          candidateBehavior: results.candidateBehavior.length,
        },
        details: results,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("❌ Error creating test data:", errorMessage);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        stack: errorStack 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
};

serve(handler);
