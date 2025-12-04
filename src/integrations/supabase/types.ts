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
            referencedRelation: "submissions"
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
          recruiter_id: string
          skills: string[] | null
          summary: string | null
          updated_at: string
          video_url: string | null
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
          recruiter_id: string
          skills?: string[] | null
          summary?: string | null
          updated_at?: string
          video_url?: string | null
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
          recruiter_id?: string
          skills?: string[] | null
          summary?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
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
          subject_id?: string
          subject_type?: string
          user_agent?: string | null
          version?: string
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
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          created_at: string
          duration_minutes: number | null
          feedback: string | null
          id: string
          meeting_link: string | null
          meeting_type: string | null
          notes: string | null
          scheduled_at: string | null
          status: string | null
          submission_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          feedback?: string | null
          id?: string
          meeting_link?: string | null
          meeting_type?: string | null
          notes?: string | null
          scheduled_at?: string | null
          status?: string | null
          submission_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          feedback?: string | null
          id?: string
          meeting_link?: string | null
          meeting_type?: string | null
          notes?: string | null
          scheduled_at?: string | null
          status?: string | null
          submission_id?: string
          updated_at?: string
        }
        Relationships: [
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
          due_date: string | null
          id: string
          invoice_number: string
          paid_at: string | null
          pdf_url: string | null
          placement_id: string
          status: string | null
          tax_amount: number | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          paid_at?: string | null
          pdf_url?: string | null
          placement_id: string
          status?: string | null
          tax_amount?: number | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          paid_at?: string | null
          pdf_url?: string | null
          placement_id?: string
          status?: string | null
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
      placements: {
        Row: {
          agreed_salary: number | null
          created_at: string
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
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
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
      [_ in never]: never
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
