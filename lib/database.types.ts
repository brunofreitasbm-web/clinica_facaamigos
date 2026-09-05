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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      aba_abc_logs: {
        Row: {
          id: string
          appointment_id: string
          patient_id: string
          therapist_id: string
          antecedent: string
          behavior_description: string
          consequence: string
          intensity: string | null
          duration_seconds: number | null
          recorded_at: string
        }
        Insert: {
          id?: string
          appointment_id: string
          patient_id: string
          therapist_id: string
          antecedent: string
          behavior_description: string
          consequence: string
          intensity?: string | null
          duration_seconds?: number | null
          recorded_at?: string
        }
        Update: {
          id?: string
          appointment_id?: string
          patient_id?: string
          therapist_id?: string
          antecedent?: string
          behavior_description?: string
          consequence?: string
          intensity?: string | null
          duration_seconds?: number | null
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aba_abc_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aba_abc_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aba_abc_logs_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      absence_reports: {
        Row: {
          appointment_id: string
          attachment_storage_path: string | null
          created_at: string
          id: string
          reason_category: string
          reason_text: string | null
          reported_by: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          appointment_id: string
          attachment_storage_path?: string | null
          created_at?: string
          id?: string
          reason_category: string
          reason_text?: string | null
          reported_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          appointment_id?: string
          attachment_storage_path?: string | null
          created_at?: string
          id?: string
          reason_category?: string
          reason_text?: string | null
          reported_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_reports_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_reports_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          attendance_started_at: string | null
          authorization_id: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          checkin_at: string | null
          checkout_at: string | null
          confirmed_at: string | null
          confirmed_via: string | null
          discipline: string
          ends_at: string
          group_id: string | null
          id: string
          is_evaluation: boolean
          is_provisional: boolean
          modality: string
          patient_id: string
          recurrence_id: string | null
          room_id: string
          starts_at: string
          status: string
          therapist_id: string
        }
        Insert: {
          attendance_started_at?: string | null
          authorization_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          checkin_at?: string | null
          checkout_at?: string | null
          confirmed_at?: string | null
          confirmed_via?: string | null
          discipline: string
          ends_at: string
          group_id?: string | null
          id?: string
          is_evaluation?: boolean
          is_provisional?: boolean
          modality?: string
          patient_id: string
          recurrence_id?: string | null
          room_id: string
          starts_at: string
          status?: string
          therapist_id: string
        }
        Update: {
          attendance_started_at?: string | null
          authorization_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          checkin_at?: string | null
          checkout_at?: string | null
          confirmed_at?: string | null
          confirmed_via?: string | null
          discipline?: string
          ends_at?: string
          group_id?: string | null
          id?: string
          is_evaluation?: boolean
          is_provisional?: boolean
          modality?: string
          patient_id?: string
          recurrence_id?: string | null
          room_id?: string
          starts_at?: string
          status?: string
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_authorization_id_fkey"
            columns: ["authorization_id"]
            isOneToOne: false
            referencedRelation: "authorizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          at: string
          before: Json | null
          clinic_id: string | null
          id: string
          row_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          clinic_id?: string | null
          id?: string
          row_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          clinic_id?: string | null
          id?: string
          row_id?: string
          table_name?: string
        }
        Relationships: []
      }
      authorizations: {
        Row: {
          approved_at: string | null
          document_id: string | null
          guide_number: string | null
          id: string
          patient_insurance_id: string
          previous_authorization_id: string | null
          procedure_code: string
          requested_at: string | null
          sessions_authorized: number
          sessions_used: number
          status: string
          valid_from: string
          valid_to: string
        }
        Insert: {
          approved_at?: string | null
          document_id?: string | null
          guide_number?: string | null
          id?: string
          patient_insurance_id: string
          previous_authorization_id?: string | null
          procedure_code: string
          requested_at?: string | null
          sessions_authorized: number
          sessions_used?: number
          status?: string
          valid_from: string
          valid_to: string
        }
        Update: {
          approved_at?: string | null
          document_id?: string | null
          guide_number?: string | null
          id?: string
          patient_insurance_id?: string
          previous_authorization_id?: string | null
          procedure_code?: string
          requested_at?: string | null
          sessions_authorized?: number
          sessions_used?: number
          status?: string
          valid_from?: string
          valid_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "authorizations_patient_insurance_id_fkey"
            columns: ["patient_insurance_id"]
            isOneToOne: false
            referencedRelation: "patient_insurance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorizations_previous_authorization_id_fkey"
            columns: ["previous_authorization_id"]
            isOneToOne: false
            referencedRelation: "authorizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_items: {
        Row: {
          amount: number
          appointment_id: string
          billing_period_id: string
          id: string
          paid_at: string | null
          procedure_code: string
          status: string
        }
        Insert: {
          amount: number
          appointment_id: string
          billing_period_id: string
          id?: string
          paid_at?: string | null
          procedure_code: string
          status?: string
        }
        Update: {
          amount?: number
          appointment_id?: string
          billing_period_id?: string
          id?: string
          paid_at?: string | null
          procedure_code?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_items_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_items_billing_period_id_fkey"
            columns: ["billing_period_id"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_periods: {
        Row: {
          competence_month: string
          exported_at: string | null
          exported_file_id: string | null
          id: string
          insurer_id: string
          status: string
        }
        Insert: {
          competence_month: string
          exported_at?: string | null
          exported_file_id?: string | null
          id?: string
          insurer_id: string
          status?: string
        }
        Update: {
          competence_month?: string
          exported_at?: string | null
          exported_file_id?: string | null
          id?: string
          insurer_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_periods_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          cnpj: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      document_contents: {
        Row: {
          content: string
          created_at: string | null
          doc_key: string
          intern_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          doc_key: string
          intern_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          doc_key?: string
          intern_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_contents_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "interns"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          id: string
          patient_id: string
          shared_with_family: boolean
          storage_path: string
          uploaded_at: string
          uploaded_by: string
          valid_until: string | null
        }
        Insert: {
          category: string
          id?: string
          patient_id: string
          shared_with_family?: boolean
          storage_path: string
          uploaded_at?: string
          uploaded_by: string
          valid_until?: string | null
        }
        Update: {
          category?: string
          id?: string
          patient_id?: string
          shared_with_family?: boolean
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_taxonomy: {
        Row: {
          clinic_id: string
          description: string | null
          discipline: string
          domain: string
          id: string
        }
        Insert: {
          clinic_id: string
          description?: string | null
          discipline: string
          domain: string
          id?: string
        }
        Update: {
          clinic_id?: string
          description?: string | null
          discipline?: string
          domain?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_taxonomy_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_reports: {
        Row: {
          ai_draft: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          final_text: string | null
          generated_by: string
          id: string
          patient_id: string
          period_end: string
          period_start: string
          status: string
        }
        Insert: {
          ai_draft?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          final_text?: string | null
          generated_by: string
          id?: string
          patient_id: string
          period_end: string
          period_start: string
          status?: string
        }
        Update: {
          ai_draft?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          final_text?: string | null
          generated_by?: string
          id?: string
          patient_id?: string
          period_end?: string
          period_start?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_reports_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_reports_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_media: {
        Row: {
          created_at: string
          id: string
          mime_type: string
          post_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type: string
          post_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string
          post_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          author_id: string
          body: string | null
          created_at: string
          id: string
          patient_id: string
        }
        Insert: {
          author_id: string
          body?: string | null
          created_at?: string
          id?: string
          patient_id: string
        }
        Update: {
          author_id?: string
          body?: string | null
          created_at?: string
          id?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_posts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      glosas: {
        Row: {
          amount: number
          appealed_at: string | null
          attributable_profile_id: string | null
          attributable_to: string
          billing_item_id: string
          id: string
          reason_code: string
          reason_text: string | null
          recovered_amount: number | null
        }
        Insert: {
          amount: number
          appealed_at?: string | null
          attributable_profile_id?: string | null
          attributable_to: string
          billing_item_id: string
          id?: string
          reason_code: string
          reason_text?: string | null
          recovered_amount?: number | null
        }
        Update: {
          amount?: number
          appealed_at?: string | null
          attributable_profile_id?: string | null
          attributable_to?: string
          billing_item_id?: string
          id?: string
          reason_code?: string
          reason_text?: string | null
          recovered_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "glosas_attributable_profile_id_fkey"
            columns: ["attributable_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "glosas_billing_item_id_fkey"
            columns: ["billing_item_id"]
            isOneToOne: false
            referencedRelation: "billing_items"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          cpf: string | null
          email: string | null
          full_name: string
          id: string
          is_emergency_contact: boolean
          is_financial: boolean
          patient_id: string
          phone: string
          portal_enabled: boolean
          profile_id: string | null
          relationship: string | null
        }
        Insert: {
          cpf?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_emergency_contact?: boolean
          is_financial?: boolean
          patient_id: string
          phone: string
          portal_enabled?: boolean
          profile_id?: string | null
          relationship?: string | null
        }
        Update: {
          cpf?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_emergency_contact?: boolean
          is_financial?: boolean
          patient_id?: string
          phone?: string
          portal_enabled?: boolean
          profile_id?: string | null
          relationship?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guardians_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardians_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      insurer_price_tables: {
        Row: {
          id: string
          insurer_id: string
          price: number
          procedure_code: string
          procedure_name: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          id?: string
          insurer_id: string
          price: number
          procedure_code: string
          procedure_name: string
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          id?: string
          insurer_id?: string
          price?: number
          procedure_code?: string
          procedure_name?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insurer_price_tables_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
        ]
      }
      insurers: {
        Row: {
          ans_code: string | null
          billing_rules: Json
          clinic_id: string
          id: string
          name: string
        }
        Insert: {
          ans_code?: string | null
          billing_rules?: Json
          clinic_id: string
          id?: string
          name: string
        }
        Update: {
          ans_code?: string | null
          billing_rules?: Json
          clinic_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      interns: {
        Row: {
          active: boolean | null
          address: string | null
          allowance: number | null
          bank_account: string | null
          bank_agency: string | null
          bank_name: string | null
          birthdate: string | null
          contract_termination: Json | null
          course: string | null
          cpf: string | null
          created_at: string | null
          daily_hours: number | null
          documents: Json | null
          email: string | null
          emergency_name: string | null
          emergency_phone: string | null
          emergency_relationship: string | null
          end_date: string | null
          face_descriptor: string | null
          id: string
          institution: string | null
          is_first_login: boolean | null
          last_report_date: string | null
          name: string
          phone: string | null
          photo: string | null
          pix_key: string | null
          recess_days_taken: number | null
          registration_status: string | null
          rg: string | null
          semestral_reports: Json | null
          shift: string | null
          start_date: string | null
          supervisor_name: string | null
          unit_id: string | null
          username: string
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          allowance?: number | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          birthdate?: string | null
          contract_termination?: Json | null
          course?: string | null
          cpf?: string | null
          created_at?: string | null
          daily_hours?: number | null
          documents?: Json | null
          email?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          emergency_relationship?: string | null
          end_date?: string | null
          face_descriptor?: string | null
          id?: string
          institution?: string | null
          is_first_login?: boolean | null
          last_report_date?: string | null
          name: string
          phone?: string | null
          photo?: string | null
          pix_key?: string | null
          recess_days_taken?: number | null
          registration_status?: string | null
          rg?: string | null
          semestral_reports?: Json | null
          shift?: string | null
          start_date?: string | null
          supervisor_name?: string | null
          unit_id?: string | null
          username: string
        }
        Update: {
          active?: boolean | null
          address?: string | null
          allowance?: number | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          birthdate?: string | null
          contract_termination?: Json | null
          course?: string | null
          cpf?: string | null
          created_at?: string | null
          daily_hours?: number | null
          documents?: Json | null
          email?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          emergency_relationship?: string | null
          end_date?: string | null
          face_descriptor?: string | null
          id?: string
          institution?: string | null
          is_first_login?: boolean | null
          last_report_date?: string | null
          name?: string
          phone?: string | null
          photo?: string | null
          pix_key?: string | null
          recess_days_taken?: number | null
          registration_status?: string | null
          rg?: string | null
          semestral_reports?: Json | null
          shift?: string | null
          start_date?: string | null
          supervisor_name?: string | null
          unit_id?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "interns_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          channel: string
          delivered_at: string | null
          direction: string
          guardian_id: string | null
          id: string
          patient_id: string
          read_at: string | null
          related_appointment_id: string | null
          sent_at: string | null
          template_key: string | null
        }
        Insert: {
          body?: string | null
          channel: string
          delivered_at?: string | null
          direction: string
          guardian_id?: string | null
          id?: string
          patient_id: string
          read_at?: string | null
          related_appointment_id?: string | null
          sent_at?: string | null
          template_key?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          delivered_at?: string | null
          direction?: string
          guardian_id?: string | null
          id?: string
          patient_id?: string
          read_at?: string | null
          related_appointment_id?: string | null
          sent_at?: string | null
          template_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_related_appointment_id_fkey"
            columns: ["related_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_snapshots: {
        Row: {
          computed_at: string
          id: string
          metric_key: string
          period_end: string
          period_start: string
          scope_id: string | null
          scope_type: string
          value: number
        }
        Insert: {
          computed_at?: string
          id?: string
          metric_key: string
          period_end: string
          period_start: string
          scope_id?: string | null
          scope_type: string
          value: number
        }
        Update: {
          computed_at?: string
          id?: string
          metric_key?: string
          period_end?: string
          period_start?: string
          scope_id?: string | null
          scope_type?: string
          value?: number
        }
        Relationships: []
      }
      patient_access: {
        Row: {
          access_type: string
          granted_at: string
          granted_by: string | null
          id: string
          patient_id: string
          profile_id: string
          revoked_at: string | null
        }
        Insert: {
          access_type: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          patient_id: string
          profile_id: string
          revoked_at?: string | null
        }
        Update: {
          access_type?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          patient_id?: string
          profile_id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_access_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_access_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_insurance: {
        Row: {
          card_number: string | null
          card_valid_until: string | null
          id: string
          insurer_id: string | null
          is_private: boolean
          patient_id: string
          plan_name: string | null
        }
        Insert: {
          card_number?: string | null
          card_valid_until?: string | null
          id?: string
          insurer_id?: string | null
          is_private?: boolean
          patient_id: string
          plan_name?: string | null
        }
        Update: {
          card_number?: string | null
          card_valid_until?: string | null
          id?: string
          insurer_id?: string | null
          is_private?: boolean
          patient_id?: string
          plan_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_insurance_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_insurance_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          birth_date: string
          cid: string | null
          clinic_id: string
          complaint: string | null
          created_at: string
          created_by: string | null
          entry_source: string | null
          evaluated_at: string | null
          first_contact_at: string | null
          first_session_at: string | null
          full_name: string
          id: string
          status: string
          support_level: string | null
        }
        Insert: {
          birth_date: string
          cid?: string | null
          clinic_id: string
          complaint?: string | null
          created_at?: string
          created_by?: string | null
          entry_source?: string | null
          evaluated_at?: string | null
          first_contact_at?: string | null
          first_session_at?: string | null
          full_name: string
          id?: string
          status?: string
          support_level?: string | null
        }
        Update: {
          birth_date?: string
          cid?: string | null
          clinic_id?: string
          complaint?: string | null
          created_at?: string
          created_by?: string | null
          entry_source?: string | null
          evaluated_at?: string | null
          first_contact_at?: string | null
          first_session_at?: string | null
          full_name?: string
          id?: string
          status?: string
          support_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_items: {
        Row: {
          appointment_id: string
          id: string
          payout_id: string
          rate_applied: number
        }
        Insert: {
          appointment_id: string
          id?: string
          payout_id: string
          rate_applied: number
        }
        Update: {
          appointment_id?: string
          id?: string
          payout_id?: string
          rate_applied?: number
        }
        Relationships: [
          {
            foreignKeyName: "payout_items_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_items_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          adjustments: number
          competence_month: string
          gross_amount: number
          id: string
          sessions_count: number
          status: string
          therapist_id: string
        }
        Insert: {
          adjustments?: number
          competence_month: string
          gross_amount?: number
          id?: string
          sessions_count?: number
          status?: string
          therapist_id: string
        }
        Update: {
          adjustments?: number
          competence_month?: string
          gross_amount?: number
          id?: string
          sessions_count?: number
          status?: string
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_goals: {
        Row: {
          achieved_at: string | null
          baseline: string | null
          criterion: string | null
          description: string
          discipline: string
          domain: string
          id: string
          status: string
          target: string | null
          treatment_plan_id: string
          validated_by: string | null
        }
        Insert: {
          achieved_at?: string | null
          baseline?: string | null
          criterion?: string | null
          description: string
          discipline: string
          domain: string
          id?: string
          status?: string
          target?: string | null
          treatment_plan_id: string
          validated_by?: string | null
        }
        Update: {
          achieved_at?: string | null
          baseline?: string | null
          criterion?: string | null
          description?: string
          discipline?: string
          domain?: string
          id?: string
          status?: string
          target?: string | null
          treatment_plan_id?: string
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_goals_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_goals_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          clinic_id: string
          council_number: string | null
          council_type: string | null
          created_at: string
          esdm_certified: boolean
          full_name: string
          id: string
          phone: string | null
          role: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          council_number?: string | null
          council_type?: string | null
          created_at?: string
          esdm_certified?: boolean
          full_name: string
          id: string
          phone?: string | null
          role: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          council_number?: string | null
          council_type?: string | null
          created_at?: string
          esdm_certified?: boolean
          full_name?: string
          id?: string
          phone?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          domain_taxonomy_id: string | null
          id: string
          mastery_criterion: string | null
          name: string
          plan_goal_id: string
          protocol_item_id: string | null
          target_type: string
        }
        Insert: {
          domain_taxonomy_id?: string | null
          id?: string
          mastery_criterion?: string | null
          name: string
          plan_goal_id: string
          protocol_item_id?: string | null
          target_type: string
        }
        Update: {
          domain_taxonomy_id?: string | null
          id?: string
          mastery_criterion?: string | null
          name?: string
          plan_goal_id?: string
          protocol_item_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_domain_taxonomy_id_fkey"
            columns: ["domain_taxonomy_id"]
            isOneToOne: false
            referencedRelation: "domain_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_plan_goal_id_fkey"
            columns: ["plan_goal_id"]
            isOneToOne: false
            referencedRelation: "plan_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_protocol_item_id_fkey"
            columns: ["protocol_item_id"]
            isOneToOne: false
            referencedRelation: "protocol_items"
            referencedColumns: ["id"]
          },
        ]
      }
      protocol_assessments: {
        Row: {
          assessed_at: string
          assessed_by: string
          id: string
          patient_id: string
          protocol_id: string
          scores: Json
        }
        Insert: {
          assessed_at?: string
          assessed_by: string
          id?: string
          patient_id: string
          protocol_id: string
          scores?: Json
        }
        Update: {
          assessed_at?: string
          assessed_by?: string
          id?: string
          patient_id?: string
          protocol_id?: string
          scores?: Json
        }
        Relationships: [
          {
            foreignKeyName: "protocol_assessments_assessed_by_fkey"
            columns: ["assessed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocol_assessments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocol_assessments_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      protocol_items: {
        Row: {
          description: string
          domain: string
          id: string
          item_code: string
          level: string | null
          protocol_id: string
        }
        Insert: {
          description: string
          domain: string
          id?: string
          item_code: string
          level?: string | null
          protocol_id: string
        }
        Update: {
          description?: string
          domain?: string
          id?: string
          item_code?: string
          level?: string | null
          protocol_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocol_items_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      protocols: {
        Row: {
          clinic_id: string
          digitization_risk_accepted_at: string
          digitization_risk_accepted_by: string
          id: string
          license_note: string | null
          license_purchased_at: string | null
          name: string
          version: string | null
        }
        Insert: {
          clinic_id: string
          digitization_risk_accepted_at: string
          digitization_risk_accepted_by: string
          id?: string
          license_note?: string | null
          license_purchased_at?: string | null
          name: string
          version?: string | null
        }
        Update: {
          clinic_id?: string
          digitization_risk_accepted_at?: string
          digitization_risk_accepted_by?: string
          id?: string
          license_note?: string | null
          license_purchased_at?: string | null
          name?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "protocols_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocols_digitization_risk_accepted_by_fkey"
            columns: ["digitization_risk_accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reassessment_alerts: {
        Row: {
          alert_window_days: number
          created_at: string
          due_date: string
          id: string
          patient_id: string
          status: string
        }
        Insert: {
          alert_window_days?: number
          created_at?: string
          due_date: string
          id?: string
          patient_id: string
          status?: string
        }
        Update: {
          alert_window_days?: number
          created_at?: string
          due_date?: string
          id?: string
          patient_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reassessment_alerts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      record_access_log: {
        Row: {
          accessed_at: string
          accessed_by: string
          id: string
          patient_id: string
          reason: string | null
        }
        Insert: {
          accessed_at?: string
          accessed_by: string
          id?: string
          patient_id: string
          reason?: string | null
        }
        Update: {
          accessed_at?: string
          accessed_by?: string
          id?: string
          patient_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "record_access_log_accessed_by_fkey"
            columns: ["accessed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_access_log_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      records: {
        Row: {
          action: string
          created_at: string | null
          days_away: number | null
          geo: Json | null
          id: string
          intern_id: string | null
          intern_name: string | null
          is_manual: boolean | null
          justification: string | null
          justification_doc: Json | null
          photo: string | null
          timestamp: string
          unit_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          days_away?: number | null
          geo?: Json | null
          id?: string
          intern_id?: string | null
          intern_name?: string | null
          is_manual?: boolean | null
          justification?: string | null
          justification_doc?: Json | null
          photo?: string | null
          timestamp?: string
          unit_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          days_away?: number | null
          geo?: Json | null
          id?: string
          intern_id?: string | null
          intern_name?: string | null
          is_manual?: boolean | null
          justification?: string | null
          justification_doc?: Json | null
          photo?: string | null
          timestamp?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "records_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "interns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "records_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_bookings: {
        Row: {
          appointment_id: string | null
          booked_by: string
          ends_at: string
          id: string
          resource_id: string
          starts_at: string
          status: string
        }
        Insert: {
          appointment_id?: string | null
          booked_by: string
          ends_at: string
          id?: string
          resource_id: string
          starts_at: string
          status?: string
        }
        Update: {
          appointment_id?: string | null
          booked_by?: string
          ends_at?: string
          id?: string
          resource_id?: string
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_bookings_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_bookings_booked_by_fkey"
            columns: ["booked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_bookings_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          category: string
          clinic_id: string
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          category: string
          clinic_id: string
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          category?: string
          clinic_id?: string
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          capacity: number
          clinic_id: string
          id: string
          name: string
        }
        Insert: {
          capacity?: number
          clinic_id: string
          id?: string
          name: string
        }
        Update: {
          capacity?: number
          clinic_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      session_notes: {
        Row: {
          appointment_id: string
          created_at_device: string
          created_at_server: string
          free_text: string | null
          id: string
          signed_at: string | null
          structured: Json
          supersedes_id: string | null
          therapist_id: string
          version: number
        }
        Insert: {
          appointment_id: string
          created_at_device: string
          created_at_server?: string
          free_text?: string | null
          id?: string
          signed_at?: string | null
          structured?: Json
          supersedes_id?: string | null
          therapist_id: string
          version?: number
        }
        Update: {
          appointment_id?: string
          created_at_device?: string
          created_at_server?: string
          free_text?: string | null
          id?: string
          signed_at?: string | null
          structured?: Json
          supersedes_id?: string | null
          therapist_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_notes_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "session_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          answers: Json
          guardian_id: string
          id: string
          nps_score: number | null
          patient_id: string
          period: string
          submitted_at: string
        }
        Insert: {
          answers?: Json
          guardian_id: string
          id?: string
          nps_score?: number | null
          patient_id: string
          period: string
          submitted_at?: string
        }
        Update: {
          answers?: Json
          guardian_id?: string
          id?: string
          nps_score?: number | null
          patient_id?: string
          period?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      targets: {
        Row: {
          clinic_id: string
          id: string
          metric_key: string
          period: string
          role: string
          target_value: number
          weight: number
        }
        Insert: {
          clinic_id: string
          id?: string
          metric_key: string
          period: string
          role: string
          target_value: number
          weight: number
        }
        Update: {
          clinic_id?: string
          id?: string
          metric_key?: string
          period?: string
          role?: string
          target_value?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "targets_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_contracts: {
        Row: {
          hourly_rate: number
          id: string
          profile_id: string
          tier: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          hourly_rate: number
          id?: string
          profile_id: string
          tier: string
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          hourly_rate?: number
          id?: string
          profile_id?: string
          tier?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "therapist_contracts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plans: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          discipline_mix: Json
          id: string
          patient_id: string
          review_due_at: string | null
          status: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          discipline_mix?: Json
          id?: string
          patient_id: string
          review_due_at?: string | null
          status?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          discipline_mix?: Json
          id?: string
          patient_id?: string
          review_due_at?: string | null
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plans_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_data: {
        Row: {
          appointment_id: string
          duration_s: number | null
          id: string
          program_id: string
          prompt_level: string | null
          recorded_at: string
          result: string
          trial_index: number
        }
        Insert: {
          appointment_id: string
          duration_s?: number | null
          id?: string
          program_id: string
          prompt_level?: string | null
          recorded_at?: string
          result: string
          trial_index: number
        }
        Update: {
          appointment_id?: string
          duration_s?: number | null
          id?: string
          program_id?: string
          prompt_level?: string | null
          recorded_at?: string
          result?: string
          trial_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "trial_data_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_data_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          address: string | null
          biometric_required: boolean
          created_at: string | null
          id: string
          kiosk_email: string | null
          lat: number
          lng: number
          name: string
          radius_km: number
          radius_m: number
          workspace_id: string
        }
        Insert: {
          address?: string | null
          biometric_required?: boolean
          created_at?: string | null
          id: string
          kiosk_email?: string | null
          lat: number
          lng: number
          name: string
          radius_km?: number
          radius_m?: number
          workspace_id?: string
        }
        Update: {
          address?: string | null
          biometric_required?: boolean
          created_at?: string | null
          id?: string
          kiosk_email?: string | null
          lat?: number
          lng?: number
          name?: string
          radius_km?: number
          radius_m?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      vitrine_devices: {
        Row: {
          created_at: string
          fit: string
          id: string
          last_heartbeat_at: string | null
          name: string
          now_playing_video_id: string | null
          owner_id: string | null
          rotate: number
          token: string
        }
        Insert: {
          created_at?: string
          fit?: string
          id?: string
          last_heartbeat_at?: string | null
          name?: string
          now_playing_video_id?: string | null
          owner_id?: string | null
          rotate?: number
          token?: string
        }
        Update: {
          created_at?: string
          fit?: string
          id?: string
          last_heartbeat_at?: string | null
          name?: string
          now_playing_video_id?: string | null
          owner_id?: string | null
          rotate?: number
          token?: string
        }
        Relationships: []
      }
      vitrine_pairing_codes: {
        Row: {
          claimed_at: string | null
          code: string
          created_at: string
          device_id: string
          expires_at: string
        }
        Insert: {
          claimed_at?: string | null
          code: string
          created_at?: string
          device_id: string
          expires_at?: string
        }
        Update: {
          claimed_at?: string | null
          code?: string
          created_at?: string
          device_id?: string
          expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vitrine_pairing_codes_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "vitrine_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      vitrine_playlist_items: {
        Row: {
          active: boolean
          created_at: string
          device_id: string
          id: string
          position: number
          video_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          device_id: string
          id?: string
          position?: number
          video_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          device_id?: string
          id?: string
          position?: number
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vitrine_playlist_items_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "vitrine_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitrine_playlist_items_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "vitrine_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      vitrine_videos: {
        Row: {
          created_at: string
          duration_seconds: number | null
          height: number | null
          id: string
          original_filename: string
          owner_id: string
          status: string
          storage_path: string
          width: number | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          height?: number | null
          id?: string
          original_filename: string
          owner_id: string
          status?: string
          storage_path: string
          width?: number | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          height?: number | null
          id?: string
          original_filename?: string
          owner_id?: string
          status?: string
          storage_path?: string
          width?: number | null
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      pg_all_foreign_keys: {
        Row: {
          fk_columns: unknown[] | null
          fk_constraint_name: unknown
          fk_schema_name: unknown
          fk_table_name: unknown
          fk_table_oid: unknown
          is_deferrable: boolean | null
          is_deferred: boolean | null
          match_type: string | null
          on_delete: string | null
          on_update: string | null
          pk_columns: unknown[] | null
          pk_constraint_name: unknown
          pk_index_name: unknown
          pk_schema_name: unknown
          pk_table_name: unknown
          pk_table_oid: unknown
        }
        Relationships: []
      }
      tap_funky: {
        Row: {
          args: string | null
          is_definer: boolean | null
          is_strict: boolean | null
          is_visible: boolean | null
          kind: unknown
          langoid: unknown
          name: unknown
          oid: unknown
          owner: unknown
          returns: string | null
          returns_set: boolean | null
          schema: unknown
          volatility: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _cleanup: { Args: never; Returns: boolean }
      _contract_on: { Args: { "": string }; Returns: unknown }
      _currtest: { Args: never; Returns: number }
      _db_privs: { Args: never; Returns: unknown[] }
      _extensions: { Args: never; Returns: unknown[] }
      _get: { Args: { "": string }; Returns: number }
      _get_latest: { Args: { "": string }; Returns: number[] }
      _get_note: { Args: { "": string }; Returns: string }
      _is_verbose: { Args: never; Returns: boolean }
      _prokind: { Args: { p_oid: unknown }; Returns: unknown }
      _query: { Args: { "": string }; Returns: string }
      _refine_vol: { Args: { "": string }; Returns: string }
      _retval: { Args: { "": string }; Returns: string }
      _table_privs: { Args: never; Returns: unknown[] }
      _temptypes: { Args: { "": string }; Returns: string }
      _todo: { Args: never; Returns: string }
      app_current_role: { Args: never; Returns: string }
      change_intern_password: {
        Args: { p_intern_id: string; p_new_password: string }
        Returns: undefined
      }
      col_is_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
      col_not_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
      create_intern_user: {
        Args: {
          p_address?: string
          p_allowance?: number
          p_bank_account?: string
          p_bank_agency?: string
          p_bank_name?: string
          p_birthdate?: string
          p_course: string
          p_cpf?: string
          p_daily_hours: number
          p_documents?: Json
          p_email: string
          p_emergency_name?: string
          p_emergency_phone?: string
          p_emergency_relationship?: string
          p_end_date: string
          p_face_descriptor?: string
          p_institution: string
          p_name: string
          p_password: string
          p_phone?: string
          p_photo?: string
          p_pix_key?: string
          p_registration_status?: string
          p_rg?: string
          p_shift: string
          p_start_date: string
          p_supervisor_name?: string
          p_unit_id: string
        }
        Returns: string
      }
      current_clinic_id: { Args: never; Returns: string }
      delete_intern_user: { Args: { p_intern_id: string }; Returns: undefined }
      diag:
        | {
            Args: { msg: unknown }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { msg: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      diag_test_name: { Args: { "": string }; Returns: string }
      do_tap:
        | { Args: never; Returns: string[] }
        | { Args: { "": string }; Returns: string[] }
      fail:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      findfuncs: { Args: { "": string }; Returns: string[] }
      finish: { Args: { exception_on_failure?: boolean }; Returns: string[] }
      format_type_string: { Args: { "": string }; Returns: string }
      has_patient_access: {
        Args: { p_patient_id: string; p_types: string[] }
        Returns: boolean
      }
      has_unique: { Args: { "": string }; Returns: string }
      in_todo: { Args: never; Returns: boolean }
      is_certified_for_protocol: {
        Args: { p_protocol_id: string }
        Returns: boolean
      }
      is_empty: { Args: { "": string }; Returns: string }
      isnt_empty: { Args: { "": string }; Returns: string }
      jwt_has_workspace_access: {
        Args: { target_workspace: string }
        Returns: boolean
      }
      jwt_intern_self_workspace: { Args: never; Returns: string }
      jwt_own_unit_workspace: { Args: never; Returns: string }
      lives_ok: { Args: { "": string }; Returns: string }
      no_plan: { Args: never; Returns: boolean[] }
      num_failed: { Args: never; Returns: number }
      os_name: { Args: never; Returns: string }
      pass:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      patient_status_as_of: {
        Args: { p_at: string; p_patient_id: string }
        Returns: string
      }
      pg_version: { Args: never; Returns: string }
      pg_version_num: { Args: never; Returns: number }
      pgtap_version: { Args: never; Returns: number }
      reset_intern_password: {
        Args: { p_intern_id: string; p_new_password: string }
        Returns: undefined
      }
      runtests:
        | { Args: never; Returns: string[] }
        | { Args: { "": string }; Returns: string[] }
      session_note_pending: {
        Args: { p_appointment_id: string }
        Returns: boolean
      }
      skip:
        | { Args: { "": string }; Returns: string }
        | { Args: { how_many: number; why: string }; Returns: string }
      throws_ok: { Args: { "": string }; Returns: string }
      todo:
        | { Args: { how_many: number }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
        | { Args: { why: string }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
      todo_end: { Args: never; Returns: boolean[] }
      todo_start:
        | { Args: never; Returns: boolean[] }
        | { Args: { "": string }; Returns: boolean[] }
      vitrine_device_heartbeat: {
        Args: { p_now_playing_video_id?: string; p_token: string }
        Returns: boolean
      }
      vitrine_get_device_playlist: {
        Args: { p_token: string }
        Returns: {
          device_id: string
          device_name: string
          fit: string
          position: number
          rotate: number
          storage_path: string
          video_id: string
        }[]
      }
      vitrine_pairing_claim: {
        Args: { p_code: string; p_name?: string }
        Returns: Json
      }
      vitrine_pairing_start: { Args: never; Returns: Json }
      vitrine_pairing_status: { Args: { p_code: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      _time_trial_type: {
        a_time: number | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
