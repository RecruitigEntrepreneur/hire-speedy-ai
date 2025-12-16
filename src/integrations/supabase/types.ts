export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          actions: Json | null
          conditions: Json | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          trigger_event: string
          updated_at: string | null
        }
        Insert: {
          actions?: Json | null
          conditions?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          trigger_event: string
          updated_at?: string | null
        }
        Update: {
          actions?: Json | null
          conditions?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          trigger_event?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      candidate_activity_log: {
        Row: {
          activity_type: string
          candidate_id: string
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          recruiter_id: string
          related_alert_id: string | null
          related_submission_id: string | null
          title: string
        }
        Insert: {
          activity_type: string
          candidate_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          recruiter_id: string
          related_alert_id?: string | null
          related_submission_id?: string | null
          title: string
        }
        Update: {
          activity_type?: string
          candidate_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          recruiter_id?: string
          related_alert_id?: string | null
          related_submission_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_activity_log_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "candidate_activity_log_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_activity_log_related_alert_id_fkey"
            columns: ["related_alert_id"]
            isOneToOne: false
            referencedRelation: "influence_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_activity_log_related_submission_id_fkey"
            columns: ["related_submission_id"]
            isOneToOne: false
            referencedRelation: "candidate_rankings"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "candidate_activity_log_related_submission_id_fkey"
            columns: ["related_submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_ai_assessment: {
        Row: {
          candidate_id: string
          communication_score: number | null
          created_at: string | null
          culture_fit: number | null
          generated_at: string | null
          id: string
          key_highlights: Json | null
          model_version: string | null
          opportunity_factors: Json | null
          opportunity_level: string | null
          overall_score: number | null
          placement_probability: number | null
          reasoning: string | null
          recommendation: string | null
          risk_factors: Json | null
          risk_level: string | null
          technical_fit: number | null
          updated_at: string | null
        }
        Insert: {
          candidate_id: string
          communication_score?: number | null
          created_at?: string | null
          culture_fit?: number | null
          generated_at?: string | null
          id?: string
          key_highlights?: Json | null
          model_version?: string | null
          opportunity_factors?: Json | null
          opportunity_level?: string | null
          overall_score?: number | null
          placement_probability?: number | null
          reasoning?: string | null
          recommendation?: string | null
          risk_factors?: Json | null
          risk_level?: string | null
          technical_fit?: number | null
          updated_at?: string | null
        }
        Update: {
          candidate_id?: string
          communication_score?: number | null
          created_at?: string | null
          culture_fit?: number | null
          generated_at?: string | null
          id?: string
          key_highlights?: Json | null
          model_version?: string | null
          opportunity_factors?: Json | null
          opportunity_level?: string | null
          overall_score?: number | null
          placement_probability?: number | null
          reasoning?: string | null
          recommendation?: string | null
          risk_factors?: Json | null
          risk_level?: string | null
          technical_fit?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_ai_assessment_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "candidate_ai_assessment_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_behavior: {
        Row: {
          candidate_id: string
          closing_probability: number | null
          company_profile_viewed: boolean | null
          confidence_score: number | null
          created_at: string | null
          days_since_engagement: number | null
          emails_opened: number | null
          emails_sent: number | null
          engagement_level: string | null
          hesitation_signals: Json | null
          id: string
          interview_readiness_score: number | null
          last_engagement_at: string | null
          links_clicked: number | null
          motivation_indicators: Json | null
          opt_in_response_time_hours: number | null
          prep_materials_viewed: number | null
          salary_tool_used: boolean | null
          submission_id: string
          updated_at: string | null
        }
        Insert: {
          candidate_id: string
          closing_probability?: number | null
          company_profile_viewed?: boolean | null
          confidence_score?: number | null
          created_at?: string | null
          days_since_engagement?: number | null
          emails_opened?: number | null
          emails_sent?: number | null
          engagement_level?: string | null
          hesitation_signals?: Json | null
          id?: string
          interview_readiness_score?: number | null
          last_engagement_at?: string | null
          links_clicked?: number | null
          motivation_indicators?: Json | null
          opt_in_response_time_hours?: number | null
          prep_materials_viewed?: number | null
          salary_tool_used?: boolean | null
          submission_id: string
          updated_at?: string | null
        }
        Update: {
          candidate_id?: string
          closing_probability?: number | null
          company_profile_viewed?: boolean | null
          confidence_score?: number | null
          created_at?: string | null
          days_since_engagement?: number | null
          emails_opened?: number | null
          emails_sent?: number | null
          engagement_level?: string | null
          hesitation_signals?: Json | null
          id?: string
          interview_readiness_score?: number | null
          last_engagement_at?: string | null
          links_clicked?: number | null
          motivation_indicators?: Json | null
          opt_in_response_time_hours?: number | null
          prep_materials_viewed?: number | null
          salary_tool_used?: boolean | null
          submission_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_behavior_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "candidate_behavior_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_behavior_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "candidate_rankings"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "candidate_behavior_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_client_summary: {
        Row: {
          candidate_id: string
          change_motivation_summary: string | null
          created_at: string | null
          deal_probability: number | null
          executive_summary: string | null
          generated_at: string | null
          hard_facts: Json | null
          id: string
          job_hopper_analysis: Json | null
          key_selling_points: Json | null
          model_version: string | null
          positive_factors: Json | null
          recommendation: string | null
          recommendation_score: number | null
          risk_factors: Json | null
          submission_id: string | null
          updated_at: string | null
        }
        Insert: {
          candidate_id: string
          change_motivation_summary?: string | null
          created_at?: string | null
          deal_probability?: number | null
          executive_summary?: string | null
          generated_at?: string | null
          hard_facts?: Json | null
          id?: string
          job_hopper_analysis?: Json | null
          key_selling_points?: Json | null
          model_version?: string | null
          positive_factors?: Json | null
          recommendation?: string | null
          recommendation_score?: number | null
          risk_factors?: Json | null
          submission_id?: string | null
          updated_at?: string | null
        }
        Update: {
          candidate_id?: string
          change_motivation_summary?: string | null
          created_at?: string | null
          deal_probability?: number | null
          executive_summary?: string | null
          generated_at?: string | null
          hard_facts?: Json | null
          id?: string
          job_hopper_analysis?: Json | null
          key_selling_points?: Json | null
          model_version?: string | null
          positive_factors?: Json | null
          recommendation?: string | null
          recommendation_score?: number | null
          risk_factors?: Json | null
          submission_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_client_summary_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "candidate_client_summary_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_client_summary_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "candidate_rankings"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "candidate_client_summary_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_comments: {
        Row: {
          activity_type: string | null
          content: string
          created_at: string
          id: string
          submission_id: string
          updated_at: string
          user_id: string
          visibility: string | null
        }
        Insert: {
          activity_type?: string | null
          content: string
          created_at?: string
          id?: string
          submission_id: string
          updated_at?: string
          user_id: string
          visibility?: string | null
        }
        Update: {
          activity_type?: string | null
          content?: string
          created_at?: string
          id?: string
          submission_id?: string
          updated_at?: string
          user_id?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_comments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "candidate_rankings"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "candidate_comments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_commitment_updates: {
        Row: {
          candidate_id: string
          commitment_level: string
          created_at: string
          id: string
          previous_level: string | null
          reason: string | null
          recruiter_id: string
          submission_id: string | null
        }
        Insert: {
          candidate_id: string
          commitment_level: string
          created_at?: string
          id?: string
          previous_level?: string | null
          reason?: string | null
          recruiter_id: string
          submission_id?: string | null
        }
        Update: {
          candidate_id?: string
          commitment_level?: string
          created_at?: string
          id?: string
          previous_level?: string | null
          reason?: string | null
          recruiter_id?: string
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_commitment_updates_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "candidate_commitment_updates_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_commitment_updates_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "candidate_rankings"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "candidate_commitment_updates_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_conflicts: {
        Row: {
          candidate_id: string
          conflict_type: string
          created_at: string | null
          id: string
          resolution_notes: string | null
          resolved: boolean | null
          resolved_by: string | null
          severity: string | null
          submission_a_id: string
          submission_b_id: string
        }
        Insert: {
          candidate_id: string
          conflict_type: string
          created_at?: string | null
          id?: string
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_by?: string | null
          severity?: string | null
          submission_a_id: string
          submission_b_id: string
        }
        Update: {
          candidate_id?: string
          conflict_type?: string
          created_at?: string | null
          id?: string
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_by?: string | null
          severity?: string | null
          submission_a_id?: string
          submission_b_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_conflicts_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "candidate_conflicts_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_conflicts_submission_a_id_fkey"
            columns: ["submission_a_id"]
            isOneToOne: false
            referencedRelation: "candidate_rankings"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "candidate_conflicts_submission_a_id_fkey"
            columns: ["submission_a_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_conflicts_submission_b_id_fkey"
            columns: ["submission_b_id"]
            isOneToOne: false
            referencedRelation: "candidate_rankings"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "candidate_conflicts_submission_b_id_fkey"
            columns: ["submission_b_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_documents: {
        Row: {
          candidate_id: string
          created_at: string | null
          document_type: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          is_current: boolean | null
          mime_type: string | null
          notes: string | null
          uploaded_by: string | null
          version: number | null
        }
        Insert: {
          candidate_id: string
          created_at?: string | null
          document_type: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          is_current?: boolean | null
          mime_type?: string | null
          notes?: string | null
          uploaded_by?: string | null
          version?: number | null
        }
        Update: {
          candidate_id?: string
          created_at?: string | null
          document_type?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          is_current?: boolean | null
          mime_type?: string | null
          notes?: string | null
          uploaded_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_documents_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "candidate_documents_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_educations: {
        Row: {
          candidate_id: string
          created_at: string | null
          degree: string | null
          field_of_study: string | null
          grade: string | null
          graduation_year: number | null
          id: string
          institution: string
          sort_order: number | null
        }
        Insert: {
          candidate_id: string
          created_at?: string | null
          degree?: string | null
          field_of_study?: string | null
          grade?: string | null
          graduation_year?: number | null
          id?: string
          institution: string
          sort_order?: number | null
        }
        Update: {
          candidate_id?: string
          created_at?: string | null
          degree?: string | null
          field_of_study?: string | null
          grade?: string | null
          graduation_year?: number | null
          id?: string
          institution?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_educations_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "candidate_educations_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_experiences: {
        Row: {
          candidate_id: string
          company_name: string
          created_at: string | null
          description: string | null
          end_date: string | null
          id: string
          is_current: boolean | null
          job_title: string
          location: string | null
          sort_order: number | null
          start_date: string | null
        }
        Insert: {
          candidate_id: string
          company_name: string
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          job_title: string
          location?: string | null
          sort_order?: number | null
          start_date?: string | null
        }
        Update: {
          candidate_id?: string
          company_name?: string
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          job_title?: string
          location?: string | null
          sort_order?: number | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_experiences_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "candidate_experiences_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_interview_notes: {
        Row: {
          additional_notes: string | null
          candidate_id: string
          career_3_5_year_plan: string | null
          career_actions_taken: string | null
          career_ultimate_goal: string | null
          career_what_didnt_work: string | null
          career_what_worked: string | null
          change_motivation: string | null
          change_motivation_tags: string[] | null
          created_at: string | null
          current_negative: string | null
          current_positive: string | null
          discussed_internally: string | null
          earliest_start_date: string | null
          frequency_of_issues: string | null
          id: string
          interview_date: string | null
          notice_period: string | null
          offer_requirements: string[] | null
          previous_process_issues: string | null
          recommendation_notes: string | null
          recruiter_id: string
          salary_current: string | null
          salary_desired: string | null
          salary_minimum: string | null
          specific_incident: string | null
          status: string | null
          summary_cultural_fit: string | null
          summary_key_requirements: string | null
          summary_motivation: string | null
          summary_notice: string | null
          summary_salary: string | null
          updated_at: string | null
          why_now: string | null
          would_recommend: boolean | null
          would_stay_if_matched: boolean | null
        }
        Insert: {
          additional_notes?: string | null
          candidate_id: string
          career_3_5_year_plan?: string | null
          career_actions_taken?: string | null
          career_ultimate_goal?: string | null
          career_what_didnt_work?: string | null
          career_what_worked?: string | null
          change_motivation?: string | null
          change_motivation_tags?: string[] | null
          created_at?: string | null
          current_negative?: string | null
          current_positive?: string | null
          discussed_internally?: string | null
          earliest_start_date?: string | null
          frequency_of_issues?: string | null
          id?: string
          interview_date?: string | null
          notice_period?: string | null
          offer_requirements?: string[] | null
          previous_process_issues?: string | null
          recommendation_notes?: string | null
          recruiter_id: string
          salary_current?: string | null
          salary_desired?: string | null
          salary_minimum?: string | null
          specific_incident?: string | null
          status?: string | null
          summary_cultural_fit?: string | null
          summary_key_requirements?: string | null
          summary_motivation?: string | null
          summary_notice?: string | null
          summary_salary?: string | null
          updated_at?: string | null
          why_now?: string | null
          would_recommend?: boolean | null
          would_stay_if_matched?: boolean | null
        }
        Update: {
          additional_notes?: string | null
          candidate_id?: string
          career_3_5_year_plan?: string | null
          career_actions_taken?: string | null
          career_ultimate_goal?: string | null
          career_what_didnt_work?: string | null
          career_what_worked?: string | null
          change_motivation?: string | null
          change_motivation_tags?: string[] | null
          created_at?: string | null
          current_negative?: string | null
          current_positive?: string | null
          discussed_internally?: string | null
          earliest_start_date?: string | null
          frequency_of_issues?: string | null
          id?: string
          interview_date?: string | null
          notice_period?: string | null
          offer_requirements?: string[] | null
          previous_process_issues?: string | null
          recommendation_notes?: string | null
          recruiter_id?: string
          salary_current?: string | null
          salary_desired?: string | null
          salary_minimum?: string | null
          specific_incident?: string | null
          status?: string | null
          summary_cultural_fit?: string | null
          summary_key_requirements?: string | null
          summary_motivation?: string | null
          summary_notice?: string | null
          summary_salary?: string | null
          updated_at?: string | null
          why_now?: string | null
          would_recommend?: boolean | null
          would_stay_if_matched?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_interview_notes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "candidate_interview_notes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_languages: {
        Row: {
          candidate_id: string
          created_at: string | null
          id: string
          language: string
          proficiency: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string | null
          id?: string
          language: string
          proficiency?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string | null
          id?: string
          language?: string
          proficiency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_languages_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "candidate_languages_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_notes: {
        Row: {
          candidate_id: string
          category: string | null
          content: string
          created_at: string | null
          id: string
          is_pinned: boolean | null
          is_private: boolean | null
          recruiter_id: string
          updated_at: string | null
        }
        Insert: {
          candidate_id: string
          category?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          is_private?: boolean | null
          recruiter_id: string
          updated_at?: string | null
        }
        Update: {
          candidate_id?: string
          category?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          is_private?: boolean | null
          recruiter_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_notes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "candidate_notes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_projects: {
        Row: {
          achievements: Json | null
          budget_range: string | null
          candidate_id: string
          client_industry: string | null
          client_name: string | null
          created_at: string | null
          devices_count: number | null
          duration_months: number | null
          end_date: string | null
          id: string
          is_current: boolean | null
          is_highlight: boolean | null
          locations_count: number | null
          project_name: string
          project_type: string | null
          responsibilities: Json | null
          sort_order: number | null
          start_date: string | null
          team_size: number | null
          technologies: Json | null
          updated_at: string | null
        }
        Insert: {
          achievements?: Json | null
          budget_range?: string | null
          candidate_id: string
          client_industry?: string | null
          client_name?: string | null
          created_at?: string | null
          devices_count?: number | null
          duration_months?: number | null
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          is_highlight?: boolean | null
          locations_count?: number | null
          project_name: string
          project_type?: string | null
          responsibilities?: Json | null
          sort_order?: number | null
          start_date?: string | null
          team_size?: number | null
          technologies?: Json | null
          updated_at?: string | null
        }
        Update: {
          achievements?: Json | null
          budget_range?: string | null
          candidate_id?: string
          client_industry?: string | null
          client_name?: string | null
          created_at?: string | null
          devices_count?: number | null
          duration_months?: number | null
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          is_highlight?: boolean | null
          locations_count?: number | null
          project_name?: string
          project_type?: string | null
          responsibilities?: Json | null
          sort_order?: number | null
          start_date?: string | null
          team_size?: number | null
          technologies?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_projects_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "candidate_projects_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_risk_reports: {
        Row: {
          candidate_id: string
          created_at: string
          description: string | null
          id: string
          recruiter_id: string
          resolved: boolean | null
          resolved_at: string | null
          risk_type: string
          severity: string
          submission_id: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          description?: string | null
          id?: string
          recruiter_id: string
          resolved?: boolean | null
          resolved_at?: string | null
          risk_type: string
          severity: string
          submission_id?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          description?: string | null
          id?: string
          recruiter_id?: string
          resolved?: boolean | null
          resolved_at?: string | null
          risk_type?: string
          severity?: string
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_risk_reports_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "candidate_risk_reports_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_risk_reports_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "candidate_rankings"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "candidate_risk_reports_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_skills: {
        Row: {
          candidate_id: string
          category: string | null
          created_at: string | null
          id: string
          level: string | null
          skill_name: string
        }
        Insert: {
          candidate_id: string
          category?: string | null
          created_at?: string | null
          id?: string
          level?: string | null
          skill_name: string
        }
        Update: {
          candidate_id?: string
          category?: string | null
          created_at?: string | null
          id?: string
          level?: string | null
          skill_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_skills_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "candidate_skills_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_support_content: {
        Row: {
          content: string
          content_type: string
          created_at: string | null
          id: string
          industry: string | null
          is_active: boolean | null
          job_id: string | null
          media_url: string | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          content: string
          content_type: string
          created_at?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          job_id?: string | null
          media_url?: string | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          content?: string
          content_type?: string
          created_at?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          job_id?: string | null
          media_url?: string | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_support_content_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_tag_assignments: {
        Row: {
          assigned_at: string | null
          candidate_id: string
          tag_id: string
        }
        Insert: {
          assigned_at?: string | null
          candidate_id: string
          tag_id: string
        }
        Update: {
          assigned_at?: string | null
          candidate_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_tag_assignments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "candidate_tag_assignments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "candidate_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          recruiter_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          recruiter_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          recruiter_id?: string
        }
        Relationships: []
      }
      candidates: {
        Row: {
          address_lat: number | null
          address_lng: number | null
          address_street: string | null
          address_zip: string | null
          availability_date: string | null
          candidate_status: string | null
          certificates: Json | null
          city: string | null
          commute_mode: string | null
          company: string | null
          created_at: string
          current_salary: number | null
          cv_ai_bullets: Json | null
          cv_ai_summary: string | null
          cv_parsed_at: string | null
          cv_parser_version: string | null
          cv_raw_text: string | null
          cv_url: string | null
          email: string
          expected_salary: number | null
          experience_years: number | null
          expose_certifications: Json | null
          expose_highlights: Json | null
          expose_project_highlights: Json | null
          expose_summary: string | null
          expose_title: string | null
          full_name: string
          github_url: string | null
          hubspot_contact_id: string | null
          id: string
          import_source: string | null
          industry_experience: Json | null
          job_title: string | null
          linkedin_url: string | null
          max_commute_minutes: number | null
          nationality: string | null
          notice_period: string | null
          phone: string | null
          phone_verified: boolean | null
          portfolio_url: string | null
          preferred_channel: string | null
          project_metrics: Json | null
          recruiter_id: string
          relocation_willing: boolean | null
          remote_days_preferred: number | null
          remote_flexibility: string | null
          remote_possible: boolean | null
          remote_preference: string | null
          residence_status: string | null
          salary_bonus: number | null
          salary_expectation_max: number | null
          salary_expectation_min: number | null
          salary_fix: number | null
          seniority: string | null
          skills: string[] | null
          sms_opt_in: boolean | null
          soft_skills: Json | null
          specializations: Json | null
          summary: string | null
          target_employment_type: string | null
          target_industries: Json | null
          target_locations: Json | null
          target_roles: Json | null
          updated_at: string
          video_url: string | null
          visa_required: boolean | null
          website_url: string | null
          whatsapp_opt_in: boolean | null
          work_model: string | null
          work_permit_notes: string | null
        }
        Insert: {
          address_lat?: number | null
          address_lng?: number | null
          address_street?: string | null
          address_zip?: string | null
          availability_date?: string | null
          candidate_status?: string | null
          certificates?: Json | null
          city?: string | null
          commute_mode?: string | null
          company?: string | null
          created_at?: string
          current_salary?: number | null
          cv_ai_bullets?: Json | null
          cv_ai_summary?: string | null
          cv_parsed_at?: string | null
          cv_parser_version?: string | null
          cv_raw_text?: string | null
          cv_url?: string | null
          email: string
          expected_salary?: number | null
          experience_years?: number | null
          expose_certifications?: Json | null
          expose_highlights?: Json | null
          expose_project_highlights?: Json | null
          expose_summary?: string | null
          expose_title?: string | null
          full_name: string
          github_url?: string | null
          hubspot_contact_id?: string | null
          id?: string
          import_source?: string | null
          industry_experience?: Json | null
          job_title?: string | null
          linkedin_url?: string | null
          max_commute_minutes?: number | null
          nationality?: string | null
          notice_period?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          portfolio_url?: string | null
          preferred_channel?: string | null
          project_metrics?: Json | null
          recruiter_id: string
          relocation_willing?: boolean | null
          remote_days_preferred?: number | null
          remote_flexibility?: string | null
          remote_possible?: boolean | null
          remote_preference?: string | null
          residence_status?: string | null
          salary_bonus?: number | null
          salary_expectation_max?: number | null
          salary_expectation_min?: number | null
          salary_fix?: number | null
          seniority?: string | null
          skills?: string[] | null
          sms_opt_in?: boolean | null
          soft_skills?: Json | null
          specializations?: Json | null
          summary?: string | null
          target_employment_type?: string | null
          target_industries?: Json | null
          target_locations?: Json | null
          target_roles?: Json | null
          updated_at?: string
          video_url?: string | null
          visa_required?: boolean | null
          website_url?: string | null
          whatsapp_opt_in?: boolean | null
          work_model?: string | null
          work_permit_notes?: string | null
        }
        Update: {
          address_lat?: number | null
          address_lng?: number | null
          address_street?: string | null
          address_zip?: string | null
          availability_date?: string | null
          candidate_status?: string | null
          certificates?: Json | null
          city?: string | null
          commute_mode?: string | null
          company?: string | null
          created_at?: string
          current_salary?: number | null
          cv_ai_bullets?: Json | null
          cv_ai_summary?: string | null
          cv_parsed_at?: string | null
          cv_parser_version?: string | null
          cv_raw_text?: string | null
          cv_url?: string | null
          email?: string
          expected_salary?: number | null
          experience_years?: number | null
          expose_certifications?: Json | null
          expose_highlights?: Json | null
          expose_project_highlights?: Json | null
          expose_summary?: string | null
          expose_title?: string | null
          full_name?: string
          github_url?: string | null
          hubspot_contact_id?: string | null
          id?: string
          import_source?: string | null
          industry_experience?: Json | null
          job_title?: string | null
          linkedin_url?: string | null
          max_commute_minutes?: number | null
          nationality?: string | null
          notice_period?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          portfolio_url?: string | null
          preferred_channel?: string | null
          project_metrics?: Json | null
          recruiter_id?: string
          relocation_willing?: boolean | null
          remote_days_preferred?: number | null
          remote_flexibility?: string | null
          remote_possible?: boolean | null
          remote_preference?: string | null
          residence_status?: string | null
          salary_bonus?: number | null
          salary_expectation_max?: number | null
          salary_expectation_min?: number | null
          salary_fix?: number | null
          seniority?: string | null
          skills?: string[] | null
          sms_opt_in?: boolean | null
          soft_skills?: Json | null
          specializations?: Json | null
          summary?: string | null
          target_employment_type?: string | null
          target_industries?: Json | null
          target_locations?: Json | null
          target_roles?: Json | null
          updated_at?: string
          video_url?: string | null
          visa_required?: boolean | null
          website_url?: string | null
          whatsapp_opt_in?: boolean | null
          work_model?: string | null
          work_permit_notes?: string | null
        }
        Relationships: []
      }
      client_notifications: {
        Row: {
          action_url: string | null
          client_id: string
          created_at: string
          id: string
          is_dismissed: boolean | null
          is_read: boolean | null
          message: string
          notification_type: string
          submission_id: string | null
          title: string
        }
        Insert: {
          action_url?: string | null
          client_id: string
          created_at?: string
          id?: string
          is_dismissed?: boolean | null
          is_read?: boolean | null
          message: string
          notification_type: string
          submission_id?: string | null
          title: string
        }
        Update: {
          action_url?: string | null
          client_id?: string
          created_at?: string
          id?: string
          is_dismissed?: boolean | null
          is_read?: boolean | null
          message?: string
          notification_type?: string
          submission_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notifications_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "candidate_rankings"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "client_notifications_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      client_verifications: {
        Row: {
          client_id: string
          company_registration_number: string | null
          contract_pdf_url: string | null
          contract_signed: boolean | null
          contract_signed_at: string | null
          created_at: string | null
          digital_signature: string | null
          id: string
          kyc_rejection_reason: string | null
          kyc_status: string | null
          kyc_verified_at: string | null
          kyc_verified_by: string | null
          terms_accepted: boolean | null
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string | null
          vat_id: string | null
        }
        Insert: {
          client_id: string
          company_registration_number?: string | null
          contract_pdf_url?: string | null
          contract_signed?: boolean | null
          contract_signed_at?: string | null
          created_at?: string | null
          digital_signature?: string | null
          id?: string
          kyc_rejection_reason?: string | null
          kyc_status?: string | null
          kyc_verified_at?: string | null
          kyc_verified_by?: string | null
          terms_accepted?: boolean | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string | null
          vat_id?: string | null
        }
        Update: {
          client_id?: string
          company_registration_number?: string | null
          contract_pdf_url?: string | null
          contract_signed?: boolean | null
          contract_signed_at?: string | null
          created_at?: string | null
          digital_signature?: string | null
          id?: string
          kyc_rejection_reason?: string | null
          kyc_status?: string | null
          kyc_verified_at?: string | null
          kyc_verified_by?: string | null
          terms_accepted?: boolean | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string | null
          vat_id?: string | null
        }
        Relationships: []
      }
      coaching_playbooks: {
        Row: {
          created_at: string | null
          description: string | null
          email_template: string | null
          id: string
          is_active: boolean | null
          objection_handlers: Json | null
          phone_script: string | null
          talking_points: Json | null
          title: string
          trigger_type: string
          updated_at: string | null
          whatsapp_template: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          email_template?: string | null
          id?: string
          is_active?: boolean | null
          objection_handlers?: Json | null
          phone_script?: string | null
          talking_points?: Json | null
          title: string
          trigger_type: string
          updated_at?: string | null
          whatsapp_template?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          email_template?: string | null
          id?: string
          is_active?: boolean | null
          objection_handlers?: Json | null
          phone_script?: string | null
          talking_points?: Json | null
          title?: string
          trigger_type?: string
          updated_at?: string | null
          whatsapp_template?: string | null
        }
        Relationships: []
      }
      communication_log: {
        Row: {
          body: string
          candidate_id: string | null
          channel: string
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          external_id: string | null
          failed_at: string | null
          id: string
          links_clicked: Json | null
          message_type: string
          read_at: string | null
          sent_at: string | null
          status: string | null
          subject: string | null
          submission_id: string | null
          template_id: string | null
        }
        Insert: {
          body: string
          candidate_id?: string | null
          channel: string
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          external_id?: string | null
          failed_at?: string | null
          id?: string
          links_clicked?: Json | null
          message_type: string
          read_at?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          submission_id?: string | null
          template_id?: string | null
        }
        Update: {
          body?: string
          candidate_id?: string | null
          channel?: string
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          external_id?: string | null
          failed_at?: string | null
          id?: string
          links_clicked?: Json | null
          message_type?: string
          read_at?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          submission_id?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_log_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "communication_log_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_log_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "candidate_rankings"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "communication_log_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      commute_overrides: {
        Row: {
          accepted_commute_minutes: number | null
          asked_at: string | null
          candidate_id: string
          created_at: string | null
          id: string
          job_id: string
          responded_at: string | null
          response: string | null
          response_notes: string | null
        }
        Insert: {
          accepted_commute_minutes?: number | null
          asked_at?: string | null
          candidate_id: string
          created_at?: string | null
          id?: string
          job_id: string
          responded_at?: string | null
          response?: string | null
          response_notes?: string | null
        }
        Update: {
          accepted_commute_minutes?: number | null
          asked_at?: string | null
          candidate_id?: string
          created_at?: string | null
          id?: string
          job_id?: string
          responded_at?: string | null
          response?: string | null
          response_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commute_overrides_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "commute_overrides_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commute_overrides_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      company_profiles: {
        Row: {
          address: string | null
          benefits: Json | null
          billing_email: string | null
          brand_color_primary: string | null
          brand_color_secondary: string | null
          company_name: string
          created_at: string
          culture_values: Json | null
          description: string | null
          id: string
          industry: string | null
          logo_url: string | null
          office_locations: Json | null
          opt_in_message: string | null
          perks: Json | null
          remote_policy: string | null
          show_benefits_in_opt_in: boolean | null
          show_culture_in_opt_in: boolean | null
          show_team_size_in_opt_in: boolean | null
          tagline: string | null
          tax_id: string | null
          team_size_range: string | null
          updated_at: string
          user_id: string
          website: string | null
          work_style: string | null
        }
        Insert: {
          address?: string | null
          benefits?: Json | null
          billing_email?: string | null
          brand_color_primary?: string | null
          brand_color_secondary?: string | null
          company_name: string
          created_at?: string
          culture_values?: Json | null
          description?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          office_locations?: Json | null
          opt_in_message?: string | null
          perks?: Json | null
          remote_policy?: string | null
          show_benefits_in_opt_in?: boolean | null
          show_culture_in_opt_in?: boolean | null
          show_team_size_in_opt_in?: boolean | null
          tagline?: string | null
          tax_id?: string | null
          team_size_range?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
          work_style?: string | null
        }
        Update: {
          address?: string | null
          benefits?: Json | null
          billing_email?: string | null
          brand_color_primary?: string | null
          brand_color_secondary?: string | null
          company_name?: string
          created_at?: string
          culture_values?: Json | null
          description?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          office_locations?: Json | null
          opt_in_message?: string | null
          perks?: Json | null
          remote_policy?: string | null
          show_benefits_in_opt_in?: boolean | null
          show_culture_in_opt_in?: boolean | null
          show_team_size_in_opt_in?: boolean | null
          tagline?: string | null
          tax_id?: string | null
          team_size_range?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
          work_style?: string | null
        }
        Relationships: []
      }
      company_summaries: {
        Row: {
          company_profile_id: string
          content: string
          generated_at: string | null
          id: string
          is_approved: boolean | null
          summary_type: string
        }
        Insert: {
          company_profile_id: string
          content: string
          generated_at?: string | null
          id?: string
          is_approved?: boolean | null
          summary_type: string
        }
        Update: {
          company_profile_id?: string
          content?: string
          generated_at?: string | null
          id?: string
          is_approved?: boolean | null
          summary_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_summaries_company_profile_id_fkey"
            columns: ["company_profile_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          consent_type: string
          created_at: string
          granted: boolean
          granted_at: string | null
          id: string
          ip_address: string | null
          revoked_at: string | null
          scope: string | null
          subject_id: string
          subject_type: string
          user_agent: string | null
          version: string
        }
        Insert: {
          consent_type: string
          created_at?: string
          granted?: boolean
          granted_at?: string | null
          id?: string
          ip_address?: string | null
          revoked_at?: string | null
          scope?: string | null
          subject_id: string
          subject_type: string
          user_agent?: string | null
          version?: string
        }
        Update: {
          consent_type?: string
          created_at?: string
          granted?: boolean
          granted_at?: string | null
          id?: string
          ip_address?: string | null
          revoked_at?: string | null
          scope?: string | null
          subject_id?: string
          subject_type?: string
          user_agent?: string | null
          version?: string
        }
        Relationships: []
      }
      data_deletion_requests: {
        Row: {
          completed_at: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string | null
          id: string
          reason: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      data_export_requests: {
        Row: {
          completed_at: string | null
          expires_at: string | null
          file_url: string | null
          id: string
          requested_at: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          expires_at?: string | null
          file_url?: string | null
          id?: string
          requested_at?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          expires_at?: string | null
          file_url?: string | null
          id?: string
          requested_at?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      deal_health: {
        Row: {
          ai_assessment: string | null
          bottleneck: string | null
          bottleneck_days: number | null
          bottleneck_user_id: string | null
          calculated_at: string | null
          created_at: string | null
          days_since_last_activity: number | null
          drop_off_probability: number | null
          health_score: number | null
          id: string
          recommended_actions: Json | null
          risk_factors: Json | null
          risk_level: string | null
          submission_id: string
          updated_at: string | null
        }
        Insert: {
          ai_assessment?: string | null
          bottleneck?: string | null
          bottleneck_days?: number | null
          bottleneck_user_id?: string | null
          calculated_at?: string | null
          created_at?: string | null
          days_since_last_activity?: number | null
          drop_off_probability?: number | null
          health_score?: number | null
          id?: string
          recommended_actions?: Json | null
          risk_factors?: Json | null
          risk_level?: string | null
          submission_id: string
          updated_at?: string | null
        }
        Update: {
          ai_assessment?: string | null
          bottleneck?: string | null
          bottleneck_days?: number | null
          bottleneck_user_id?: string | null
          calculated_at?: string | null
          created_at?: string | null
          days_since_last_activity?: number | null
          drop_off_probability?: number | null
          health_score?: number | null
          id?: string
          recommended_actions?: Json | null
          risk_factors?: Json | null
          risk_level?: string | null
          submission_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      email_events: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          status: string
          subject: string | null
          template_name: string
          to_email: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          subject?: string | null
          template_name: string
          to_email: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          subject?: string | null
          template_name?: string
          to_email?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          subject: string
          trigger_event: string
          updated_at: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subject: string
          trigger_event: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string
          trigger_event?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      employer_feedback: {
        Row: {
          candidate_id: string
          client_id: string
          communication_rating: number | null
          created_at: string | null
          id: string
          improvement_areas: string[] | null
          positive_aspects: string[] | null
          process_rating: number | null
          respect_rating: number | null
          submission_id: string
          transparency_rating: number | null
          would_recommend: boolean | null
        }
        Insert: {
          candidate_id: string
          client_id: string
          communication_rating?: number | null
          created_at?: string | null
          id?: string
          improvement_areas?: string[] | null
          positive_aspects?: string[] | null
          process_rating?: number | null
          respect_rating?: number | null
          submission_id: string
          transparency_rating?: number | null
          would_recommend?: boolean | null
        }
        Update: {
          candidate_id?: string
          client_id?: string
          communication_rating?: number | null
          created_at?: string | null
          id?: string
          improvement_areas?: string[] | null
          positive_aspects?: string[] | null
          process_rating?: number | null
          respect_rating?: number | null
          submission_id?: string
          transparency_rating?: number | null
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "employer_feedback_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "employer_feedback_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_scores: {
        Row: {
          avg_response_time_hours: number | null
          avg_salary_vs_market: number | null
          calculated_at: string | null
          candidate_satisfaction_avg: number | null
          client_id: string
          id: string
          interview_feedback_speed_days: number | null
          interview_quality_score: number | null
          interview_scheduling_speed_days: number | null
          no_show_rate: number | null
          offer_acceptance_rate: number | null
          offer_rate: number | null
          overall_score: number | null
          reliability_score: number | null
          response_time_score: number | null
          total_interviews: number | null
          total_placements: number | null
          total_submissions: number | null
          updated_at: string | null
        }
        Insert: {
          avg_response_time_hours?: number | null
          avg_salary_vs_market?: number | null
          calculated_at?: string | null
          candidate_satisfaction_avg?: number | null
          client_id: string
          id?: string
          interview_feedback_speed_days?: number | null
          interview_quality_score?: number | null
          interview_scheduling_speed_days?: number | null
          no_show_rate?: number | null
          offer_acceptance_rate?: number | null
          offer_rate?: number | null
          overall_score?: number | null
          reliability_score?: number | null
          response_time_score?: number | null
          total_interviews?: number | null
          total_placements?: number | null
          total_submissions?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_response_time_hours?: number | null
          avg_salary_vs_market?: number | null
          calculated_at?: string | null
          candidate_satisfaction_avg?: number | null
          client_id?: string
          id?: string
          interview_feedback_speed_days?: number | null
          interview_quality_score?: number | null
          interview_scheduling_speed_days?: number | null
          no_show_rate?: number | null
          offer_acceptance_rate?: number | null
          offer_rate?: number | null
          overall_score?: number | null
          reliability_score?: number | null
          response_time_score?: number | null
          total_interviews?: number | null
          total_placements?: number | null
          total_submissions?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fraud_signals: {
        Row: {
          action_taken: string | null
          auto_action_taken: string | null
          candidate_id: string | null
          confidence_score: number | null
          created_at: string | null
          details: Json | null
          evidence: Json | null
          id: string
          job_id: string | null
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string | null
          signal_type: string
          status: string | null
          submission_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          action_taken?: string | null
          auto_action_taken?: string | null
          candidate_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          details?: Json | null
          evidence?: Json | null
          id?: string
          job_id?: string | null
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string | null
          signal_type: string
          status?: string | null
          submission_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          action_taken?: string | null
          auto_action_taken?: string | null
          candidate_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          details?: Json | null
          evidence?: Json | null
          id?: string
          job_id?: string | null
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string | null
          signal_type?: string
          status?: string | null
          submission_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      funnel_metrics: {
        Row: {
          acceptance_rate: number | null
          avg_candidate_score: number | null
          avg_match_score: number | null
          avg_time_to_fill_days: number | null
          avg_time_to_interview_days: number | null
          avg_time_to_offer_days: number | null
          avg_time_to_opt_in_hours: number | null
          calculated_at: string | null
          drop_off_reasons: Json | null
          drop_offs_by_stage: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          interview_rate: number | null
          interview_to_offer: number | null
          offer_rate: number | null
          offer_to_placement: number | null
          opt_in_rate: number | null
          opt_in_to_interview: number | null
          period_end: string
          period_start: string
          submissions_to_opt_in: number | null
          total_submissions: number | null
        }
        Insert: {
          acceptance_rate?: number | null
          avg_candidate_score?: number | null
          avg_match_score?: number | null
          avg_time_to_fill_days?: number | null
          avg_time_to_interview_days?: number | null
          avg_time_to_offer_days?: number | null
          avg_time_to_opt_in_hours?: number | null
          calculated_at?: string | null
          drop_off_reasons?: Json | null
          drop_offs_by_stage?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          interview_rate?: number | null
          interview_to_offer?: number | null
          offer_rate?: number | null
          offer_to_placement?: number | null
          opt_in_rate?: number | null
          opt_in_to_interview?: number | null
          period_end: string
          period_start: string
          submissions_to_opt_in?: number | null
          total_submissions?: number | null
        }
        Update: {
          acceptance_rate?: number | null
          avg_candidate_score?: number | null
          avg_match_score?: number | null
          avg_time_to_fill_days?: number | null
          avg_time_to_interview_days?: number | null
          avg_time_to_offer_days?: number | null
          avg_time_to_opt_in_hours?: number | null
          calculated_at?: string | null
          drop_off_reasons?: Json | null
          drop_offs_by_stage?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          interview_rate?: number | null
          interview_to_offer?: number | null
          offer_rate?: number | null
          offer_to_placement?: number | null
          opt_in_rate?: number | null
          opt_in_to_interview?: number | null
          period_end?: string
          period_start?: string
          submissions_to_opt_in?: number | null
          total_submissions?: number | null
        }
        Relationships: []
      }
      identity_unlock_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          performed_by: string | null
          submission_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string | null
          submission_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_unlock_logs_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "candidate_rankings"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "identity_unlock_logs_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      influence_alerts: {
        Row: {
          action_taken: string | null
          action_taken_at: string | null
          alert_type: string
          created_at: string | null
          expires_at: string | null
          id: string
          is_dismissed: boolean | null
          is_read: boolean | null
          message: string
          playbook_id: string | null
          priority: string | null
          recommended_action: string
          recruiter_id: string
          submission_id: string
          title: string
        }
        Insert: {
          action_taken?: string | null
          action_taken_at?: string | null
          alert_type: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_dismissed?: boolean | null
          is_read?: boolean | null
          message: string
          playbook_id?: string | null
          priority?: string | null
          recommended_action: string
          recruiter_id: string
          submission_id: string
          title: string
        }
        Update: {
          action_taken?: string | null
          action_taken_at?: string | null
          alert_type?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_dismissed?: boolean | null
          is_read?: boolean | null
          message?: string
          playbook_id?: string | null
          priority?: string | null
          recommended_action?: string
          recruiter_id?: string
          submission_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "influence_alerts_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "candidate_rankings"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "influence_alerts_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_mappings: {
        Row: {
          entity_type: string
          external_id: string
          id: string
          integration_id: string
          internal_id: string
          last_synced_at: string | null
          sync_status: string | null
        }
        Insert: {
          entity_type: string
          external_id: string
          id?: string
          integration_id: string
          internal_id: string
          last_synced_at?: string | null
          sync_status?: string | null
        }
        Update: {
          entity_type?: string
          external_id?: string
          id?: string
          integration_id?: string
          internal_id?: string
          last_synced_at?: string | null
          sync_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_mappings_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_log: {
        Row: {
          completed_at: string | null
          direction: string
          errors: Json | null
          id: string
          integration_id: string
          records_created: number | null
          records_failed: number | null
          records_processed: number | null
          records_updated: number | null
          started_at: string | null
          status: string | null
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          direction: string
          errors?: Json | null
          id?: string
          integration_id: string
          records_created?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_updated?: number | null
          started_at?: string | null
          status?: string | null
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          direction?: string
          errors?: Json | null
          id?: string
          integration_id?: string
          records_created?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_updated?: number | null
          started_at?: string | null
          status?: string | null
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_log_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          access_token_encrypted: string | null
          api_key_encrypted: string | null
          config: Json | null
          created_at: string | null
          error_message: string | null
          id: string
          last_synced_at: string | null
          organization_id: string
          provider: string
          refresh_token_encrypted: string | null
          status: string | null
          sync_candidates: boolean | null
          sync_interval_minutes: number | null
          sync_jobs: boolean | null
          sync_status: boolean | null
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          access_token_encrypted?: string | null
          api_key_encrypted?: string | null
          config?: Json | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_synced_at?: string | null
          organization_id: string
          provider: string
          refresh_token_encrypted?: string | null
          status?: string | null
          sync_candidates?: boolean | null
          sync_interval_minutes?: number | null
          sync_jobs?: boolean | null
          sync_status?: boolean | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token_encrypted?: string | null
          api_key_encrypted?: string | null
          config?: Json | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_synced_at?: string | null
          organization_id?: string
          provider?: string
          refresh_token_encrypted?: string | null
          status?: string | null
          sync_candidates?: boolean | null
          sync_interval_minutes?: number | null
          sync_jobs?: boolean | null
          sync_status?: boolean | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_intelligence: {
        Row: {
          ai_assessment: Json | null
          candidate_prep: Json | null
          candidate_summary: string | null
          company_insights: Json | null
          created_at: string | null
          hiring_recommendation: string | null
          id: string
          interview_feedback: Json | null
          interview_id: string
          interviewer_guide: Json | null
          recommendation_reasoning: string | null
          recruiter_next_steps: Json | null
          risk_assessment: Json | null
          submission_id: string
          updated_at: string | null
        }
        Insert: {
          ai_assessment?: Json | null
          candidate_prep?: Json | null
          candidate_summary?: string | null
          company_insights?: Json | null
          created_at?: string | null
          hiring_recommendation?: string | null
          id?: string
          interview_feedback?: Json | null
          interview_id: string
          interviewer_guide?: Json | null
          recommendation_reasoning?: string | null
          recruiter_next_steps?: Json | null
          risk_assessment?: Json | null
          submission_id: string
          updated_at?: string | null
        }
        Update: {
          ai_assessment?: Json | null
          candidate_prep?: Json | null
          candidate_summary?: string | null
          company_insights?: Json | null
          created_at?: string | null
          hiring_recommendation?: string | null
          id?: string
          interview_feedback?: Json | null
          interview_id?: string
          interviewer_guide?: Json | null
          recommendation_reasoning?: string | null
          recruiter_next_steps?: Json | null
          risk_assessment?: Json | null
          submission_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_intelligence_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_intelligence_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "candidate_rankings"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "interview_intelligence_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          calendar_event_id: string | null
          candidate_confirmed: boolean | null
          candidate_confirmed_at: string | null
          client_confirmed: boolean | null
          client_confirmed_at: string | null
          created_at: string
          duration_minutes: number | null
          feedback: string | null
          id: string
          meeting_link: string | null
          meeting_type: string | null
          no_show_by: string | null
          no_show_reported: boolean | null
          notes: string | null
          proposed_slots: Json | null
          reminder_1h_sent: boolean | null
          reminder_24h_sent: boolean | null
          scheduled_at: string | null
          selected_slot_index: number | null
          selection_token: string | null
          status: string | null
          submission_id: string
          teams_join_url: string | null
          teams_meeting_id: string | null
          updated_at: string
        }
        Insert: {
          calendar_event_id?: string | null
          candidate_confirmed?: boolean | null
          candidate_confirmed_at?: string | null
          client_confirmed?: boolean | null
          client_confirmed_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          feedback?: string | null
          id?: string
          meeting_link?: string | null
          meeting_type?: string | null
          no_show_by?: string | null
          no_show_reported?: boolean | null
          notes?: string | null
          proposed_slots?: Json | null
          reminder_1h_sent?: boolean | null
          reminder_24h_sent?: boolean | null
          scheduled_at?: string | null
          selected_slot_index?: number | null
          selection_token?: string | null
          status?: string | null
          submission_id: string
          teams_join_url?: string | null
          teams_meeting_id?: string | null
          updated_at?: string
        }
        Update: {
          calendar_event_id?: string | null
          candidate_confirmed?: boolean | null
          candidate_confirmed_at?: string | null
          client_confirmed?: boolean | null
          client_confirmed_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          feedback?: string | null
          id?: string
          meeting_link?: string | null
          meeting_type?: string | null
          no_show_by?: string | null
          no_show_reported?: boolean | null
          notes?: string | null
          proposed_slots?: Json | null
          reminder_1h_sent?: boolean | null
          reminder_24h_sent?: boolean | null
          scheduled_at?: string | null
          selected_slot_index?: number | null
          selection_token?: string | null
          status?: string | null
          submission_id?: string
          teams_join_url?: string | null
          teams_meeting_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "candidate_rankings"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "interviews_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          currency: string | null
          due_date: string | null
          id: string
          invoice_number: string
          paid_at: string | null
          pdf_url: string | null
          placement_id: string
          status: string | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          tax_amount: number | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          currency?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          paid_at?: string | null
          pdf_url?: string | null
          placement_id: string
          status?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          tax_amount?: number | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          currency?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          paid_at?: string | null
          pdf_url?: string | null
          placement_id?: string
          status?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          briefing_notes: string | null
          client_id: string
          commute_flexibility: string | null
          company_name: string
          created_at: string
          deadline: string | null
          description: string | null
          employment_type: string | null
          experience_level: string | null
          fee_percentage: number | null
          id: string
          industry: string | null
          location: string | null
          must_haves: string[] | null
          nice_to_haves: string[] | null
          office_address: string | null
          office_lat: number | null
          office_lng: number | null
          onsite_days_required: number | null
          organization_id: string | null
          paused_at: string | null
          recruiter_fee_percentage: number | null
          remote_policy: string | null
          remote_type: string | null
          requirements: string | null
          salary_max: number | null
          salary_min: number | null
          screening_questions: Json | null
          skills: string[] | null
          status: string | null
          title: string
          updated_at: string
          urgency: string | null
        }
        Insert: {
          briefing_notes?: string | null
          client_id: string
          commute_flexibility?: string | null
          company_name: string
          created_at?: string
          deadline?: string | null
          description?: string | null
          employment_type?: string | null
          experience_level?: string | null
          fee_percentage?: number | null
          id?: string
          industry?: string | null
          location?: string | null
          must_haves?: string[] | null
          nice_to_haves?: string[] | null
          office_address?: string | null
          office_lat?: number | null
          office_lng?: number | null
          onsite_days_required?: number | null
          organization_id?: string | null
          paused_at?: string | null
          recruiter_fee_percentage?: number | null
          remote_policy?: string | null
          remote_type?: string | null
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          screening_questions?: Json | null
          skills?: string[] | null
          status?: string | null
          title: string
          updated_at?: string
          urgency?: string | null
        }
        Update: {
          briefing_notes?: string | null
          client_id?: string
          commute_flexibility?: string | null
          company_name?: string
          created_at?: string
          deadline?: string | null
          description?: string | null
          employment_type?: string | null
          experience_level?: string | null
          fee_percentage?: number | null
          id?: string
          industry?: string | null
          location?: string | null
          must_haves?: string[] | null
          nice_to_haves?: string[] | null
          office_address?: string | null
          office_lat?: number | null
          office_lng?: number | null
          onsite_days_required?: number | null
          organization_id?: string | null
          paused_at?: string | null
          recruiter_fee_percentage?: number | null
          remote_policy?: string | null
          remote_type?: string | null
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          screening_questions?: Json | null
          skills?: string[] | null
          status?: string | null
          title?: string
          updated_at?: string
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      match_outcomes: {
        Row: {
          actual_outcome: string | null
          candidate_id: string | null
          created_at: string | null
          days_to_outcome: number | null
          gate_results: Json | null
          id: string
          job_id: string | null
          match_version: string
          outcome_recorded_at: string | null
          outcome_stage: string | null
          predicted_constraint_score: number | null
          predicted_deal_probability: number | null
          predicted_fit_score: number | null
          predicted_overall_score: number | null
          rejection_category: string | null
          rejection_reason: string | null
          submission_id: string | null
        }
        Insert: {
          actual_outcome?: string | null
          candidate_id?: string | null
          created_at?: string | null
          days_to_outcome?: number | null
          gate_results?: Json | null
          id?: string
          job_id?: string | null
          match_version?: string
          outcome_recorded_at?: string | null
          outcome_stage?: string | null
          predicted_constraint_score?: number | null
          predicted_deal_probability?: number | null
          predicted_fit_score?: number | null
          predicted_overall_score?: number | null
          rejection_category?: string | null
          rejection_reason?: string | null
          submission_id?: string | null
        }
        Update: {
          actual_outcome?: string | null
          candidate_id?: string | null
          created_at?: string | null
          days_to_outcome?: number | null
          gate_results?: Json | null
          id?: string
          job_id?: string | null
          match_version?: string
          outcome_recorded_at?: string | null
          outcome_stage?: string | null
          predicted_constraint_score?: number | null
          predicted_deal_probability?: number | null
          predicted_fit_score?: number | null
          predicted_overall_score?: number | null
          rejection_category?: string | null
          rejection_reason?: string | null
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_outcomes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "match_outcomes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_outcomes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_outcomes_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "candidate_rankings"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "match_outcomes_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      matching_config: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          gate_thresholds: Json
          id: string
          name: string | null
          updated_at: string | null
          version: string
          weights: Json
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          gate_thresholds?: Json
          id?: string
          name?: string | null
          updated_at?: string | null
          version: string
          weights?: Json
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          gate_thresholds?: Json
          id?: string
          name?: string | null
          updated_at?: string | null
          version?: string
          weights?: Json
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          body: string
          channel: string
          created_at: string | null
          id: string
          is_active: boolean | null
          message_type: string
          name: string
          subject: string | null
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          body: string
          channel: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          message_type: string
          name: string
          subject?: string | null
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          message_type?: string
          name?: string
          subject?: string | null
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          candidate_id: string | null
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          is_read: boolean | null
          job_id: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          candidate_id?: string | null
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          job_id?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          candidate_id?: string | null
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          job_id?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string | null
          related_id: string | null
          related_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          related_id?: string | null
          related_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          related_id?: string | null
          related_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      offer_events: {
        Row: {
          actor_id: string | null
          actor_type: string | null
          created_at: string | null
          details: Json | null
          event_type: string
          id: string
          offer_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string | null
          created_at?: string | null
          details?: Json | null
          event_type: string
          id?: string
          offer_id: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string | null
          created_at?: string | null
          details?: Json | null
          event_type?: string
          id?: string
          offer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_events_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          access_token: string | null
          benefits: Json | null
          bonus_amount: number | null
          candidate_id: string
          candidate_signature: string | null
          candidate_signed_at: string | null
          client_id: string
          client_signature: string | null
          client_signed_at: string | null
          contract_type: string | null
          counter_offer_at: string | null
          counter_offer_notes: string | null
          counter_offer_salary: number | null
          created_at: string | null
          custom_terms: string | null
          decision_at: string | null
          equity_percentage: number | null
          expires_at: string | null
          id: string
          job_id: string
          location: string | null
          negotiation_rounds: number | null
          offer_document_url: string | null
          original_salary: number | null
          position_title: string
          probation_months: number | null
          recruiter_id: string
          rejection_reason: string | null
          remote_policy: string | null
          salary_currency: string | null
          salary_offered: number
          sent_at: string | null
          start_date: string | null
          status: string | null
          submission_id: string
          updated_at: string | null
          viewed_at: string | null
        }
        Insert: {
          access_token?: string | null
          benefits?: Json | null
          bonus_amount?: number | null
          candidate_id: string
          candidate_signature?: string | null
          candidate_signed_at?: string | null
          client_id: string
          client_signature?: string | null
          client_signed_at?: string | null
          contract_type?: string | null
          counter_offer_at?: string | null
          counter_offer_notes?: string | null
          counter_offer_salary?: number | null
          created_at?: string | null
          custom_terms?: string | null
          decision_at?: string | null
          equity_percentage?: number | null
          expires_at?: string | null
          id?: string
          job_id: string
          location?: string | null
          negotiation_rounds?: number | null
          offer_document_url?: string | null
          original_salary?: number | null
          position_title: string
          probation_months?: number | null
          recruiter_id: string
          rejection_reason?: string | null
          remote_policy?: string | null
          salary_currency?: string | null
          salary_offered: number
          sent_at?: string | null
          start_date?: string | null
          status?: string | null
          submission_id: string
          updated_at?: string | null
          viewed_at?: string | null
        }
        Update: {
          access_token?: string | null
          benefits?: Json | null
          bonus_amount?: number | null
          candidate_id?: string
          candidate_signature?: string | null
          candidate_signed_at?: string | null
          client_id?: string
          client_signature?: string | null
          client_signed_at?: string | null
          contract_type?: string | null
          counter_offer_at?: string | null
          counter_offer_notes?: string | null
          counter_offer_salary?: number | null
          created_at?: string | null
          custom_terms?: string | null
          decision_at?: string | null
          equity_percentage?: number | null
          expires_at?: string | null
          id?: string
          job_id?: string
          location?: string | null
          negotiation_rounds?: number | null
          offer_document_url?: string | null
          original_salary?: number | null
          position_title?: string
          probation_months?: number | null
          recruiter_id?: string
          rejection_reason?: string | null
          remote_policy?: string | null
          salary_currency?: string | null
          salary_offered?: number
          sent_at?: string | null
          start_date?: string | null
          status?: string | null
          submission_id?: string
          updated_at?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "offers_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "candidate_rankings"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "offers_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          permissions: Json | null
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by: string
          organization_id: string
          permissions?: Json | null
          role: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          permissions?: Json | null
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          joined_at: string | null
          organization_id: string
          permissions: Json | null
          role: string
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          organization_id: string
          permissions?: Json | null
          role: string
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          organization_id?: string
          permissions?: Json | null
          role?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_email: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          settings: Json | null
          stripe_customer_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          billing_email?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          settings?: Json | null
          stripe_customer_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          billing_email?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          settings?: Json | null
          stripe_customer_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      outreach_campaigns: {
        Row: {
          allowed_cta: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          forbidden_words: Json | null
          goal: string
          id: string
          is_active: boolean | null
          is_paused: boolean | null
          max_word_count: number | null
          name: string
          sender_email: string
          sender_name: string
          sender_signature: string | null
          sequence_steps: Json | null
          stats: Json | null
          target_company_sizes: Json | null
          target_industries: Json | null
          target_regions: Json | null
          target_segment: string
          tonality: string | null
          updated_at: string | null
        }
        Insert: {
          allowed_cta?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          forbidden_words?: Json | null
          goal?: string
          id?: string
          is_active?: boolean | null
          is_paused?: boolean | null
          max_word_count?: number | null
          name: string
          sender_email: string
          sender_name: string
          sender_signature?: string | null
          sequence_steps?: Json | null
          stats?: Json | null
          target_company_sizes?: Json | null
          target_industries?: Json | null
          target_regions?: Json | null
          target_segment?: string
          tonality?: string | null
          updated_at?: string | null
        }
        Update: {
          allowed_cta?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          forbidden_words?: Json | null
          goal?: string
          id?: string
          is_active?: boolean | null
          is_paused?: boolean | null
          max_word_count?: number | null
          name?: string
          sender_email?: string
          sender_name?: string
          sender_signature?: string | null
          sequence_steps?: Json | null
          stats?: Json | null
          target_company_sizes?: Json | null
          target_industries?: Json | null
          target_regions?: Json | null
          target_segment?: string
          tonality?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      outreach_conversations: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          id: string
          intent: string | null
          last_message_at: string | null
          lead_id: string | null
          message_count: number | null
          sentiment: string | null
          status: string | null
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          id?: string
          intent?: string | null
          last_message_at?: string | null
          lead_id?: string | null
          message_count?: number | null
          sentiment?: string | null
          status?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          id?: string
          intent?: string | null
          last_message_at?: string | null
          lead_id?: string | null
          message_count?: number | null
          sentiment?: string | null
          status?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "outreach_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_emails: {
        Row: {
          body: string
          body_html: string | null
          campaign_id: string | null
          click_count: number | null
          clicked_at: string | null
          clicked_links: Json | null
          confidence_level: string | null
          converted_at: string | null
          created_at: string | null
          generation_prompt: string | null
          id: string
          lead_id: string | null
          meeting_booked_at: string | null
          open_count: number | null
          opened_at: string | null
          replied_at: string | null
          reply_intent: string | null
          reply_sentiment: string | null
          resend_id: string | null
          revenue_attributed: number | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scheduled_for: string | null
          sent_at: string | null
          sequence_step: number | null
          status: string | null
          subject: string
          updated_at: string | null
          used_variables: Json | null
        }
        Insert: {
          body: string
          body_html?: string | null
          campaign_id?: string | null
          click_count?: number | null
          clicked_at?: string | null
          clicked_links?: Json | null
          confidence_level?: string | null
          converted_at?: string | null
          created_at?: string | null
          generation_prompt?: string | null
          id?: string
          lead_id?: string | null
          meeting_booked_at?: string | null
          open_count?: number | null
          opened_at?: string | null
          replied_at?: string | null
          reply_intent?: string | null
          reply_sentiment?: string | null
          resend_id?: string | null
          revenue_attributed?: number | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          sequence_step?: number | null
          status?: string | null
          subject: string
          updated_at?: string | null
          used_variables?: Json | null
        }
        Update: {
          body?: string
          body_html?: string | null
          campaign_id?: string | null
          click_count?: number | null
          clicked_at?: string | null
          clicked_links?: Json | null
          confidence_level?: string | null
          converted_at?: string | null
          created_at?: string | null
          generation_prompt?: string | null
          id?: string
          lead_id?: string | null
          meeting_booked_at?: string | null
          open_count?: number | null
          opened_at?: string | null
          replied_at?: string | null
          reply_intent?: string | null
          reply_sentiment?: string | null
          resend_id?: string | null
          revenue_attributed?: number | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          sequence_step?: number | null
          status?: string | null
          subject?: string
          updated_at?: string | null
          used_variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_emails_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "outreach_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_emails_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "outreach_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_import_jobs: {
        Row: {
          column_mapping: Json | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          duplicate_rows: number | null
          error_log: Json | null
          failed_rows: number | null
          file_url: string | null
          filename: string
          id: string
          processed_rows: number | null
          status: string | null
          successful_rows: number | null
          total_rows: number | null
        }
        Insert: {
          column_mapping?: Json | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          duplicate_rows?: number | null
          error_log?: Json | null
          failed_rows?: number | null
          file_url?: string | null
          filename: string
          id?: string
          processed_rows?: number | null
          status?: string | null
          successful_rows?: number | null
          total_rows?: number | null
        }
        Update: {
          column_mapping?: Json | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          duplicate_rows?: number | null
          error_log?: Json | null
          failed_rows?: number | null
          file_url?: string | null
          filename?: string
          id?: string
          processed_rows?: number | null
          status?: string | null
          successful_rows?: number | null
          total_rows?: number | null
        }
        Relationships: []
      }
      outreach_leads: {
        Row: {
          city: string | null
          company_address_line: string | null
          company_alias: string | null
          company_city: string | null
          company_country: string | null
          company_description: string | null
          company_domain: string | null
          company_financials: string | null
          company_founded_year: number | null
          company_headcount: number | null
          company_industries: Json | null
          company_linkedin_url: string | null
          company_name: string
          company_size: string | null
          company_state: string | null
          company_technologies: Json | null
          company_type: string | null
          company_website: string | null
          company_zip: string | null
          contact_email: string
          contact_linkedin: string | null
          contact_name: string
          contact_phone: string | null
          contact_role: string | null
          converted_at: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          current_ats: string | null
          custom_attributes: Json | null
          department: string | null
          direct_phone: string | null
          education: string | null
          email_quality: string | null
          email_verification_status: string | null
          first_name: string | null
          founding_year: number | null
          hiring_signals: Json | null
          hiring_volume: string | null
          hq_address_line: string | null
          hq_city: string | null
          hq_country: string | null
          hq_name: string | null
          hq_state: string | null
          hq_zip: string | null
          id: string
          industry: string | null
          job_change_data: Json | null
          language: string | null
          last_contacted_at: string | null
          last_name: string | null
          last_replied_at: string | null
          lead_source: string | null
          list_name: string | null
          location_move_data: Json | null
          mobile_phone: string | null
          notes: string | null
          office_phone: string | null
          open_positions_estimate: number | null
          personal_linkedin_url: string | null
          priority: string | null
          profile_id: string | null
          recruiting_challenges: Json | null
          region: string | null
          revenue_range: string | null
          score: number | null
          segment: string
          seniority: string | null
          sid: string | null
          status: string | null
          tags: Json | null
          updated_at: string | null
        }
        Insert: {
          city?: string | null
          company_address_line?: string | null
          company_alias?: string | null
          company_city?: string | null
          company_country?: string | null
          company_description?: string | null
          company_domain?: string | null
          company_financials?: string | null
          company_founded_year?: number | null
          company_headcount?: number | null
          company_industries?: Json | null
          company_linkedin_url?: string | null
          company_name: string
          company_size?: string | null
          company_state?: string | null
          company_technologies?: Json | null
          company_type?: string | null
          company_website?: string | null
          company_zip?: string | null
          contact_email: string
          contact_linkedin?: string | null
          contact_name: string
          contact_phone?: string | null
          contact_role?: string | null
          converted_at?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          current_ats?: string | null
          custom_attributes?: Json | null
          department?: string | null
          direct_phone?: string | null
          education?: string | null
          email_quality?: string | null
          email_verification_status?: string | null
          first_name?: string | null
          founding_year?: number | null
          hiring_signals?: Json | null
          hiring_volume?: string | null
          hq_address_line?: string | null
          hq_city?: string | null
          hq_country?: string | null
          hq_name?: string | null
          hq_state?: string | null
          hq_zip?: string | null
          id?: string
          industry?: string | null
          job_change_data?: Json | null
          language?: string | null
          last_contacted_at?: string | null
          last_name?: string | null
          last_replied_at?: string | null
          lead_source?: string | null
          list_name?: string | null
          location_move_data?: Json | null
          mobile_phone?: string | null
          notes?: string | null
          office_phone?: string | null
          open_positions_estimate?: number | null
          personal_linkedin_url?: string | null
          priority?: string | null
          profile_id?: string | null
          recruiting_challenges?: Json | null
          region?: string | null
          revenue_range?: string | null
          score?: number | null
          segment?: string
          seniority?: string | null
          sid?: string | null
          status?: string | null
          tags?: Json | null
          updated_at?: string | null
        }
        Update: {
          city?: string | null
          company_address_line?: string | null
          company_alias?: string | null
          company_city?: string | null
          company_country?: string | null
          company_description?: string | null
          company_domain?: string | null
          company_financials?: string | null
          company_founded_year?: number | null
          company_headcount?: number | null
          company_industries?: Json | null
          company_linkedin_url?: string | null
          company_name?: string
          company_size?: string | null
          company_state?: string | null
          company_technologies?: Json | null
          company_type?: string | null
          company_website?: string | null
          company_zip?: string | null
          contact_email?: string
          contact_linkedin?: string | null
          contact_name?: string
          contact_phone?: string | null
          contact_role?: string | null
          converted_at?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          current_ats?: string | null
          custom_attributes?: Json | null
          department?: string | null
          direct_phone?: string | null
          education?: string | null
          email_quality?: string | null
          email_verification_status?: string | null
          first_name?: string | null
          founding_year?: number | null
          hiring_signals?: Json | null
          hiring_volume?: string | null
          hq_address_line?: string | null
          hq_city?: string | null
          hq_country?: string | null
          hq_name?: string | null
          hq_state?: string | null
          hq_zip?: string | null
          id?: string
          industry?: string | null
          job_change_data?: Json | null
          language?: string | null
          last_contacted_at?: string | null
          last_name?: string | null
          last_replied_at?: string | null
          lead_source?: string | null
          list_name?: string | null
          location_move_data?: Json | null
          mobile_phone?: string | null
          notes?: string | null
          office_phone?: string | null
          open_positions_estimate?: number | null
          personal_linkedin_url?: string | null
          priority?: string | null
          profile_id?: string | null
          recruiting_challenges?: Json | null
          region?: string | null
          revenue_range?: string | null
          score?: number | null
          segment?: string
          seniority?: string | null
          sid?: string | null
          status?: string | null
          tags?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      outreach_messages: {
        Row: {
          ai_summary: string | null
          body: string
          body_html: string | null
          conversation_id: string | null
          created_at: string | null
          direction: string
          email_id: string | null
          from_email: string | null
          from_name: string | null
          id: string
          intent: string | null
          is_read: boolean | null
          is_starred: boolean | null
          received_at: string | null
          sentiment: string | null
          subject: string | null
          suggested_action: string | null
        }
        Insert: {
          ai_summary?: string | null
          body: string
          body_html?: string | null
          conversation_id?: string | null
          created_at?: string | null
          direction?: string
          email_id?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          intent?: string | null
          is_read?: boolean | null
          is_starred?: boolean | null
          received_at?: string | null
          sentiment?: string | null
          subject?: string | null
          suggested_action?: string | null
        }
        Update: {
          ai_summary?: string | null
          body?: string
          body_html?: string | null
          conversation_id?: string | null
          created_at?: string | null
          direction?: string
          email_id?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          intent?: string | null
          is_read?: boolean | null
          is_starred?: boolean | null
          received_at?: string | null
          sentiment?: string | null
          subject?: string | null
          suggested_action?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "outreach_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_messages_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "outreach_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_send_queue: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string | null
          email_id: string | null
          error_message: string | null
          id: string
          max_attempts: number | null
          priority: number | null
          processing_started_at: string | null
          scheduled_at: string
          status: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          email_id?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          priority?: number | null
          processing_started_at?: string | null
          scheduled_at?: string
          status?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          email_id?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          priority?: number | null
          processing_started_at?: string | null
          scheduled_at?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_send_queue_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "outreach_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_sequences: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          current_step: number | null
          id: string
          lead_id: string | null
          next_email_at: string | null
          pause_reason: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          current_step?: number | null
          id?: string
          lead_id?: string | null
          next_email_at?: string | null
          pause_reason?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          current_step?: number | null
          id?: string
          lead_id?: string | null
          next_email_at?: string | null
          pause_reason?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_sequences_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "outreach_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_sequences_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "outreach_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          payload: Json | null
          processed: boolean | null
          stripe_event_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          processed?: boolean | null
          stripe_event_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          processed?: boolean | null
          stripe_event_id?: string | null
        }
        Relationships: []
      }
      payout_requests: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          currency: string | null
          failure_reason: string | null
          id: string
          placement_id: string | null
          processed_at: string | null
          recruiter_id: string
          status: string | null
          stripe_transfer_id: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          currency?: string | null
          failure_reason?: string | null
          id?: string
          placement_id?: string | null
          processed_at?: string | null
          recruiter_id: string
          status?: string | null
          stripe_transfer_id?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          currency?: string | null
          failure_reason?: string | null
          id?: string
          placement_id?: string | null
          processed_at?: string | null
          recruiter_id?: string
          status?: string | null
          stripe_transfer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_definitions: {
        Row: {
          category: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          description?: string | null
          id: string
          name: string
        }
        Update: {
          category?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      placements: {
        Row: {
          agreed_salary: number | null
          created_at: string
          escrow_release_date: string | null
          escrow_status: string | null
          id: string
          paid_at: string | null
          payment_status: string | null
          platform_fee: number | null
          recruiter_payout: number | null
          start_date: string | null
          submission_id: string
          total_fee: number | null
        }
        Insert: {
          agreed_salary?: number | null
          created_at?: string
          escrow_release_date?: string | null
          escrow_status?: string | null
          id?: string
          paid_at?: string | null
          payment_status?: string | null
          platform_fee?: number | null
          recruiter_payout?: number | null
          start_date?: string | null
          submission_id: string
          total_fee?: number | null
        }
        Update: {
          agreed_salary?: number | null
          created_at?: string
          escrow_release_date?: string | null
          escrow_status?: string | null
          id?: string
          paid_at?: string | null
          payment_status?: string | null
          platform_fee?: number | null
          recruiter_payout?: number | null
          start_date?: string | null
          submission_id?: string
          total_fee?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "placements_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "candidate_rankings"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "placements_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_events: {
        Row: {
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          response_time_seconds: number | null
          session_id: string | null
          user_agent: string | null
          user_id: string
          user_type: string | null
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          response_time_seconds?: number | null
          session_id?: string | null
          user_agent?: string | null
          user_id: string
          user_type?: string | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          response_time_seconds?: number | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string
          user_type?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bank_bic: string | null
          bank_iban: string | null
          company_address: string | null
          company_name: string | null
          company_voice: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          internal_notes: string | null
          phone: string | null
          placements_count: number | null
          professional_tone: string | null
          role_title: string | null
          tax_id: string | null
          updated_at: string
          user_id: string
          years_experience: number | null
        }
        Insert: {
          avatar_url?: string | null
          bank_bic?: string | null
          bank_iban?: string | null
          company_address?: string | null
          company_name?: string | null
          company_voice?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          internal_notes?: string | null
          phone?: string | null
          placements_count?: number | null
          professional_tone?: string | null
          role_title?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id: string
          years_experience?: number | null
        }
        Update: {
          avatar_url?: string | null
          bank_bic?: string | null
          bank_iban?: string | null
          company_address?: string | null
          company_name?: string | null
          company_voice?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          internal_notes?: string | null
          phone?: string | null
          placements_count?: number | null
          professional_tone?: string | null
          role_title?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id?: string
          years_experience?: number | null
        }
        Relationships: []
      }
      recruiter_documents: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          document_type: string
          document_url: string | null
          id: string
          is_accepted: boolean | null
          recruiter_id: string
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          document_type: string
          document_url?: string | null
          id?: string
          is_accepted?: boolean | null
          recruiter_id: string
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          document_type?: string
          document_url?: string | null
          id?: string
          is_accepted?: boolean | null
          recruiter_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      recruiter_influence_scores: {
        Row: {
          alerts_actioned: number | null
          alerts_ignored: number | null
          calculated_at: string | null
          candidate_satisfaction_score: number | null
          closing_speed_improvement: number | null
          created_at: string | null
          id: string
          influence_score: number | null
          opt_in_acceleration_rate: number | null
          playbooks_used: number | null
          recruiter_id: string
          show_rate_improvement: number | null
          total_influenced_placements: number | null
          updated_at: string | null
        }
        Insert: {
          alerts_actioned?: number | null
          alerts_ignored?: number | null
          calculated_at?: string | null
          candidate_satisfaction_score?: number | null
          closing_speed_improvement?: number | null
          created_at?: string | null
          id?: string
          influence_score?: number | null
          opt_in_acceleration_rate?: number | null
          playbooks_used?: number | null
          recruiter_id: string
          show_rate_improvement?: number | null
          total_influenced_placements?: number | null
          updated_at?: string | null
        }
        Update: {
          alerts_actioned?: number | null
          alerts_ignored?: number | null
          calculated_at?: string | null
          candidate_satisfaction_score?: number | null
          closing_speed_improvement?: number | null
          created_at?: string | null
          id?: string
          influence_score?: number | null
          opt_in_acceleration_rate?: number | null
          playbooks_used?: number | null
          recruiter_id?: string
          show_rate_improvement?: number | null
          total_influenced_placements?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      recruiter_leaderboard: {
        Row: {
          avg_candidate_score: number | null
          avg_time_to_fill: number | null
          calculated_at: string | null
          conversion_rate: number | null
          id: string
          period: string
          period_start: string
          placements: number | null
          rank_change: number | null
          rank_position: number | null
          recruiter_id: string
          submissions: number | null
          total_revenue: number | null
        }
        Insert: {
          avg_candidate_score?: number | null
          avg_time_to_fill?: number | null
          calculated_at?: string | null
          conversion_rate?: number | null
          id?: string
          period: string
          period_start: string
          placements?: number | null
          rank_change?: number | null
          rank_position?: number | null
          recruiter_id: string
          submissions?: number | null
          total_revenue?: number | null
        }
        Update: {
          avg_candidate_score?: number | null
          avg_time_to_fill?: number | null
          calculated_at?: string | null
          conversion_rate?: number | null
          id?: string
          period?: string
          period_start?: string
          placements?: number | null
          rank_change?: number | null
          rank_position?: number | null
          recruiter_id?: string
          submissions?: number | null
          total_revenue?: number | null
        }
        Relationships: []
      }
      recruiter_performance: {
        Row: {
          avg_response_time_hours: number | null
          calculated_at: string | null
          created_at: string | null
          id: string
          interview_rate: number | null
          placement_rate: number | null
          quality_score: number | null
          recruiter_id: string
          total_interviews: number | null
          total_placements: number | null
          total_submissions: number | null
          updated_at: string | null
        }
        Insert: {
          avg_response_time_hours?: number | null
          calculated_at?: string | null
          created_at?: string | null
          id?: string
          interview_rate?: number | null
          placement_rate?: number | null
          quality_score?: number | null
          recruiter_id: string
          total_interviews?: number | null
          total_placements?: number | null
          total_submissions?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_response_time_hours?: number | null
          calculated_at?: string | null
          created_at?: string | null
          id?: string
          interview_rate?: number | null
          placement_rate?: number | null
          quality_score?: number | null
          recruiter_id?: string
          total_interviews?: number | null
          total_placements?: number | null
          total_submissions?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      recruiter_pipelines: {
        Row: {
          created_at: string | null
          description: string | null
          filters: Json | null
          id: string
          is_default: boolean | null
          name: string
          recruiter_id: string
          sort_by: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          filters?: Json | null
          id?: string
          is_default?: boolean | null
          name: string
          recruiter_id: string
          sort_by?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          filters?: Json | null
          id?: string
          is_default?: boolean | null
          name?: string
          recruiter_id?: string
          sort_by?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      recruiter_tasks: {
        Row: {
          candidate_id: string | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_at: string | null
          id: string
          job_id: string | null
          priority: string | null
          recruiter_id: string
          reminder_at: string | null
          reminder_sent: boolean | null
          status: string | null
          submission_id: string | null
          task_type: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          candidate_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          job_id?: string | null
          priority?: string | null
          recruiter_id: string
          reminder_at?: string | null
          reminder_sent?: boolean | null
          status?: string | null
          submission_id?: string | null
          task_type?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          candidate_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          job_id?: string | null
          priority?: string | null
          recruiter_id?: string
          reminder_at?: string | null
          reminder_sent?: boolean | null
          status?: string | null
          submission_id?: string | null
          task_type?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recruiter_tasks_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "recruiter_tasks_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      recruiter_verifications: {
        Row: {
          company_name: string | null
          contract_signed: boolean | null
          contract_signed_at: string | null
          contract_version: string | null
          created_at: string | null
          digital_signature: string | null
          iban: string | null
          id: string
          info_acknowledged: boolean | null
          info_acknowledged_at: string | null
          nda_accepted: boolean | null
          nda_accepted_at: string | null
          nda_version: string | null
          profile_complete: boolean | null
          profile_completed_at: string | null
          recruiter_id: string
          rejection_reason: string | null
          tax_id: string | null
          terms_accepted: boolean | null
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string | null
          verification_status: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          company_name?: string | null
          contract_signed?: boolean | null
          contract_signed_at?: string | null
          contract_version?: string | null
          created_at?: string | null
          digital_signature?: string | null
          iban?: string | null
          id?: string
          info_acknowledged?: boolean | null
          info_acknowledged_at?: string | null
          nda_accepted?: boolean | null
          nda_accepted_at?: string | null
          nda_version?: string | null
          profile_complete?: boolean | null
          profile_completed_at?: string | null
          recruiter_id: string
          rejection_reason?: string | null
          tax_id?: string | null
          terms_accepted?: boolean | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string | null
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          company_name?: string | null
          contract_signed?: boolean | null
          contract_signed_at?: string | null
          contract_version?: string | null
          created_at?: string | null
          digital_signature?: string | null
          iban?: string | null
          id?: string
          info_acknowledged?: boolean | null
          info_acknowledged_at?: string | null
          nda_accepted?: boolean | null
          nda_accepted_at?: string | null
          nda_version?: string | null
          profile_complete?: boolean | null
          profile_completed_at?: string | null
          recruiter_id?: string
          rejection_reason?: string | null
          tax_id?: string | null
          terms_accepted?: boolean | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string | null
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      reference_requests: {
        Row: {
          access_token: string
          candidate_id: string
          created_at: string | null
          expires_at: string | null
          id: string
          reference_company: string | null
          reference_email: string
          reference_name: string
          reference_phone: string | null
          reference_position: string | null
          relationship: string | null
          reminder_sent_at: string | null
          requested_at: string | null
          requested_by: string
          responded_at: string | null
          status: string | null
          submission_id: string
        }
        Insert: {
          access_token: string
          candidate_id: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          reference_company?: string | null
          reference_email: string
          reference_name: string
          reference_phone?: string | null
          reference_position?: string | null
          relationship?: string | null
          reminder_sent_at?: string | null
          requested_at?: string | null
          requested_by: string
          responded_at?: string | null
          status?: string | null
          submission_id: string
        }
        Update: {
          access_token?: string
          candidate_id?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          reference_company?: string | null
          reference_email?: string
          reference_name?: string
          reference_phone?: string | null
          reference_position?: string | null
          relationship?: string | null
          reminder_sent_at?: string | null
          requested_at?: string | null
          requested_by?: string
          responded_at?: string | null
          status?: string | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_requests_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "reference_requests_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_responses: {
        Row: {
          additional_comments: string | null
          ai_risk_flags: Json | null
          ai_summary: string | null
          areas_for_improvement: string[] | null
          communication: number | null
          created_at: string | null
          id: string
          leadership: number | null
          notable_achievements: string | null
          overall_performance: number | null
          recommendation_level: string | null
          reliability: number | null
          request_id: string
          strengths: string[] | null
          teamwork: number | null
          technical_skills: number | null
          working_style: string | null
          would_rehire: boolean | null
        }
        Insert: {
          additional_comments?: string | null
          ai_risk_flags?: Json | null
          ai_summary?: string | null
          areas_for_improvement?: string[] | null
          communication?: number | null
          created_at?: string | null
          id?: string
          leadership?: number | null
          notable_achievements?: string | null
          overall_performance?: number | null
          recommendation_level?: string | null
          reliability?: number | null
          request_id: string
          strengths?: string[] | null
          teamwork?: number | null
          technical_skills?: number | null
          working_style?: string | null
          would_rehire?: boolean | null
        }
        Update: {
          additional_comments?: string | null
          ai_risk_flags?: Json | null
          ai_summary?: string | null
          areas_for_improvement?: string[] | null
          communication?: number | null
          created_at?: string | null
          id?: string
          leadership?: number | null
          notable_achievements?: string | null
          overall_performance?: number | null
          recommendation_level?: string | null
          reliability?: number | null
          request_id?: string
          strengths?: string[] | null
          teamwork?: number | null
          technical_skills?: number | null
          working_style?: string | null
          would_rehire?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reference_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "reference_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      rejection_templates: {
        Row: {
          body: string
          created_at: string | null
          id: string
          include_alternatives: boolean | null
          include_feedback: boolean | null
          is_active: boolean | null
          name: string
          reason_category: string | null
          stage: string
          subject: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          include_alternatives?: boolean | null
          include_feedback?: boolean | null
          is_active?: boolean | null
          name: string
          reason_category?: string | null
          stage: string
          subject: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          include_alternatives?: boolean | null
          include_feedback?: boolean | null
          is_active?: boolean | null
          name?: string
          reason_category?: string | null
          stage?: string
          subject?: string
        }
        Relationships: []
      }
      rejections: {
        Row: {
          ai_improvement_suggestions: Json | null
          created_at: string | null
          custom_feedback: string | null
          id: string
          reason_category: string | null
          rejected_by: string
          rejection_reason: string | null
          rejection_stage: string
          sent_at: string | null
          sent_via: string[] | null
          submission_id: string
          template_id: string | null
        }
        Insert: {
          ai_improvement_suggestions?: Json | null
          created_at?: string | null
          custom_feedback?: string | null
          id?: string
          reason_category?: string | null
          rejected_by: string
          rejection_reason?: string | null
          rejection_stage: string
          sent_at?: string | null
          sent_via?: string[] | null
          submission_id: string
          template_id?: string | null
        }
        Update: {
          ai_improvement_suggestions?: Json | null
          created_at?: string | null
          custom_feedback?: string | null
          id?: string
          reason_category?: string | null
          rejected_by?: string
          rejection_reason?: string | null
          rejection_stage?: string
          sent_at?: string | null
          sent_via?: string[] | null
          submission_id?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rejections_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "candidate_rankings"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "rejections_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rejections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "rejection_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      routing_cache: {
        Row: {
          cached_at: string | null
          dest_lat: number
          dest_lng: number
          distance_km: number | null
          duration_minutes: number
          expires_at: string | null
          id: string
          mode: string
          origin_lat: number
          origin_lng: number
        }
        Insert: {
          cached_at?: string | null
          dest_lat: number
          dest_lng: number
          distance_km?: number | null
          duration_minutes: number
          expires_at?: string | null
          id?: string
          mode?: string
          origin_lat: number
          origin_lng: number
        }
        Update: {
          cached_at?: string | null
          dest_lat?: number
          dest_lng?: number
          distance_km?: number | null
          duration_minutes?: number
          expires_at?: string | null
          id?: string
          mode?: string
          origin_lat?: number
          origin_lng?: number
        }
        Relationships: []
      }
      skill_taxonomy: {
        Row: {
          aliases: string[] | null
          canonical_name: string
          category: string | null
          created_at: string | null
          id: string
          parent_skill_id: string | null
          related_skills: string[] | null
          seniority_weight: number | null
          transferability_from: Json | null
          updated_at: string | null
        }
        Insert: {
          aliases?: string[] | null
          canonical_name: string
          category?: string | null
          created_at?: string | null
          id?: string
          parent_skill_id?: string | null
          related_skills?: string[] | null
          seniority_weight?: number | null
          transferability_from?: Json | null
          updated_at?: string | null
        }
        Update: {
          aliases?: string[] | null
          canonical_name?: string
          category?: string | null
          created_at?: string | null
          id?: string
          parent_skill_id?: string | null
          related_skills?: string[] | null
          seniority_weight?: number | null
          transferability_from?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skill_taxonomy_parent_skill_id_fkey"
            columns: ["parent_skill_id"]
            isOneToOne: false
            referencedRelation: "skill_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_deadlines: {
        Row: {
          breached_at: string | null
          completed_at: string | null
          created_at: string | null
          deadline_at: string
          entity_id: string
          entity_type: string
          id: string
          last_reminder_at: string | null
          reminders_sent: number | null
          responsible_user_id: string
          sla_rule_id: string | null
          started_at: string | null
          status: string | null
          warning_at: string | null
        }
        Insert: {
          breached_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          deadline_at: string
          entity_id: string
          entity_type: string
          id?: string
          last_reminder_at?: string | null
          reminders_sent?: number | null
          responsible_user_id: string
          sla_rule_id?: string | null
          started_at?: string | null
          status?: string | null
          warning_at?: string | null
        }
        Update: {
          breached_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          deadline_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          last_reminder_at?: string | null
          reminders_sent?: number | null
          responsible_user_id?: string
          sla_rule_id?: string | null
          started_at?: string | null
          status?: string | null
          warning_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sla_deadlines_sla_rule_id_fkey"
            columns: ["sla_rule_id"]
            isOneToOne: false
            referencedRelation: "sla_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_rules: {
        Row: {
          applicable_to: string | null
          created_at: string | null
          deadline_action: string | null
          deadline_hours: number
          entity_type: string
          escalate_to: string | null
          id: string
          is_active: boolean | null
          phase: string
          priority: number | null
          rule_name: string
          warning_action: string | null
          warning_hours: number | null
        }
        Insert: {
          applicable_to?: string | null
          created_at?: string | null
          deadline_action?: string | null
          deadline_hours: number
          entity_type: string
          escalate_to?: string | null
          id?: string
          is_active?: boolean | null
          phase: string
          priority?: number | null
          rule_name: string
          warning_action?: string | null
          warning_hours?: number | null
        }
        Update: {
          applicable_to?: string | null
          created_at?: string | null
          deadline_action?: string | null
          deadline_hours?: number
          entity_type?: string
          escalate_to?: string | null
          id?: string
          is_active?: boolean | null
          phase?: string
          priority?: number | null
          rule_name?: string
          warning_action?: string | null
          warning_hours?: number | null
        }
        Relationships: []
      }
      stripe_accounts: {
        Row: {
          account_type: string | null
          charges_enabled: boolean | null
          created_at: string | null
          details_submitted: boolean | null
          id: string
          onboarding_complete: boolean | null
          payouts_enabled: boolean | null
          stripe_account_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_type?: string | null
          charges_enabled?: boolean | null
          created_at?: string | null
          details_submitted?: boolean | null
          id?: string
          onboarding_complete?: boolean | null
          payouts_enabled?: boolean | null
          stripe_account_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_type?: string | null
          charges_enabled?: boolean | null
          created_at?: string | null
          details_submitted?: boolean | null
          id?: string
          onboarding_complete?: boolean | null
          payouts_enabled?: boolean | null
          stripe_account_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          candidate_id: string
          client_notes: string | null
          consent_confirmed: boolean | null
          consent_confirmed_at: string | null
          consent_document_url: string | null
          id: string
          identity_unlocked: boolean | null
          job_id: string
          match_score: number | null
          opt_in_requested_at: string | null
          opt_in_response: string | null
          recruiter_id: string
          recruiter_notes: string | null
          rejection_reason: string | null
          stage: string | null
          status: string | null
          submitted_at: string
          unlocked_at: string | null
          unlocked_by: string | null
          updated_at: string
        }
        Insert: {
          candidate_id: string
          client_notes?: string | null
          consent_confirmed?: boolean | null
          consent_confirmed_at?: string | null
          consent_document_url?: string | null
          id?: string
          identity_unlocked?: boolean | null
          job_id: string
          match_score?: number | null
          opt_in_requested_at?: string | null
          opt_in_response?: string | null
          recruiter_id: string
          recruiter_notes?: string | null
          rejection_reason?: string | null
          stage?: string | null
          status?: string | null
          submitted_at?: string
          unlocked_at?: string | null
          unlocked_by?: string | null
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          client_notes?: string | null
          consent_confirmed?: boolean | null
          consent_confirmed_at?: string | null
          consent_document_url?: string | null
          id?: string
          identity_unlocked?: boolean | null
          job_id?: string
          match_score?: number | null
          opt_in_requested_at?: string | null
          opt_in_response?: string | null
          recruiter_id?: string
          recruiter_notes?: string | null
          rejection_reason?: string | null
          stage?: string | null
          status?: string | null
          submitted_at?: string
          unlocked_at?: string | null
          unlocked_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "submissions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_alerts: {
        Row: {
          created_at: string | null
          id: string
          job_id: string
          match_reasons: Json | null
          match_score: number | null
          status: string | null
          talent_pool_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id: string
          match_reasons?: Json | null
          match_score?: number | null
          status?: string | null
          talent_pool_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string
          match_reasons?: Json | null
          match_score?: number | null
          status?: string | null
          talent_pool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_alerts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_alerts_talent_pool_id_fkey"
            columns: ["talent_pool_id"]
            isOneToOne: false
            referencedRelation: "talent_pool"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_pool: {
        Row: {
          added_reason: string | null
          availability: string | null
          candidate_id: string
          contact_frequency: string | null
          created_at: string | null
          experience_years: number | null
          id: string
          is_active: boolean | null
          last_contacted_at: string | null
          next_contact_at: string | null
          notes: string | null
          opted_out_at: string | null
          pool_type: string | null
          preferred_locations: string[] | null
          preferred_roles: string[] | null
          recruiter_id: string
          salary_expectation_max: number | null
          salary_expectation_min: number | null
          skills_snapshot: Json | null
          source_submission_id: string | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          added_reason?: string | null
          availability?: string | null
          candidate_id: string
          contact_frequency?: string | null
          created_at?: string | null
          experience_years?: number | null
          id?: string
          is_active?: boolean | null
          last_contacted_at?: string | null
          next_contact_at?: string | null
          notes?: string | null
          opted_out_at?: string | null
          pool_type?: string | null
          preferred_locations?: string[] | null
          preferred_roles?: string[] | null
          recruiter_id: string
          salary_expectation_max?: number | null
          salary_expectation_min?: number | null
          skills_snapshot?: Json | null
          source_submission_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          added_reason?: string | null
          availability?: string | null
          candidate_id?: string
          contact_frequency?: string | null
          created_at?: string | null
          experience_years?: number | null
          id?: string
          is_active?: boolean | null
          last_contacted_at?: string | null
          next_contact_at?: string | null
          notes?: string | null
          opted_out_at?: string | null
          pool_type?: string | null
          preferred_locations?: string[] | null
          preferred_roles?: string[] | null
          recruiter_id?: string
          salary_expectation_max?: number | null
          salary_expectation_min?: number | null
          skills_snapshot?: Json | null
          source_submission_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "talent_pool_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "talent_pool_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_behavior_scores: {
        Row: {
          avg_response_time_hours: number | null
          behavior_class: string | null
          calculated_at: string | null
          created_at: string | null
          ghost_rate: number | null
          id: string
          interview_show_rate: number | null
          response_count: number | null
          risk_score: number | null
          sla_compliance_rate: number | null
          updated_at: string | null
          user_id: string
          user_type: string
        }
        Insert: {
          avg_response_time_hours?: number | null
          behavior_class?: string | null
          calculated_at?: string | null
          created_at?: string | null
          ghost_rate?: number | null
          id?: string
          interview_show_rate?: number | null
          response_count?: number | null
          risk_score?: number | null
          sla_compliance_rate?: number | null
          updated_at?: string | null
          user_id: string
          user_type: string
        }
        Update: {
          avg_response_time_hours?: number | null
          behavior_class?: string | null
          calculated_at?: string | null
          created_at?: string | null
          ghost_rate?: number | null
          id?: string
          interview_show_rate?: number | null
          response_count?: number | null
          risk_score?: number | null
          sla_compliance_rate?: number | null
          updated_at?: string | null
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          custom_fee_percentage: number | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string | null
          suspended_at: string | null
          suspension_reason: string | null
          user_id: string
          verified: boolean | null
        }
        Insert: {
          created_at?: string
          custom_fee_percentage?: number | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          user_id: string
          verified?: boolean | null
        }
        Update: {
          created_at?: string
          custom_fee_percentage?: number | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          user_id?: string
          verified?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      candidate_job_overview: {
        Row: {
          active_submissions: number | null
          candidate_id: string | null
          email: string | null
          full_name: string | null
          jobs: Json | null
          preferred_channel: string | null
          recruiter_id: string | null
          total_submissions: number | null
        }
        Relationships: []
      }
      candidate_rankings: {
        Row: {
          candidate_id: string | null
          closing_probability: number | null
          confidence_score: number | null
          engagement_level: string | null
          full_name: string | null
          interview_readiness_score: number | null
          job_id: string | null
          match_score: number | null
          overall_rank_score: number | null
          rank_position: number | null
          status: string | null
          submission_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_job_overview"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "submissions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "client" | "recruiter" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["client", "recruiter", "admin"],
    },
  },
} as const
