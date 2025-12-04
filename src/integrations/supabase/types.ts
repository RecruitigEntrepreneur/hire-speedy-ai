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
      candidate_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          submission_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          submission_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          submission_id?: string
          updated_at?: string
          user_id?: string
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
      candidates: {
        Row: {
          availability_date: string | null
          created_at: string
          current_salary: number | null
          cv_url: string | null
          email: string
          expected_salary: number | null
          experience_years: number | null
          full_name: string
          id: string
          linkedin_url: string | null
          notice_period: string | null
          phone: string | null
          phone_verified: boolean | null
          preferred_channel: string | null
          recruiter_id: string
          skills: string[] | null
          sms_opt_in: boolean | null
          summary: string | null
          updated_at: string
          video_url: string | null
          whatsapp_opt_in: boolean | null
        }
        Insert: {
          availability_date?: string | null
          created_at?: string
          current_salary?: number | null
          cv_url?: string | null
          email: string
          expected_salary?: number | null
          experience_years?: number | null
          full_name: string
          id?: string
          linkedin_url?: string | null
          notice_period?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          preferred_channel?: string | null
          recruiter_id: string
          skills?: string[] | null
          sms_opt_in?: boolean | null
          summary?: string | null
          updated_at?: string
          video_url?: string | null
          whatsapp_opt_in?: boolean | null
        }
        Update: {
          availability_date?: string | null
          created_at?: string
          current_salary?: number | null
          cv_url?: string | null
          email?: string
          expected_salary?: number | null
          experience_years?: number | null
          full_name?: string
          id?: string
          linkedin_url?: string | null
          notice_period?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          preferred_channel?: string | null
          recruiter_id?: string
          skills?: string[] | null
          sms_opt_in?: boolean | null
          summary?: string | null
          updated_at?: string
          video_url?: string | null
          whatsapp_opt_in?: boolean | null
        }
        Relationships: []
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
      company_profiles: {
        Row: {
          address: string | null
          billing_email: string | null
          company_name: string
          created_at: string
          description: string | null
          id: string
          industry: string | null
          logo_url: string | null
          tax_id: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          billing_email?: string | null
          company_name: string
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          billing_email?: string | null
          company_name?: string
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
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
          client_id: string
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
          paused_at: string | null
          recruiter_fee_percentage: number | null
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
          client_id: string
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
          paused_at?: string | null
          recruiter_fee_percentage?: number | null
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
          client_id?: string
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
          paused_at?: string | null
          recruiter_fee_percentage?: number | null
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
          created_at: string
          email: string
          full_name: string | null
          id: string
          internal_notes: string | null
          phone: string | null
          tax_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bank_bic?: string | null
          bank_iban?: string | null
          company_address?: string | null
          company_name?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          internal_notes?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bank_bic?: string | null
          bank_iban?: string | null
          company_address?: string | null
          company_name?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          internal_notes?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id?: string
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
