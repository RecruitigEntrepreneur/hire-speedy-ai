import type de from "./de";

// English locale. Typed against the German locale so missing keys surface at compile time.
const en: typeof de = {
  "team": {
    "title": "Team Management",
    "tabs": {
      "members": "Members",
      "audit": "Audit Log",
      "settings": "Settings"
    },
    "roles": {
      "owner": "Owner",
      "admin": "Administrator",
      "hr": "HR / Recruiting",
      "hiring_manager": "Hiring Manager",
      "viewer": "Viewer",
      "finance": "Finance",
      "admin_desc": "Can manage users and sees all jobs & candidates",
      "hr_desc": "Sees all company jobs & candidates, no user management",
      "hiring_manager_desc": "Sees only assigned jobs: intake, candidate review, interviews",
      "viewer_desc": "Read-only access to assigned jobs, may comment"
    },
    "activate": {
      "title": "Activate team",
      "description": "Invite colleagues — e.g. hiring managers who manage their own positions.",
      "button": "Activate team"
    },
    "invite": {
      "button": "Invite member",
      "title": "Invite team member",
      "description": "The invitation is sent by email and is valid for 7 days.",
      "email": "Email address",
      "role": "Role",
      "role_placeholder": "Select role",
      "jobs": "Assigned jobs",
      "jobs_hint": "Hiring managers and viewers only see the jobs assigned here.",
      "no_jobs": "No jobs yet — assignment can happen later.",
      "cancel": "Cancel",
      "submit": "Send invitation",
      "sent_title": "Invitation sent",
      "sent_hint": "You can also share the invitation link directly.",
      "created_title": "Invitation created",
      "created_hint": "Email delivery failed — share the link directly.",
      "done": "Done",
      "link_copied": "Link copied"
    },
    "invites": {
      "title": "Pending invitations",
      "expires": "Expires",
      "job": "job",
      "jobs": "jobs",
      "revoke": "Revoke invitation"
    },
    "members": {
      "title": "Team members",
      "updated": "Member updated",
      "update_error": "Error while updating",
      "deactivate_confirm": "Deactivate this member? Access is revoked immediately.",
      "unknown": "Unknown",
      "you": "You",
      "deactivated": "Deactivated",
      "last_login": "Last login",
      "never_logged_in": "Never logged in",
      "change_role": "Change role",
      "reactivate": "Reactivate",
      "deactivate": "Deactivate",
      "empty": "No team members found"
    },
    "audit": {
      "title": "Audit log",
      "description": "Team events and candidate data access in your organization",
      "empty": "No entries yet",
      "member_added": "Member added ({{role}})",
      "role_changed": "Role changed: {{from}} → {{to}}",
      "member_deactivated": "Member deactivated",
      "member_reactivated": "Member reactivated",
      "invite_created": "Invitation created for {{email}}",
      "invite_accepted": "Invitation accepted by {{email}}",
      "invite_deleted": "Invitation revoked ({{email}})",
      "candidate_viewed": "Candidate profile viewed"
    },
    "settings": {
      "saved": "Settings saved",
      "save_error": "Error while saving",
      "intake_title": "Intake approval",
      "intake_description": "Controls whether job intakes by hiring managers require internal approval before reaching us.",
      "intake_label": "Internal approval required",
      "intake_on_hint": "Intakes by hiring managers go to Admin/HR for approval first.",
      "intake_off_hint": "Intakes by hiring managers reach us directly.",
      "org_title": "Organization",
      "org_name": "Name",
      "billing_email": "Billing email",
      "save": "Save"
    },
    "accept": {
      "loading": "Checking invitation…",
      "success_title": "Successfully joined!",
      "success_hint": "Redirecting…",
      "expired_title": "Invitation expired",
      "expired_hint": "This invitation has expired. Please request a new one.",
      "invalid_title": "Invalid invitation",
      "invalid_hint": "This invitation is invalid or has already been used.",
      "to_home": "Go to homepage",
      "title": "You have been invited",
      "description": "{{org}} wants to add you as a team member",
      "an_organization": "An organization",
      "your_role": "Your role",
      "invited_as": "Invited as",
      "assigned_jobs": "Assigned jobs",
      "valid_until": "Valid until",
      "accept_button": "Accept invitation",
      "login_button": "Log in and accept",
      "login_hint": "An account already exists for this email. Please log in.",
      "full_name": "Your name",
      "password": "Password",
      "password_min": "At least 8 characters",
      "password_confirm": "Confirm password",
      "password_mismatch": "Passwords do not match",
      "create_account_button": "Create account & join"
    }
  },
  "nav": {
    "features": "Features",
    "solutions": "Solutions",
    "pricing": "Pricing",
    "resources": "Resources",
    "company": "Company",
    "signIn": "Sign in",
    "startNow": "Get started free",
    "dashboard": "Dashboard",
    "settings": "Settings",
    "signOut": "Sign out",
    "features_items": {
      "matching": "AI Matching Engine",
      "matching_desc": "AI-powered candidate selection",
      "interview": "Automated Interview Flow",
      "interview_desc": "Fully automated processes",
      "network": "Recruiter Network",
      "network_desc": "Personally vetted recruiters",
      "escrow": "Escrow & Payments",
      "escrow_desc": "Secure payment handling",
      "compliance": "Compliance & GDPR",
      "compliance_desc": "GDPR-compliant, EU hosting",
      "analytics": "Analytics & Reporting",
      "analytics_desc": "Real-time insights"
    },
    "solutions_items": {
      "companies": "For Companies",
      "companies_desc": "Find top talent faster",
      "recruiters": "For Recruiters & Agencies",
      "recruiters_desc": "Higher commissions, better deals",
      "smb": "For SMBs & Startups",
      "smb_desc": "Success-based, no fixed fees",
      "enterprise": "For Enterprise",
      "enterprise_desc": "Tailored solutions on request"
    },
    "resources_items": {
      "blog": "Blog",
      "blog_desc": "Insights & best practices",
      "guides": "Guides",
      "guides_desc": "Step-by-step tutorials",
      "faq": "FAQ",
      "faq_desc": "Frequently asked questions",
      "help": "Help Center",
      "help_desc": "Support & help",
      "docs": "Documentation",
      "docs_desc": "Technical documentation"
    },
    "company_items": {
      "about": "About us",
      "about_desc": "Our mission & team",
      "careers": "Careers",
      "careers_desc": "Join the team",
      "press": "Press",
      "press_desc": "News & media kit",
      "contact": "Contact",
      "contact_desc": "Talk to us"
    }
  },
  "hero": {
    "badge": "Triple-Blind · Success-based · DACH",
    "headline1": "Perfect Match.",
    "headline2": "Perfect Hire.",
    "subline_1": "Vetted recruiters submit matching candidates – anonymized. Companies hire.",
    "subline_strong": "You only pay on success.",
    "ctaPrimary": "Post a job for free",
    "ctaSecondary": "Become a recruiter",
    "microProof": "No fixed fees · Pay only on hire · GDPR-compliant",
    "scroll": "Scroll"
  },
  "auth": {
    "backToHome": "Back to home",
    "signupTitle": "Create your account",
    "signinTitle": "Welcome back",
    "signupDesc": "Join Matchunt and start hiring or recruiting",
    "signinDesc": "Sign in to access your dashboard",
    "tabSignin": "Sign in",
    "tabSignup": "Sign up",
    "fullName": "Full name",
    "fullNamePlaceholder": "John Doe",
    "iAmA": "I am a...",
    "email": "Email",
    "emailPlaceholder": "you@example.com",
    "password": "Password",
    "createAccount": "Create account",
    "signinButton": "Sign in",
    "secure": "Your data is secure and encrypted",
    "role": {
      "client": "Company",
      "clientDesc": "I want to hire",
      "recruiter": "Recruiter",
      "recruiterDesc": "I want to submit candidates"
    },
    "errors": {
      "email": "Please enter a valid email address",
      "password": "Password must be at least 6 characters",
      "fullName": "Name must be at least 2 characters"
    },
    "toast": {
      "signupSuccess": "Account created successfully!",
      "welcomeBack": "Welcome back!",
      "alreadyRegistered": "This email is already registered. Please sign in instead.",
      "invalidCredentials": "Invalid email or password. Please try again.",
      "unexpected": "An unexpected error occurred. Please try again."
    }
  },
  "socialProof": {
    "eyebrow": "Built with recruiters and hiring teams from the DACH market",
    "heading": "Three principles instead of big promises",
    "marqueeText": "Faster · More precise · Fairer · Results-driven · ",
    "principles": {
      "item1_title": "Success-based",
      "item1_description": "No fixed costs, no retainers. You only pay upon a successful hire – secured via escrow.",
      "item2_title": "Verified recruiters",
      "item2_description": "Every recruiter on the platform is personally verified before they can submit candidates.",
      "item3_title": "Discretion by design",
      "item3_description": "Triple-Blind anonymization protects candidates, recruiters, and companies. That is also why we never name client companies – discretion is our product."
    }
  },
  "problem": {
    "headline_main": "Hiring is Broken.",
    "headline_accent": "Everywhere.",
    "intro": "Today's recruiting system is a patchwork of tools, emails, ATS systems, freelancers, agencies and chance.",
    "tagline": "We replace chaos with clarity.",
    "cta": "See how we solve it",
    "painPoints": {
      "item1_title": "Wasted Time",
      "item1_description": "Processes that take weeks instead of minutes. Every day a role stays open costs money and productivity.",
      "item2_title": "Uncontrolled Communication",
      "item2_description": "Candidates drop out. Recruiters operate blind. No one knows where the process stands.",
      "item3_title": "Misaligned Incentives",
      "item3_description": "No alignment between companies, recruiters and candidates. The system rewards quantity, not quality."
    }
  },
  "tripleBlind": {
    "badge": "Triple-Blind",
    "headline1": "Nobody sees more",
    "headline2": "than they need to.",
    "subline": "The only recruiting marketplace in the DACH region that protects all three sides – until both sides say yes. See for yourself who sees what and when.",
    "cta": "Start with Triple-Blind",
    "caption_before": "Before the match, identity, hiring company and contact details stay hidden.",
    "caption_after": "Only once both sides agree are the protected fields released.",
    "toggle": {
      "before": "Before the match",
      "after": "After mutual opt-in"
    },
    "parties": {
      "company_role": "Company",
      "company_tagline": "Evaluates suitability, not résumés.",
      "company_field1_label": "Skills & fit score",
      "company_field1_before": "Fully visible",
      "company_field1_after": "Fully visible",
      "company_field2_label": "Experience & salary",
      "company_field2_before": "As a range",
      "company_field2_after": "As a range",
      "company_field3_label": "Region",
      "company_field3_before": "Southern Germany",
      "company_field3_after": "Southern Germany",
      "company_field4_label": "Name & contact",
      "company_field4_before": "Hidden",
      "company_field4_after": "Released",
      "recruiter_role": "Recruiter",
      "recruiter_tagline": "Keeps their own candidate.",
      "recruiter_field1_label": "Assignment & requirements",
      "recruiter_field1_before": "Fully visible",
      "recruiter_field1_after": "Fully visible",
      "recruiter_field2_label": "Own candidate",
      "recruiter_field2_before": "Exclusively assigned",
      "recruiter_field2_after": "Exclusively assigned",
      "recruiter_field3_label": "Hiring company",
      "recruiter_field3_before": "[Industry] company",
      "recruiter_field3_after": "Disclosed",
      "recruiter_field4_label": "Commission protection",
      "recruiter_field4_before": "Guaranteed",
      "recruiter_field4_after": "Guaranteed",
      "candidate_role": "Candidate",
      "candidate_tagline": "Searches discreetly, stays in control.",
      "candidate_field1_label": "Identity",
      "candidate_field1_before": "Anonymous (Candidate #A1B2)",
      "candidate_field1_after": "Self-disclosed",
      "candidate_field2_label": "Matching roles",
      "candidate_field2_before": "Fully visible",
      "candidate_field2_after": "Fully visible",
      "candidate_field3_label": "Current employer",
      "candidate_field3_before": "Protected",
      "candidate_field3_after": "Protected",
      "candidate_field4_label": "Data release",
      "candidate_field4_before": "With consent only",
      "candidate_field4_after": "Granted"
    },
    "benefits": {
      "item1_party": "For companies",
      "item1_title": "Bias-free, fair selection",
      "item1_text": "You see skills and fit — not name, photo or background. Prejudice is ruled out before it can even arise. GDPR-compliant data protection is built into the process, not bolted on.",
      "item2_party": "For recruiters",
      "item2_title": "Your candidate stays your candidate",
      "item2_text": "The company only sees your candidate once the deal runs through Matchunt. No backdoor hiring behind your back — your commission is secured.",
      "item3_party": "For candidates",
      "item3_title": "Discreet search without risk",
      "item3_text": "Anonymous on the market, without your current employer noticing a thing. You decide yourself who sees which data and when."
    }
  },
  "engine": {
    "heading1": "The Recruiting",
    "heading2": "Operating System",
    "subline1": "One platform. One network. One automated hiring stack.",
    "subline2": "Everything orchestrated by AI, secured by process – built for results.",
    "layer1_title": "AI Matching Layer",
    "layer1_description": "Understands roles. Understands people. Understands fit.",
    "layer2_title": "Recruiter Performance Marketplace",
    "layer2_description": "Top recruiters, algorithmically selected, ranked by performance.",
    "layer3_title": "Triple-Blind Identity Protection",
    "layer3_description": "No bias. No circumvention. No compliance risks.",
    "layer4_title": "Workflow Automation Engine",
    "layer4_description": "WhatsApp, SMS, email, interviews, offers, escrow. All without lifting a finger manually.",
    "layer5_title": "Intelligence Layer",
    "layer5_description": "Employer Score. Candidate Readiness. Conversion Analytics. Every step is measurable.",
    "cta": "Explore the technology"
  },
  "howItWorks": {
    "eyebrow": "How It Works",
    "heading": "The 60-Second Journey",
    "subline": "From job description to signed contract – fully automated.",
    "steps": {
      "item1_title": "Upload",
      "item1_subtitle": "You give us your job",
      "item1_description": "Link, PDF or text – our AI automatically extracts must-haves, skills, salary data and seniority-based requirements.",
      "item1_detail1": "URL parsing",
      "item1_detail2": "PDF extraction",
      "item1_detail3": "Free-text analysis",
      "item1_detail4": "Skill mapping",
      "item2_title": "Curated Submissions",
      "item2_subtitle": "Vetted recruiters deliver",
      "item2_description": "Triple-Blind. Fair. Performance-based. Only the best recruiters with the most fitting candidates reach you.",
      "item2_detail1": "AI matching",
      "item2_detail2": "Anonymization",
      "item2_detail3": "Quality Score",
      "item2_detail4": "Behavior Tracking",
      "item3_title": "Interview & Hire",
      "item3_subtitle": "Automated all the way to the offer",
      "item3_description": "The system automatically schedules interviews, sends reminders, collects feedback and guides you to the signed offer.",
      "item3_detail1": "Auto-Scheduling",
      "item3_detail2": "Multi-Channel",
      "item3_detail3": "Escrow Payment",
      "item3_detail4": "Digital Signing"
    },
    "quote_part1": "Ready in minutes.",
    "quote_part2": "Results in days.",
    "cta": "Start your job now"
  },
  "features": {
    "eyebrow": "Deep Features",
    "headline1": "The Tools that Make You",
    "headline2": "Faster than Your Competition",
    "item1_title": "AI Matching & Readiness Score",
    "item1_description": "Our AI doesn't just assess skills. It understands motivation, behavior, cultural fit and the likelihood of an offer.",
    "item1_score1_label": "Skill Match",
    "item1_score2_label": "Experience Fit",
    "item1_score3_label": "Salary Fit",
    "item1_score4_label": "Readiness Score",
    "item1_score5_label": "Closing Probability",
    "item1_cta": "See AI in action",
    "item2_title": "Identity Protection / Triple Blind",
    "item2_description": "Candidates are anonymized until they consent. Recruiters don't see companies. Companies don't see any data before the candidate allows it.",
    "item2_subtext": "This is fairness. This is compliance. This is the future.",
    "item3_title": "Workflow Automation Engine",
    "item3_description": "Interviews schedule themselves. Offers send themselves. Payments run automatically. Reminders eliminate ghosting.",
    "item3_automation1_label": "Auto-Scheduling",
    "item3_automation2_label": "Email Sequences",
    "item3_automation3_label": "WhatsApp & SMS",
    "item3_automation4_label": "Escrow Payments",
    "item4_title": "ATS Integrations",
    "item4_description": "Your processes stay where they are. Integrations with common ATS systems are built based on customer demand.",
    "tripleBlind_role1_label": "Candidate",
    "tripleBlind_role1_sub": "anonymized",
    "tripleBlind_role2_label": "Recruiter",
    "tripleBlind_role2_sub": "blind",
    "tripleBlind_role3_label": "Company",
    "tripleBlind_role3_sub": "protected",
    "tripleBlind_compliance": "GDPR-compliant, EU hosting",
    "automation_footer": "Fully automated – Zero Admin Work",
    "integrations_footer": "+ more integrations on request"
  },
  "forCompanies": {
    "eyebrow": "For Companies",
    "headline": "Hire with Precision",
    "subline": "The fastest and most effective way to find and hire top talent.",
    "cta": "Start a job",
    "benefits": {
      "item1_title": "Candidates in days, not weeks",
      "item1_description": "Your first qualified candidate suggestions typically arrive within days – instead of waiting for weeks.",
      "item2_title": "Success-based model",
      "item2_description": "You only pay when you actually hire. No fixed costs, no retainers.",
      "item3_title": "Transparency & full control",
      "item3_description": "See every step of the process. At any time. In real time.",
      "item4_title": "Deep Analytics & Funnel Insights",
      "item4_description": "Understand where candidates drop off and optimize your hiring pipeline."
    }
  },
  "forRecruiters": {
    "eyebrow": "For Recruiters",
    "headline1": "Earn More.",
    "headline2": "Work Smarter.",
    "headline3": "Close Faster.",
    "intro": "Access to exclusive assignments. Intelligent tools for better placements. Fair compensation with full transparency.",
    "benefits": {
      "item1_text": "Top jobs every day",
      "item2_text": "Intelligent CRM",
      "item3_text": "Coaching engine for more placements",
      "item4_text": "Zero admin work",
      "item5_text": "Maximum fairness & transparency"
    },
    "cta": "Become a recruiter",
    "cockpit_title": "Your recruiter cockpit",
    "cockpit_subtitle": "This is what your workday looks like",
    "stat1_title": "Transparent",
    "stat1_text": "Commission visible before accepting the assignment",
    "stat2_title": "Secured",
    "stat2_text": "Payout via escrow",
    "notifications": {
      "item1_text": "New assignment available",
      "item2_text": "Interview confirmed",
      "item3_text": "Payout released"
    },
    "badge": "Your candidate stays your candidate"
  },
  "analytics": {
    "eyebrow": "Analytics",
    "headline1": "Clarity is",
    "headline2": "Power",
    "subline": "See every step. Understand bottlenecks. Optimize decisions. With real-time analytics, you have full control over your hiring pipeline.",
    "cta": "Discover analytics",
    "features": {
      "item1_text": "Time to Interview Tracking",
      "item2_text": "Offer Acceptance Rate",
      "item3_text": "Funnel Conversion Analysis",
      "item4_text": "Recruiter Performance Heatmap"
    },
    "dashboard": {
      "title": "Hiring Dashboard",
      "period": "Last 30 days"
    },
    "metrics": {
      "item1_label": "Time to Interview",
      "item1_unit": "days",
      "item1_trend": "↓ 24% vs. previous month",
      "item2_label": "Offer Acceptance",
      "item2_unit": "%",
      "item2_trend": "↑ 12% vs. previous month",
      "item3_label": "Active candidates",
      "item3_unit": "",
      "item3_trend": "+18 this week",
      "item4_label": "Placements",
      "item4_unit": "",
      "item4_trend": "Target: 10"
    },
    "funnel": {
      "title": "Funnel Conversion",
      "item1_label": "Submitted",
      "item2_label": "Opt-In",
      "item3_label": "Interview",
      "item4_label": "Offer",
      "item5_label": "Placed"
    }
  },
  "pricing": {
    "eyebrow": "Pricing",
    "headline1": "Simple, Fair,",
    "headline2": "Aligned with You",
    "modelBadge": "Success-based model",
    "cta": "Start risk-free now",
    "ctaNote": "No credit card required • Free registration",
    "features": {
      "item1": "No fixed costs",
      "item2": "No retainers",
      "item3": "No surprises",
      "item4": "You only pay when you actually hire"
    },
    "trustFeatures": {
      "item1_text": "Automated escrow",
      "item2_text": "Digital invoices",
      "item3_text": "Transparent fees"
    }
  },
  "trustSecurity": {
    "eyebrow": "Trust & Security",
    "headline1": "Built for Enterprise.",
    "headline2": "Ready for Scale.",
    "subline": "The highest security standards for your most sensitive recruiting data.",
    "ctaPrivacy": "Learn more about data protection",
    "features": {
      "item1_title": "GDPR-compliant",
      "item1_description": "EU hosting, data processing agreement (DPA) included",
      "item2_title": "Encryption",
      "item2_description": "Data is encrypted in transit and at rest",
      "item3_title": "Identity Protection",
      "item3_description": "Triple-Blind anonymization protects all parties",
      "item4_title": "Escrow Engine",
      "item4_description": "Secure payment processing with escrow service",
      "item5_title": "Audit Logs",
      "item5_description": "Complete documentation of all activities",
      "item6_title": "EU Data Centers",
      "item6_description": "Data is stored exclusively within the EU"
    }
  },
  "faq": {
    "eyebrow": "FAQ",
    "title": "Frequently Asked Questions",
    "subtitle": "Everything you need to know before you get started.",
    "faqs": {
      "item1_question": "How quickly do I get candidates?",
      "item1_answer": "As a rule, you will receive the first qualified candidate suggestions within a few days. Our network of verified recruiters starts working on suitable matches immediately after your job posting goes live.",
      "item2_question": "How secure are my data and that of the candidates?",
      "item2_answer": "We are GDPR-compliant: all data is stored exclusively in EU data centers, encrypted both in transit and at rest, and a data processing agreement (DPA) is included. Triple-Blind anonymization additionally protects everyone involved.",
      "item3_question": "What does using the platform cost?",
      "item3_answer": "Our model is purely success-based – you only pay upon a successful hire. No fixed costs, no retainers, no hidden fees. The exact commission is communicated transparently before the process begins and is settled securely through our escrow system.",
      "item4_question": "What if there is no suitable candidate among them?",
      "item4_answer": "Should the proposed candidates not meet your requirements, you incur no costs. Our AI matching and the performance-based recruiter rankings are designed to suggest only candidates who are a genuine fit. If needed, we refine the search criteria together.",
      "item5_question": "How is candidate quality guaranteed?",
      "item5_answer": "Quality is ensured through several mechanisms: AI-powered match scores, verified recruiters with performance tracking, structured candidate profiles with skills assessment, and a transparent feedback system. Only recruiters with proven top performance gain access to your assignments.",
      "item6_question": "Can I integrate the platform with my ATS?",
      "item6_answer": "Integrations with common ATS systems (e.g. Personio, Greenhouse, Lever) are in development. Let us know which system you use – we prioritize integrations based on our customers' needs."
    }
  },
  "finalCta": {
    "badge": "Put Precision into Your Hiring",
    "headline1": "Start Hiring like it's",
    "headlineYearNew": "2030",
    "headline2": "Not like it's 2010.",
    "subline": "The future of recruiting is here. And it won't wait.",
    "ctaPrimary": "Post a job in 60 seconds",
    "reassurance": "No costs. No commitment. Just results."
  },
  "footer": {
    "tagline": "The Recruiting Operating System. Powered by AI. Delivered by Experts. Engineered for Results.",
    "colTitle_company": "Company",
    "colTitle_recruiter": "Recruiter",
    "colTitle_platform": "Platform",
    "colTitle_info": "Info",
    "links_company_forCompanies": "For Companies",
    "links_company_pricing": "Pricing",
    "links_company_enterprise": "Enterprise",
    "links_recruiter_forRecruiters": "For Recruiters",
    "links_recruiter_guides": "Guides",
    "links_recruiter_helpCenter": "Help Center",
    "links_platform_features": "Features",
    "links_platform_security": "Security",
    "links_platform_documentation": "Documentation",
    "links_info_about": "About Us",
    "links_info_careers": "Careers",
    "links_info_press": "Press",
    "links_info_contact": "Contact",
    "copyright": "Matchunt - a brand of bluewater & Bridge GmbH. All rights reserved.",
    "legal_privacy": "Privacy Policy",
    "legal_terms": "Terms & Conditions",
    "legal_imprint": "Imprint"
  },
  "bewerber": {
    "title": "Candidates",
    "header": {
      "empty": "No active candidates yet",
      "all_done": "All caught up — {{count}} candidates in progress",
      "your_turn_single": "1 candidate is waiting for your action · {{rest}} more in progress",
      "your_turn_plural": "{{count}} candidates are waiting for your action · {{rest}} more in progress"
    },
    "sections": {
      "mine": "Your turn",
      "others": "Waiting on others"
    },
    "state": {
      "wait_today": "New · today",
      "wait_yesterday": "Since yesterday",
      "wait_days": "For {{days}} days",
      "wait_warn": "Waiting for {{days}} days",
      "wait_crit": "Overdue · {{days}} days",
      "pruefung": "In review by recruiter",
      "opted_in": "Consented — pick a slot",
      "wartet_kandidat": "Waiting on candidate",
      "terminvorschlag": "New time proposal",
      "abgesagt": "Candidate declined",
      "termin_abgesagt": "Interview cancelled",
      "no_show": "Did not attend",
      "geplant": "Interview · {{date}}",
      "feedback": "Feedback due · was {{date}}",
      "feedback_nodate": "Feedback due",
      "interview_phase": "In interview process",
      "offer_prep": "Offer in preparation",
      "offer_sent": "Offer sent",
      "offer_viewed": "Offer viewed",
      "offer_negotiating": "Counter offer received",
      "offer_rejected": "Offer declined",
      "offer_expired": "Offer expired",
      "offer_accepted": "Offer accepted"
    },
    "tabs": {
      "neu": "New",
      "pruefung": "In review",
      "interview": "Interview",
      "angebot": "Offer",
      "alle": "All",
      "archiv": "Archive"
    },
    "filter": {
      "search": "Search …",
      "all_jobs": "All jobs"
    },
    "sort": {
      "newest": "Newest first",
      "match": "Best match",
      "waiting": "Longest waiting"
    },
    "loaded_hint": "{{loaded}} of {{total}} loaded",
    "select_prompt": "Select a candidate from the list",
    "card": {
      "no_role": "Profile without role"
    },
    "actions": {
      "request_interview": "Request interview",
      "plan_interview": "Schedule interview",
      "rerequest": "Request again",
      "review_proposal": "Review proposal",
      "view_appointment": "View appointment",
      "view_request": "View request",
      "give_feedback": "Give feedback",
      "view_interviews": "View interviews",
      "view_offer": "View offer",
      "review_counter": "Review counter offer",
      "reject": "Reject",
      "ask_recruiter": "Ask recruiter"
    },
    "notes": {
      "title": "Team notes",
      "empty": "No notes yet.",
      "placeholder": "Write a note for your team …",
      "save": "Save",
      "save_error": "The note could not be saved. Please try again.",
      "visibility": "Visible to your team and your recruiter — not to the candidate.",
      "author_you": "You",
      "author_member": "Team member"
    },
    "chips": {
      "salary_locked": "Salary after consent"
    },
    "ai": {
      "more": "Show more",
      "less": "Show less"
    },
    "skills": {
      "less": "Show less"
    },
    "detail": {
      "back": "Back to candidates",
      "unlocked_hint": "Profile shared by the candidate · code {{code}}",
      "locked_hint": "Anonymous profile — name, contact and CV after interview consent",
      "match": "{{score}} % match",
      "ctx": {
        "wait_new": "New suggestion from your recruiter — decide whether you want to meet this candidate.",
        "wait_old": "This suggestion has been waiting {{days}} days for your decision.",
        "pruefung": "Your recruiter is clarifying open questions — you can still decide already.",
        "opted_in": "The candidate consented and is waiting for you to pick a slot.",
        "wartet_kandidat": "Your interview request is unanswered — the ball is with the candidate.",
        "terminvorschlag": "The candidate proposes a different time — please review.",
        "geplant": "The interview is confirmed for {{date}}.",
        "feedback": "The interview took place on {{date}} — your feedback decides the next step.",
        "feedback_nodate": "The interview is over — your feedback decides the next step.",
        "abgesagt": "The candidate cancelled the appointment. You can propose new slots or reject.",
        "termin_abgesagt": "The appointment was cancelled. You can propose new slots.",
        "no_show": "The candidate did not attend. You can request again or reject.",
        "interview_phase": "The interview process is running — details in the interview agenda.",
        "offer_prep": "Prepare the offer — the candidate has completed the interviews.",
        "offer_sent": "Your offer is with the candidate — decision pending.",
        "offer_viewed": "The candidate viewed your offer — decision pending.",
        "offer_negotiating": "The candidate made a counter offer — please review.",
        "offer_rejected": "The candidate declined the offer.",
        "offer_expired": "The offer expired — you can send a new one.",
        "offer_accepted": "The candidate accepted the offer.",
        "archiv": "This application is closed."
      },
      "agenda": "To agenda",
      "cv_open": "Open CV",
      "cv_locked": "CV after interview consent",
      "cv_missing": "No CV on file — ask your recruiter",
      "profile": "Profile",
      "career": "Career",
      "verlauf": "History",
      "verlauf_submitted": "Submitted by your recruiter",
      "verlauf_iv_requested": "Interview requested",
      "verlauf_iv_scheduled": "Appointment confirmed · {{time}}",
      "verlauf_iv_completed": "Interview held",
      "verlauf_iv_cancelled": "Appointment cancelled",
      "verlauf_iv_declined": "Candidate declined",
      "verlauf_iv_pending": "Waiting for the candidate's reply",
      "verlauf_offer_created": "Offer created",
      "verlauf_offer_sent": "Offer sent",
      "branchen": "Industries",
      "zielrollen": "Target roles",
      "karriereziele": "Career goals",
      "sprachen": "Languages",
      "zertifikate": "Certifications",
      "companies_after_optin": "Company names after interview consent",
      "readonly": "Read-only access"
    },
    "identity_unlocked": "Identity shared",
    "error": {
      "load": "Candidates could not be loaded.",
      "retry": "Try again"
    },
    "empty": {
      "search_title": "No results for “{{query}}”",
      "search_text": "Check the search term or reset the search.",
      "neu_title": "All caught up",
      "neu_text": "New candidates appear here as soon as your recruiter submits them. You will be notified by email.",
      "pruefung_title": "Nobody in review",
      "pruefung_text": "Candidates land here while your recruiter clarifies open questions — before you decide.",
      "interview_title": "No interview scheduled yet",
      "interview_text": "As soon as you choose “Request interview” for a new candidate, you will see date and status here.",
      "angebot_title": "No offer under way",
      "angebot_text": "Once you make a candidate an offer after the interviews, you can track its status here until acceptance.",
      "archiv_title": "The archive is empty",
      "archiv_text": "Rejected, hired and withdrawn candidates land here — nothing gets lost.",
      "alle_title": "No candidates yet",
      "alle_text": "Your recruiter is sourcing matching candidates. New suggestions will appear here."
    },
    "archive": {
      "kind": {
        "abgelehnt": "Rejected",
        "eingestellt": "Hired",
        "zurueckgezogen": "Withdrawn",
        "abgelaufen": "Expired"
      },
      "closed_info": "This application is closed.",
      "hired_info": "This candidate was hired via Matchunt.",
      "view_placement": "View placement",
      "retention_hint": "Archived applications are deleted according to the retention policy."
    }
  },
  "jobdetail": {
    "back": "Back to overview",
    "not_found": "Job not found",
    "error_load": "Loading failed",
    "error_save": "Saving failed — you may not have permission for this.",
    "bewerber_error": "Candidates could not be loaded.",
    "toast": {
      "paused": "Position paused",
      "resumed": "Position reactivated"
    },
    "state": {
      "aktiv": "Active",
      "pausiert": "Paused",
      "geschlossen": "Closed",
      "besetzt": "Filled"
    },
    "meta": {
      "live_today": "Live since today",
      "live_since_one": "Live for 1 day",
      "live_since": "Live for {{days}} days",
      "paused_since": "Paused since {{date}}"
    },
    "employment": {
      "full-time": "Full-time",
      "part-time": "Part-time",
      "contract": "Fixed-term",
      "freelance": "Freelance",
      "internship": "Internship"
    },
    "remote": {
      "remote": "Remote",
      "hybrid": "Hybrid",
      "onsite": "On-site"
    },
    "banner": {
      "pausiert": "Paused since {{date}} — recruiters cannot see this position. Ongoing applications stay active.",
      "ueberfaellig_single": "Overdue: one candidate has been waiting for your decision for over 21 days.",
      "ueberfaellig_plural": "Overdue: {{count}} candidates have been waiting for your decision for over 21 days.",
      "dringend_single": "One candidate urgently needs your decision.",
      "dringend_plural": "{{count}} candidates urgently need your decision.",
      "feedback_single": "The interview was on {{date}} — your feedback is missing.",
      "feedback_single_nodate": "One interview is waiting for your feedback.",
      "feedback_plural": "{{count}} interviews are waiting for your feedback.",
      "antwort_single": "One candidate is waiting for your reply.",
      "antwort_plural": "{{count}} candidates are waiting for your reply.",
      "aktion_single": "One new suggestion is waiting for your review.",
      "aktion_plural": "{{count}} suggestions are waiting for your review.",
      "leer_lang": "Live for {{days}} days with no suggestions yet. Most common cause: salary band too narrow or too many must-haves.",
      "frisch": "Your position is live — recruiters are sourcing matching candidates. New suggestions appear here first.",
      "laeuft_heute": "Everything in progress — nothing to do. Latest suggestion today.",
      "laeuft_one": "Everything in progress — nothing to do. Latest suggestion yesterday.",
      "laeuft": "Everything in progress — nothing to do. Latest suggestion {{days}} days ago.",
      "geschlossen": "This position is closed — recruiters can no longer see it.",
      "besetzt": "This position is filled — the search is complete."
    },
    "banner_action": {
      "entscheiden": "Decide now",
      "feedback": "Give feedback",
      "antworten": "Reply",
      "pruefen": "Review now",
      "briefing": "Sharpen briefing",
      "reaktivieren": "Reactivate"
    },
    "funnel": {
      "hint": "Dot = waiting for you · Click opens the candidate inbox filtered to this position",
      "hired": "{{count}} hired"
    },
    "wait": {
      "title": "Waiting for you",
      "open_inbox": "Open in inbox",
      "match": "match",
      "more": "+{{count}} more in the inbox"
    },
    "actions": {
      "edit": "Edit",
      "pause": "Pause",
      "resume": "Reactivate",
      "invite": "Invite department"
    },
    "termine": {
      "title": "Interviews & feedback",
      "all": "All interviews",
      "feedback": "Feedback due: {{name}} — interview was on {{date}}",
      "feedback_nodate": "Feedback due: {{name}}",
      "counter": "Time proposal from {{name}} — please reply",
      "next": "Next interview: {{date}} — {{name}}",
      "waiting": "Invitation sent to {{name}} — awaiting reply",
      "more": "+{{count}} more interviews"
    },
    "sections": {
      "stelle": "Job details",
      "konditionen": "Terms & anonymity",
      "team": "Team & access",
      "verlauf": "History",
      "verwalten": "Manage"
    },
    "stelle": {
      "standort": "Location",
      "anstellung": "Employment",
      "branche": "Industry",
      "onsite_days": "{{count}} days on-site",
      "muss": "Must-haves",
      "wunsch": "Nice to have",
      "beschreibung": "Description",
      "mehr": "Show more",
      "weniger": "Show less",
      "edit": "Edit job details"
    },
    "konditionen": {
      "salary": "Salary band",
      "fee": "Fee",
      "fee_value": "{{pct}} % of target annual salary — due only upon hire",
      "fee_hint": "Visible to owner, admin & finance only",
      "reveal": "Identity release",
      "reveal_opt_in": "After the candidate opts in",
      "reveal_offer": "Only at offer stage",
      "reveal_interview": "After the first interview",
      "preview_title": "How recruiters see your company",
      "preview_empty": "Anonymous company descriptor not set yet",
      "preview_hint": "Your company name stays hidden until you release it."
    },
    "team": {
      "empty": "No team members with access to this position yet.",
      "pending": "· invited"
    },
    "verlauf": {
      "empty": "No events yet.",
      "published": "Position published",
      "vorschlag": "New suggestion: {{name}}",
      "interview": "Interview arranged: {{name}}, {{date}}",
      "pausiert": "Position paused",
      "geschlossen": "Position closed"
    },
    "verwalten": {
      "hint": "Pausing and closing explain the consequence first — nothing happens without confirmation.",
      "cancel": "Cancel",
      "pause_title": "Pause this position?",
      "pause_text": "Recruiters will no longer see the position and won't suggest new candidates. Ongoing applications and interviews stay active. You can reactivate anytime.",
      "close": "Close position",
      "close_title": "Close this position?",
      "close_text": "The search ends and recruiters will no longer see the position. Ongoing applications remain visible to you.",
      "close_reason": "Reason",
      "close_reason_placeholder": "Select a reason…",
      "close_pause_hint": "Only temporary? Pausing is the better choice.",
      "close_confirm": "Close position",
      "reason_filled_matchunt": "Filled via Matchunt",
      "reason_filled_elsewhere": "Filled elsewhere",
      "reason_on_hold": "Position on hold",
      "reason_cancelled": "Position cancelled"
    },
    "toast_closed": "Position closed"
  },
  "terminsheet": {
    "pill": {
      "counter": "Counter-proposal",
      "awaiting": "Awaiting reply",
      "expired": "Slots expired",
      "scheduled": "Interview confirmed",
      "requested": "Interview requested",
      "feedback": "Feedback due",
      "declined": "Declined by candidate",
      "cancelled": "Cancelled",
      "no_show": "No-show",
      "completed": "Completed"
    },
    "ctx_counter": "Your slots didn't fit — the candidate suggests alternatives. It's your turn.",
    "ctx_awaiting": "Invited {{time}} ago — the candidate hasn't replied yet.",
    "ctx_awaiting_expired": "Invited {{time}} ago — no reply. All proposed times are now in the past.",
    "ctx_scheduled": "The interview is confirmed.",
    "ctx_requested": "Interview requested — confirmation pending.",
    "ctx_feedback": "The interview was on {{date}} — your feedback is still missing.",
    "ctx_declined": "The candidate declined the interview request.",
    "ctx_cancelled": "This interview was cancelled.",
    "ctx_no_show": "The candidate did not show up.",
    "ctx_completed": "This interview is completed.",
    "slots_title": "Proposed times",
    "counter_title": "Candidate's suggestions",
    "expired_tag": "expired",
    "duration": "{{min}} min",
    "meeting_video": "Video call",
    "meeting_phone": "Phone",
    "meeting_onsite": "On-site",
    "join": "Join",
    "msg": "Message from the candidate",
    "notes": "Notes",
    "feedback_title": "Your feedback",
    "actions": {
      "new_slots": "Propose new slots",
      "remind": "Remind",
      "withdraw": "Withdraw request",
      "respond": "Reply to proposal",
      "reschedule": "Reschedule",
      "cancel": "Cancel interview",
      "edit": "Edit interview",
      "feedback": "Give feedback",
      "profile": "Open candidate profile"
    }
  },
  "recruiterInterviews": {
    "title": "Interviews",
    "subtitle": "All appointments for your candidates — confirmed, pending, and awaiting debrief",
    "stats": {
      "today": "Today",
      "week": "This week",
      "unconfirmed": "Unconfirmed",
      "awaiting": "No date yet",
      "debrief": "Debrief due"
    },
    "next_up": "Next appointment · {{time}}",
    "open_submission": "Open submission",
    "sections": {
      "counter": "Alternative date proposed ({{count}})",
      "debrief": "Debrief due ({{count}})",
      "awaiting": "Awaiting scheduling ({{count}})",
      "cancelled": "Cancelled and no-shows ({{count}})",
      "past": "Past interviews ({{count}})"
    },
    "empty": "No upcoming interviews — submit candidates or follow up on open submissions.",
    "cancel_hint": "{{percent}}% of your interviews never happen. The reasons show where you can step in earlier.",
    "row": {
      "duration": "{{min}} min",
      "unconfirmed": "unconfirmed",
      "slots_expired": "Slots expired",
      "counter": "Alternative date",
      "no_show": "no-show",
      "cancelled": "cancelled",
      "waiting_since": "Waiting for {{time}}",
      "join": "Join"
    }
  },
  "recruiterTermin": {
    "pill": {
      "scheduled": "Confirmed",
      "unconfirmed": "Unconfirmed",
      "awaiting": "Awaiting date choice",
      "expired": "Dates expired",
      "counter": "Alternative date",
      "debrief": "Debrief due",
      "cancelled": "Cancelled",
      "no_show": "No-show",
      "done": "Completed"
    },
    "ctx": {
      "scheduled": "The date is set. Keep your candidate engaged and send a reminder shortly before.",
      "unconfirmed": "This date isn't confirmed yet. Check with your candidate whether it works.",
      "awaiting": "Your candidate hasn't picked a date for {{time}}. A call beats another email.",
      "expired": "All proposed dates have passed. Only the client can send new ones — reach your candidate first.",
      "counter": "An alternative date is on the table. The client decides whether to accept — make sure your candidate stays available.",
      "debrief": "The interview on {{date}} is done, your take is still missing. It's most valuable while fresh.",
      "cancelled": "This appointment was cancelled. Check whether the process continues or you should close the case.",
      "no_show": "Nobody showed up. Find out from your candidate what happened.",
      "done": "This appointment is closed."
    },
    "meeting": {
      "video": "Video call",
      "phone": "Phone",
      "onsite": "On site"
    },
    "duration": "{{min}} min",
    "no_address": "No address on file — your candidate doesn't know where to go.",
    "slots_title": "Proposed dates",
    "expired_tag": "expired",
    "counter_title": "Alternative date",
    "cancel_title": "Reason",
    "no_show_by": {
      "candidate": "Candidate didn't show",
      "client": "Client didn't show",
      "technical": "Technical problem",
      "unknown": "No reason on file"
    },
    "msg": "Message from your candidate",
    "notes": "Notes on this appointment",
    "client_feedback": "Client's feedback",
    "debrief_title": "Your take",
    "debrief_placeholder": "How did it go? What's keeping the candidate interested, what's holding them back?",
    "debrief_save": "Save your take",
    "debrief_update": "Update your take",
    "recommendation": {
      "next_round": "Proceed",
      "hire": "Hire",
      "undecided": "Unclear",
      "reject": "Out"
    },
    "fee": "Your fee on close: ~{{amount}}k €",
    "action": {
      "join": "Join meeting",
      "call": "Call candidate",
      "mail": "Email candidate",
      "call_short": "Call",
      "mail_short": "Email",
      "submission": "Submission",
      "candidate": "Profile"
    }
  }
};

export default en;
