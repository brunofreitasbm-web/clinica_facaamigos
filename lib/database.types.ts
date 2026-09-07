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
          antecedent: string
          appointment_id: string
          behavior_description: string
          consequence: string
          duration_seconds: number | null
          id: string
          intensity: string | null
          patient_id: string
          recorded_at: string
          therapist_id: string
        }
        Insert: {
          antecedent: string
          appointment_id: string
          behavior_description: string
          consequence: string
          duration_seconds?: number | null
          id?: string
          intensity?: string | null
          patient_id: string
          recorded_at?: string
          therapist_id: string
        }
        Update: {
          antecedent?: string
          appointment_id?: string
          behavior_description?: string
          consequence?: string
          duration_seconds?: number | null
          id?: string
          intensity?: string | null
          patient_id?: string
          recorded_at?: string
          therapist_id?: string
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
          },
        ]
      }
      absence_alerts: {
        Row: {
          consecutive_faltas: number
          created_at: string
          faltas_pct_3m: number
          id: string
          notified_at: string | null
          patient_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          consecutive_faltas: number
          created_at?: string
          faltas_pct_3m: number
          id?: string
          notified_at?: string | null
          patient_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          consecutive_faltas?: number
          created_at?: string
          faltas_pct_3m?: number
          id?: string
          notified_at?: string | null
          patient_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_alerts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
      anamneses: {
        Row: {
          conducted_at: string
          conducted_by: string
          free_text: string | null
          id: string
          patient_id: string
          presented_absence_policy: boolean
          presented_pillars: boolean
          presented_protocols: boolean
          structured: Json
        }
        Insert: {
          conducted_at?: string
          conducted_by: string
          free_text?: string | null
          id?: string
          patient_id: string
          presented_absence_policy?: boolean
          presented_pillars?: boolean
          presented_protocols?: boolean
          structured?: Json
        }
        Update: {
          conducted_at?: string
          conducted_by?: string
          free_text?: string | null
          id?: string
          patient_id?: string
          presented_absence_policy?: boolean
          presented_pillars?: boolean
          presented_protocols?: boolean
          structured?: Json
        }
        Relationships: [
          {
            foreignKeyName: "anamneses_conducted_by_fkey"
            columns: ["conducted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamneses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      anamnesis_prefill_requests: {
        Row: {
          appointment_id: string
          created_at: string
          declined_at: string | null
          guardian_id: string
          id: string
          patient_id: string
          phone_number: string
          reminder_sent_at: string | null
          responded_at: string | null
          sent_at: string
          status: string
          structured: Json
        }
        Insert: {
          appointment_id: string
          created_at?: string
          declined_at?: string | null
          guardian_id: string
          id?: string
          patient_id: string
          phone_number: string
          reminder_sent_at?: string | null
          responded_at?: string | null
          sent_at?: string
          status?: string
          structured?: Json
        }
        Update: {
          appointment_id?: string
          created_at?: string
          declined_at?: string | null
          guardian_id?: string
          id?: string
          patient_id?: string
          phone_number?: string
          reminder_sent_at?: string | null
          responded_at?: string | null
          sent_at?: string
          status?: string
          structured?: Json
        }
        Relationships: [
          {
            foreignKeyName: "anamnesis_prefill_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnesis_prefill_requests_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnesis_prefill_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      anamnesis_scheduling_requests: {
        Row: {
          appointment_id: string | null
          approved_at: string | null
          child_birth_date: string | null
          child_name: string
          clinic_id: string | null
          created_at: string
          guardian_cpf: string
          guardian_name: string
          guardian_phone: string
          guia_pdf_url: string | null
          id: string
          laudo_pdf_url: string | null
          patient_id: string | null
          rejection_reason: string | null
          selected_slot_ends_at: string | null
          selected_slot_starts_at: string | null
          status: string
          supervisor_id: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          approved_at?: string | null
          child_birth_date?: string | null
          child_name: string
          clinic_id?: string | null
          created_at?: string
          guardian_cpf: string
          guardian_name: string
          guardian_phone: string
          guia_pdf_url?: string | null
          id?: string
          laudo_pdf_url?: string | null
          patient_id?: string | null
          rejection_reason?: string | null
          selected_slot_ends_at?: string | null
          selected_slot_starts_at?: string | null
          status?: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          approved_at?: string | null
          child_birth_date?: string | null
          child_name?: string
          clinic_id?: string | null
          created_at?: string
          guardian_cpf?: string
          guardian_name?: string
          guardian_phone?: string
          guia_pdf_url?: string | null
          id?: string
          laudo_pdf_url?: string | null
          patient_id?: string | null
          rejection_reason?: string | null
          selected_slot_ends_at?: string | null
          selected_slot_starts_at?: string | null
          status?: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamnesis_scheduling_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnesis_scheduling_requests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnesis_scheduling_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnesis_scheduling_requests_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_types: {
        Row: {
          active: boolean
          clinic_id: string
          created_at: string
          display_interval_minutes: number
          duration_minutes: number
          id: string
          modality: string
          name: string
          recurrence: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          created_at?: string
          display_interval_minutes: number
          duration_minutes: number
          id?: string
          modality?: string
          name: string
          recurrence?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          created_at?: string
          display_interval_minutes?: number
          duration_minutes?: number
          id?: string
          modality?: string
          name?: string
          recurrence?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_types_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_type_id: string | null
          attendance_started_at: string | null
          authorization_id: string | null
          auto_marked: boolean
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
          appointment_type_id?: string | null
          attendance_started_at?: string | null
          authorization_id?: string | null
          auto_marked?: boolean
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
          appointment_type_id?: string | null
          attendance_started_at?: string | null
          authorization_id?: string | null
          auto_marked?: boolean
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
            foreignKeyName: "appointments_appointment_type_id_fkey"
            columns: ["appointment_type_id"]
            isOneToOne: false
            referencedRelation: "appointment_types"
            referencedColumns: ["id"]
          },
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
      authorization_renewal_requests: {
        Row: {
          authorization_id: string
          created_at: string
          id: string
          notified_at: string | null
          patient_insurance_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          authorization_id: string
          created_at?: string
          id?: string
          notified_at?: string | null
          patient_insurance_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          authorization_id?: string
          created_at?: string
          id?: string
          notified_at?: string | null
          patient_insurance_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "authorization_renewal_requests_authorization_id_fkey"
            columns: ["authorization_id"]
            isOneToOne: false
            referencedRelation: "authorizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_renewal_requests_patient_insurance_id_fkey"
            columns: ["patient_insurance_id"]
            isOneToOne: false
            referencedRelation: "patient_insurance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_renewal_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      authorizations: {
        Row: {
          approved_at: string | null
          authorization_password: string | null
          document_id: string | null
          guide_number: string | null
          id: string
          password_valid_until: string | null
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
          authorization_password?: string | null
          document_id?: string | null
          guide_number?: string | null
          id?: string
          password_valid_until?: string | null
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
          authorization_password?: string | null
          document_id?: string | null
          guide_number?: string | null
          id?: string
          password_valid_until?: string | null
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
      behavior_catalog: {
        Row: {
          active: boolean
          clinic_id: string
          created_at: string
          discipline: string | null
          id: string
          label: string
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          created_at?: string
          discipline?: string | null
          id?: string
          label: string
          sort_order?: number
          updated_at?: string
          value: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          created_at?: string
          discipline?: string | null
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "behavior_catalog_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
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
      bonding_reports: {
        Row: {
          engagement_score: number
          id: string
          observations: string | null
          patient_id: string
          period_end: string
          period_start: string
          ready_to_increase_demands: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          therapist_id: string
        }
        Insert: {
          engagement_score: number
          id?: string
          observations?: string | null
          patient_id: string
          period_end: string
          period_start: string
          ready_to_increase_demands?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          therapist_id: string
        }
        Update: {
          engagement_score?: number
          id?: string
          observations?: string | null
          patient_id?: string
          period_end?: string
          period_start?: string
          ready_to_increase_demands?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonding_reports_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonding_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonding_reports_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_sessions: {
        Row: {
          collected_data: Json
          created_at: string
          current_step: string
          flow: string | null
          id: string
          lead_id: string | null
          phone_number: string
          updated_at: string
        }
        Insert: {
          collected_data?: Json
          created_at?: string
          current_step?: string
          flow?: string | null
          id?: string
          lead_id?: string | null
          phone_number: string
          updated_at?: string
        }
        Update: {
          collected_data?: Json
          created_at?: string
          current_step?: string
          flow?: string | null
          id?: string
          lead_id?: string | null
          phone_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      clinics: {
        Row: {
          cnpj: string | null
          created_at: string
          id: string
          name: string
          reassessment_cycle_months: number
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          id?: string
          name: string
          reassessment_cycle_months?: number
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          id?: string
          name?: string
          reassessment_cycle_months?: number
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
          note: string | null
          patient_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          shared_with_family: boolean
          storage_path: string
          uploaded_at: string
          uploaded_by: string
          valid_until: string | null
        }
        Insert: {
          category: string
          id?: string
          note?: string | null
          patient_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shared_with_family?: boolean
          storage_path: string
          uploaded_at?: string
          uploaded_by: string
          valid_until?: string | null
        }
        Update: {
          category?: string
          id?: string
          note?: string | null
          patient_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
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
            foreignKeyName: "documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      employee_dependents: {
        Row: {
          birthdate: string | null
          cpf: string | null
          created_at: string | null
          employee_id: string
          for_ir: boolean
          for_salario_familia: boolean
          id: string
          name: string
          relationship: string | null
        }
        Insert: {
          birthdate?: string | null
          cpf?: string | null
          created_at?: string | null
          employee_id: string
          for_ir?: boolean
          for_salario_familia?: boolean
          id?: string
          name: string
          relationship?: string | null
        }
        Update: {
          birthdate?: string | null
          cpf?: string | null
          created_at?: string | null
          employee_id?: string
          for_ir?: boolean
          for_salario_familia?: boolean
          id?: string
          name?: string
          relationship?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_dependents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          content: string
          created_at: string | null
          doc_key: string
          employee_id: string
          meta: Json | null
        }
        Insert: {
          content: string
          created_at?: string | null
          doc_key: string
          employee_id: string
          meta?: Json | null
        }
        Update: {
          content?: string
          created_at?: string | null
          doc_key?: string
          employee_id?: string
          meta?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_medical_exams: {
        Row: {
          created_at: string | null
          created_by: string | null
          doc_key: string | null
          doctor_crm: string | null
          doctor_name: string | null
          employee_id: string
          exam_date: string
          exam_type: string
          id: string
          restrictions: string | null
          result: string | null
          risk_grade: number | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          doc_key?: string | null
          doctor_crm?: string | null
          doctor_name?: string | null
          employee_id: string
          exam_date: string
          exam_type: string
          id?: string
          restrictions?: string | null
          result?: string | null
          risk_grade?: number | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          doc_key?: string | null
          doctor_crm?: string | null
          doctor_name?: string | null
          employee_id?: string
          exam_date?: string
          exam_type?: string
          id?: string
          restrictions?: string | null
          result?: string | null
          risk_grade?: number | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_medical_exams_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_occurrences: {
        Row: {
          affects_dsr: boolean
          affects_vacation: boolean
          cat_number: string | null
          created_at: string | null
          created_by: string | null
          days: number
          description: string | null
          doc_key: string | null
          employee_id: string
          end_date: string | null
          id: string
          inss_referral: boolean
          justified: boolean
          legal_basis: string | null
          start_date: string
          type: string
          unit_id: string
        }
        Insert: {
          affects_dsr?: boolean
          affects_vacation?: boolean
          cat_number?: string | null
          created_at?: string | null
          created_by?: string | null
          days?: number
          description?: string | null
          doc_key?: string | null
          employee_id: string
          end_date?: string | null
          id?: string
          inss_referral?: boolean
          justified?: boolean
          legal_basis?: string | null
          start_date: string
          type: string
          unit_id: string
        }
        Update: {
          affects_dsr?: boolean
          affects_vacation?: boolean
          cat_number?: string | null
          created_at?: string | null
          created_by?: string | null
          days?: number
          description?: string | null
          doc_key?: string | null
          employee_id?: string
          end_date?: string | null
          id?: string
          inss_referral?: boolean
          justified?: boolean
          legal_basis?: string | null
          start_date?: string
          type?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_occurrences_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_occurrences_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_self_registration_tokens: {
        Row: {
          created_at: string | null
          employee_id: string
          expires_at: string
          token_hash: string
          uploads_used: number
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          expires_at: string
          token_hash: string
          uploads_used?: number
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          expires_at?: string
          token_hash?: string
          uploads_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_self_registration_tokens_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_terminations: {
        Row: {
          checklist: Json | null
          created_at: string | null
          created_by: string | null
          demissional_exam_id: string | null
          employee_id: string
          notes: string | null
          notice_days: number | null
          notice_reduction: string | null
          notice_start: string | null
          notice_type: string | null
          payment_deadline: string | null
          projected_end: string | null
          termination_date: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          checklist?: Json | null
          created_at?: string | null
          created_by?: string | null
          demissional_exam_id?: string | null
          employee_id: string
          notes?: string | null
          notice_days?: number | null
          notice_reduction?: string | null
          notice_start?: string | null
          notice_type?: string | null
          payment_deadline?: string | null
          projected_end?: string | null
          termination_date?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          checklist?: Json | null
          created_at?: string | null
          created_by?: string | null
          demissional_exam_id?: string | null
          employee_id?: string
          notes?: string | null
          notice_days?: number | null
          notice_reduction?: string | null
          notice_start?: string | null
          notice_type?: string | null
          payment_deadline?: string | null
          projected_end?: string | null
          termination_date?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_terminations_demissional_exam_id_fkey"
            columns: ["demissional_exam_id"]
            isOneToOne: false
            referencedRelation: "employee_medical_exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_terminations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_time_adjustments: {
        Row: {
          created_at: string | null
          created_by: string | null
          employee_id: string
          evidence_doc: Json | null
          id: string
          reason: string
          timestamp: string | null
          type: string
          unit_id: string
          voids_adjustment_id: string | null
          voids_record_id: string | null
          work_date: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          employee_id: string
          evidence_doc?: Json | null
          id?: string
          reason: string
          timestamp?: string | null
          type: string
          unit_id: string
          voids_adjustment_id?: string | null
          voids_record_id?: string | null
          work_date: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          employee_id?: string
          evidence_doc?: Json | null
          id?: string
          reason?: string
          timestamp?: string | null
          type?: string
          unit_id?: string
          voids_adjustment_id?: string | null
          voids_record_id?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_time_adjustments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_time_adjustments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_time_adjustments_voids_adjustment_fk"
            columns: ["voids_adjustment_id"]
            isOneToOne: false
            referencedRelation: "employee_time_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_time_adjustments_voids_record_id_fkey"
            columns: ["voids_record_id"]
            isOneToOne: false
            referencedRelation: "employee_time_records"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_time_nsr: {
        Row: {
          last_hash: string | null
          last_nsr: number
          unit_id: string
        }
        Insert: {
          last_hash?: string | null
          last_nsr?: number
          unit_id: string
        }
        Update: {
          last_hash?: string | null
          last_nsr?: number
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_time_nsr_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_time_records: {
        Row: {
          auth_method: string
          biometric: Json | null
          created_at: string | null
          created_by: string | null
          employee_cpf: string | null
          employee_id: string
          employee_name: string
          geo: Json | null
          id: string
          nsr: number
          photo: string | null
          prev_hash: string | null
          record_hash: string | null
          timestamp: string
          type: string
          unit_id: string
          work_date: string
        }
        Insert: {
          auth_method?: string
          biometric?: Json | null
          created_at?: string | null
          created_by?: string | null
          employee_cpf?: string | null
          employee_id: string
          employee_name: string
          geo?: Json | null
          id?: string
          nsr: number
          photo?: string | null
          prev_hash?: string | null
          record_hash?: string | null
          timestamp?: string
          type: string
          unit_id: string
          work_date: string
        }
        Update: {
          auth_method?: string
          biometric?: Json | null
          created_at?: string | null
          created_by?: string | null
          employee_cpf?: string | null
          employee_id?: string
          employee_name?: string
          geo?: Json | null
          id?: string
          nsr?: number
          photo?: string | null
          prev_hash?: string | null
          record_hash?: string | null
          timestamp?: string
          type?: string
          unit_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_time_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_time_records_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_timesheet_closures: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          competencia: string
          employee_id: string
          reopened_at: string | null
          summary: Json | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          competencia: string
          employee_id: string
          reopened_at?: string | null
          summary?: Json | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          competencia?: string
          employee_id?: string
          reopened_at?: string | null
          summary?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_timesheet_closures_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_vacation_periods: {
        Row: {
          acquisition_end: string
          acquisition_start: string
          concession_end: string
          created_at: string | null
          days_entitled: number
          employee_id: string
          id: string
          status: string
          suspended_reason: string | null
          unjustified_absences: number
        }
        Insert: {
          acquisition_end: string
          acquisition_start: string
          concession_end: string
          created_at?: string | null
          days_entitled?: number
          employee_id: string
          id?: string
          status?: string
          suspended_reason?: string | null
          unjustified_absences?: number
        }
        Update: {
          acquisition_end?: string
          acquisition_start?: string
          concession_end?: string
          created_at?: string | null
          days_entitled?: number
          employee_id?: string
          id?: string
          status?: string
          suspended_reason?: string | null
          unjustified_absences?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_vacation_periods_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_vacation_schedules: {
        Row: {
          abono_days: number
          created_at: string | null
          created_by: string | null
          days: number
          doc_notice_key: string | null
          doc_receipt_key: string | null
          employee_id: string
          end_date: string
          id: string
          notice_issued_at: string | null
          payment_done_at: string | null
          payment_due: string | null
          period_id: string
          start_date: string
          status: string
        }
        Insert: {
          abono_days?: number
          created_at?: string | null
          created_by?: string | null
          days: number
          doc_notice_key?: string | null
          doc_receipt_key?: string | null
          employee_id: string
          end_date: string
          id?: string
          notice_issued_at?: string | null
          payment_done_at?: string | null
          payment_due?: string | null
          period_id: string
          start_date: string
          status?: string
        }
        Update: {
          abono_days?: number
          created_at?: string | null
          created_by?: string | null
          days?: number
          doc_notice_key?: string | null
          doc_receipt_key?: string | null
          employee_id?: string
          end_date?: string
          id?: string
          notice_issued_at?: string | null
          payment_done_at?: string | null
          payment_due?: string | null
          period_id?: string
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_vacation_schedules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_vacation_schedules_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "employee_vacation_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: Json | null
          admission_date: string | null
          bank_account: string | null
          bank_account_type: string | null
          bank_agency: string | null
          bank_name: string | null
          base_salary: number | null
          biometric_consent_at: string | null
          biometric_consent_version: string | null
          birthdate: string | null
          birthplace: string | null
          cba_reference: string | null
          cbo: string | null
          cnh: string | null
          cnh_category: string | null
          contract_end: string | null
          contract_type: string
          cpf: string | null
          created_at: string | null
          ctps_number: string | null
          ctps_series: string | null
          ctps_uf: string | null
          department: string | null
          education: string | null
          email: string | null
          experience_first_end: string | null
          experience_second_end: string | null
          face_descriptor: string | null
          father_name: string | null
          health_plan: boolean
          hours_bank: boolean
          hours_bank_started_at: string | null
          id: string
          job_title: string | null
          lgpd_consent_accepted_at: string | null
          lgpd_consent_version: string | null
          marital_status: string | null
          mother_name: string | null
          name: string
          nationality: string | null
          night_work: boolean
          notes: string | null
          phone: string | null
          photo: string | null
          pis: string | null
          pix_key: string | null
          registration_status: string
          reservist_cert: string | null
          rg: string | null
          rg_issuer: string | null
          schedule: Json | null
          self_registered_at: string | null
          sex: string | null
          status: string
          termination_date: string | null
          union_name: string | null
          unit_id: string
          updated_at: string | null
          voter_title: string | null
          vr_opted: boolean
          vt_daily_cost: number | null
          vt_opted: boolean
          weekly_hours: number
          work_regime: string | null
        }
        Insert: {
          address?: Json | null
          admission_date?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          base_salary?: number | null
          biometric_consent_at?: string | null
          biometric_consent_version?: string | null
          birthdate?: string | null
          birthplace?: string | null
          cba_reference?: string | null
          cbo?: string | null
          cnh?: string | null
          cnh_category?: string | null
          contract_end?: string | null
          contract_type?: string
          cpf?: string | null
          created_at?: string | null
          ctps_number?: string | null
          ctps_series?: string | null
          ctps_uf?: string | null
          department?: string | null
          education?: string | null
          email?: string | null
          experience_first_end?: string | null
          experience_second_end?: string | null
          face_descriptor?: string | null
          father_name?: string | null
          health_plan?: boolean
          hours_bank?: boolean
          hours_bank_started_at?: string | null
          id?: string
          job_title?: string | null
          lgpd_consent_accepted_at?: string | null
          lgpd_consent_version?: string | null
          marital_status?: string | null
          mother_name?: string | null
          name: string
          nationality?: string | null
          night_work?: boolean
          notes?: string | null
          phone?: string | null
          photo?: string | null
          pis?: string | null
          pix_key?: string | null
          registration_status?: string
          reservist_cert?: string | null
          rg?: string | null
          rg_issuer?: string | null
          schedule?: Json | null
          self_registered_at?: string | null
          sex?: string | null
          status?: string
          termination_date?: string | null
          union_name?: string | null
          unit_id: string
          updated_at?: string | null
          voter_title?: string | null
          vr_opted?: boolean
          vt_daily_cost?: number | null
          vt_opted?: boolean
          weekly_hours?: number
          work_regime?: string | null
        }
        Update: {
          address?: Json | null
          admission_date?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          base_salary?: number | null
          biometric_consent_at?: string | null
          biometric_consent_version?: string | null
          birthdate?: string | null
          birthplace?: string | null
          cba_reference?: string | null
          cbo?: string | null
          cnh?: string | null
          cnh_category?: string | null
          contract_end?: string | null
          contract_type?: string
          cpf?: string | null
          created_at?: string | null
          ctps_number?: string | null
          ctps_series?: string | null
          ctps_uf?: string | null
          department?: string | null
          education?: string | null
          email?: string | null
          experience_first_end?: string | null
          experience_second_end?: string | null
          face_descriptor?: string | null
          father_name?: string | null
          health_plan?: boolean
          hours_bank?: boolean
          hours_bank_started_at?: string | null
          id?: string
          job_title?: string | null
          lgpd_consent_accepted_at?: string | null
          lgpd_consent_version?: string | null
          marital_status?: string | null
          mother_name?: string | null
          name?: string
          nationality?: string | null
          night_work?: boolean
          notes?: string | null
          phone?: string | null
          photo?: string | null
          pis?: string | null
          pix_key?: string | null
          registration_status?: string
          reservist_cert?: string | null
          rg?: string | null
          rg_issuer?: string | null
          schedule?: Json | null
          self_registered_at?: string | null
          sex?: string | null
          status?: string
          termination_date?: string | null
          union_name?: string | null
          unit_id?: string
          updated_at?: string | null
          voter_title?: string | null
          vr_opted?: boolean
          vt_daily_cost?: number | null
          vt_opted?: boolean
          weekly_hours?: number
          work_regime?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      family_feedback: {
        Row: {
          category_ratings: Json
          comments: string | null
          created_at: string
          guardian_id: string
          id: string
          patient_id: string
        }
        Insert: {
          category_ratings?: Json
          comments?: string | null
          created_at?: string
          guardian_id: string
          id?: string
          patient_id: string
        }
        Update: {
          category_ratings?: Json
          comments?: string | null
          created_at?: string
          guardian_id?: string
          id?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_feedback_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_feedback_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      family_otp_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          used: boolean
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          used?: boolean
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          used?: boolean
        }
        Relationships: []
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
      fono_assessments: {
        Row: {
          age_months: number
          age_years: number
          assessed_by: string
          birth_date: string
          clinic_id: string
          created_at: string
          id: string
          instrument: string
          manual_scores: Json
          observations: string | null
          patient_id: string
          responses: Json
          results: Json
          status: string
          test_date: string
          updated_at: string
        }
        Insert: {
          age_months: number
          age_years: number
          assessed_by: string
          birth_date: string
          clinic_id: string
          created_at?: string
          id?: string
          instrument: string
          manual_scores?: Json
          observations?: string | null
          patient_id: string
          responses?: Json
          results?: Json
          status?: string
          test_date: string
          updated_at?: string
        }
        Update: {
          age_months?: number
          age_years?: number
          assessed_by?: string
          birth_date?: string
          clinic_id?: string
          created_at?: string
          id?: string
          instrument?: string
          manual_scores?: Json
          observations?: string | null
          patient_id?: string
          responses?: Json
          results?: Json
          status?: string
          test_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fono_assessments_assessed_by_fkey"
            columns: ["assessed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fono_assessments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fono_assessments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      glosa_recurring_patterns: {
        Row: {
          created_at: string
          first_seen_at: string
          id: string
          insurer_id: string
          last_seen_at: string
          occurrences_count: number
          reason_code: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_seen_at: string
          id?: string
          insurer_id: string
          last_seen_at: string
          occurrences_count: number
          reason_code: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_seen_at?: string
          id?: string
          insurer_id?: string
          last_seen_at?: string
          occurrences_count?: number
          reason_code?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "glosa_recurring_patterns_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
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
          image_consent: boolean
          image_consent_updated_at: string | null
          is_emergency_contact: boolean
          is_financial: boolean
          lgpd_consent_at: string | null
          patient_id: string
          phone: string
          portal_enabled: boolean
          profile_id: string | null
          relationship: string | null
          rg: string | null
        }
        Insert: {
          cpf?: string | null
          email?: string | null
          full_name: string
          id?: string
          image_consent?: boolean
          image_consent_updated_at?: string | null
          is_emergency_contact?: boolean
          is_financial?: boolean
          lgpd_consent_at?: string | null
          patient_id: string
          phone: string
          portal_enabled?: boolean
          profile_id?: string | null
          relationship?: string | null
          rg?: string | null
        }
        Update: {
          cpf?: string | null
          email?: string | null
          full_name?: string
          id?: string
          image_consent?: boolean
          image_consent_updated_at?: string | null
          is_emergency_contact?: boolean
          is_financial?: boolean
          lgpd_consent_at?: string | null
          patient_id?: string
          phone?: string
          portal_enabled?: boolean
          profile_id?: string | null
          relationship?: string | null
          rg?: string | null
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
      holidays: {
        Row: {
          created_at: string | null
          date: string
          id: string
          name: string
          recurring: boolean
          scope: string
          unit_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          name: string
          recurring?: boolean
          scope?: string
          unit_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          name?: string
          recurring?: boolean
          scope?: string
          unit_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holidays_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_intake_batches: {
        Row: {
          attempts: number
          clinic_id: string
          created_at: string
          detected_insurer_name: string | null
          error: string | null
          extracted: Json | null
          id: string
          insurer_id: string | null
          leads_count: number
          locked_at: string | null
          mime_type: string
          model: string | null
          original_name: string | null
          processed_at: string | null
          size_bytes: number | null
          status: string
          storage_path: string
          uploaded_by: string | null
          warnings: string[]
        }
        Insert: {
          attempts?: number
          clinic_id: string
          created_at?: string
          detected_insurer_name?: string | null
          error?: string | null
          extracted?: Json | null
          id?: string
          insurer_id?: string | null
          leads_count?: number
          locked_at?: string | null
          mime_type?: string
          model?: string | null
          original_name?: string | null
          processed_at?: string | null
          size_bytes?: number | null
          status?: string
          storage_path: string
          uploaded_by?: string | null
          warnings?: string[]
        }
        Update: {
          attempts?: number
          clinic_id?: string
          created_at?: string
          detected_insurer_name?: string | null
          error?: string | null
          extracted?: Json | null
          id?: string
          insurer_id?: string | null
          leads_count?: number
          locked_at?: string | null
          mime_type?: string
          model?: string | null
          original_name?: string | null
          processed_at?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string
          uploaded_by?: string | null
          warnings?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "insurance_intake_batches_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_intake_batches_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_intake_batches_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_intake_lead_files: {
        Row: {
          created_at: string
          document_id: string | null
          id: string
          kind: string | null
          lead_id: string
          mime_type: string
          original_name: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          size_bytes: number | null
          storage_path: string
          twilio_media_url: string | null
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          id?: string
          kind?: string | null
          lead_id: string
          mime_type: string
          original_name?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number | null
          storage_path: string
          twilio_media_url?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string | null
          id?: string
          kind?: string | null
          lead_id?: string
          mime_type?: string
          original_name?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number | null
          storage_path?: string
          twilio_media_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insurance_intake_lead_files_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_intake_lead_files_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "insurance_intake_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_intake_lead_files_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_intake_leads: {
        Row: {
          appointment_id: string | null
          approved_at: string | null
          approved_by: string | null
          authorization_id: string | null
          authorization_password: string | null
          batch_id: string
          cancelled_at: string | null
          cancelled_by: string | null
          card_number: string | null
          card_valid_until: string | null
          clinic_id: string
          confidence: Json
          contact_sent_at: string | null
          conversation_id: string | null
          created_at: string
          docs_reviewed_at: string | null
          docs_reviewed_by: string | null
          duplicate_patient_id: string | null
          duplicate_reason: string | null
          extra: Json
          guardian_cpf: string | null
          guardian_email: string | null
          guardian_full_name: string | null
          guardian_id: string | null
          guardian_phone_raw: string | null
          guardian_relationship: string | null
          guide_number: string | null
          id: string
          insurer_id: string | null
          last_file_at: string | null
          offered_slots: Json | null
          patient_birth_date: string | null
          patient_cid: string | null
          patient_cpf: string | null
          patient_full_name: string | null
          patient_id: string | null
          patient_insurance_id: string | null
          patient_sexo: string | null
          phone_e164: string | null
          plan_name: string | null
          procedure_code: string | null
          rejection_count: number
          row_index: number
          scheduled_at: string | null
          sessions_authorized: number | null
          slots_sent_at: string | null
          status: string
          status_reason: string | null
          updated_at: string
          valid_from: string | null
          valid_to: string | null
          warnings: string[]
        }
        Insert: {
          appointment_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          authorization_id?: string | null
          authorization_password?: string | null
          batch_id: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          card_number?: string | null
          card_valid_until?: string | null
          clinic_id: string
          confidence?: Json
          contact_sent_at?: string | null
          conversation_id?: string | null
          created_at?: string
          docs_reviewed_at?: string | null
          docs_reviewed_by?: string | null
          duplicate_patient_id?: string | null
          duplicate_reason?: string | null
          extra?: Json
          guardian_cpf?: string | null
          guardian_email?: string | null
          guardian_full_name?: string | null
          guardian_id?: string | null
          guardian_phone_raw?: string | null
          guardian_relationship?: string | null
          guide_number?: string | null
          id?: string
          insurer_id?: string | null
          last_file_at?: string | null
          offered_slots?: Json | null
          patient_birth_date?: string | null
          patient_cid?: string | null
          patient_cpf?: string | null
          patient_full_name?: string | null
          patient_id?: string | null
          patient_insurance_id?: string | null
          patient_sexo?: string | null
          phone_e164?: string | null
          plan_name?: string | null
          procedure_code?: string | null
          rejection_count?: number
          row_index: number
          scheduled_at?: string | null
          sessions_authorized?: number | null
          slots_sent_at?: string | null
          status?: string
          status_reason?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          warnings?: string[]
        }
        Update: {
          appointment_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          authorization_id?: string | null
          authorization_password?: string | null
          batch_id?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          card_number?: string | null
          card_valid_until?: string | null
          clinic_id?: string
          confidence?: Json
          contact_sent_at?: string | null
          conversation_id?: string | null
          created_at?: string
          docs_reviewed_at?: string | null
          docs_reviewed_by?: string | null
          duplicate_patient_id?: string | null
          duplicate_reason?: string | null
          extra?: Json
          guardian_cpf?: string | null
          guardian_email?: string | null
          guardian_full_name?: string | null
          guardian_id?: string | null
          guardian_phone_raw?: string | null
          guardian_relationship?: string | null
          guide_number?: string | null
          id?: string
          insurer_id?: string | null
          last_file_at?: string | null
          offered_slots?: Json | null
          patient_birth_date?: string | null
          patient_cid?: string | null
          patient_cpf?: string | null
          patient_full_name?: string | null
          patient_id?: string | null
          patient_insurance_id?: string | null
          patient_sexo?: string | null
          phone_e164?: string | null
          plan_name?: string | null
          procedure_code?: string | null
          rejection_count?: number
          row_index?: number
          scheduled_at?: string | null
          sessions_authorized?: number | null
          slots_sent_at?: string | null
          status?: string
          status_reason?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          warnings?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "insurance_intake_leads_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_intake_leads_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_intake_leads_authorization_id_fkey"
            columns: ["authorization_id"]
            isOneToOne: false
            referencedRelation: "authorizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_intake_leads_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "insurance_intake_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_intake_leads_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_intake_leads_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_intake_leads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "twilio_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_intake_leads_docs_reviewed_by_fkey"
            columns: ["docs_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_intake_leads_duplicate_patient_id_fkey"
            columns: ["duplicate_patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_intake_leads_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_intake_leads_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_intake_leads_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_intake_leads_patient_insurance_id_fkey"
            columns: ["patient_insurance_id"]
            isOneToOne: false
            referencedRelation: "patient_insurance"
            referencedColumns: ["id"]
          },
        ]
      }
      insurer_price_tables: {
        Row: {
          cost: number | null
          id: string
          insurer_id: string
          price: number
          procedure_code: string
          procedure_name: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          cost?: number | null
          id?: string
          insurer_id: string
          price: number
          procedure_code: string
          procedure_name: string
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          cost?: number | null
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
          intake_extraction_profile: Json
          name: string
          provider_code: string | null
        }
        Insert: {
          ans_code?: string | null
          billing_rules?: Json
          clinic_id: string
          id?: string
          intake_extraction_profile?: Json
          name: string
          provider_code?: string | null
        }
        Update: {
          ans_code?: string | null
          billing_rules?: Json
          clinic_id?: string
          id?: string
          intake_extraction_profile?: Json
          name?: string
          provider_code?: string | null
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
      intake_steps: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          due_at: string | null
          id: string
          notes: string | null
          patient_id: string
          status: string
          step_key: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          status?: string
          step_key: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          status?: string
          step_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_steps_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_steps_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
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
      intervention_catalog: {
        Row: {
          active: boolean
          clinic_id: string
          created_at: string
          discipline: string | null
          id: string
          label: string
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          created_at?: string
          discipline?: string | null
          id?: string
          label: string
          sort_order?: number
          updated_at?: string
          value: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          created_at?: string
          discipline?: string | null
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_catalog_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          agenda: Json
          conducted_by: string
          decisions: string | null
          family_present: boolean
          held_at: string
          id: string
          kind: string
          minutes: string | null
          participants: string[]
          patient_id: string
          treatment_plan_id: string | null
        }
        Insert: {
          agenda?: Json
          conducted_by: string
          decisions?: string | null
          family_present?: boolean
          held_at?: string
          id?: string
          kind: string
          minutes?: string | null
          participants?: string[]
          patient_id: string
          treatment_plan_id?: string | null
        }
        Update: {
          agenda?: Json
          conducted_by?: string
          decisions?: string | null
          family_present?: boolean
          held_at?: string
          id?: string
          kind?: string
          minutes?: string | null
          participants?: string[]
          patient_id?: string
          treatment_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_conducted_by_fkey"
            columns: ["conducted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          channel: string
          conversation_id: string | null
          delivered_at: string | null
          delivery_status: string | null
          direction: string
          guardian_id: string | null
          id: string
          media_url: string | null
          patient_id: string
          read_at: string | null
          related_appointment_id: string | null
          sender_type: string
          sent_at: string | null
          template_key: string | null
          twilio_sid: string | null
        }
        Insert: {
          body?: string | null
          channel: string
          conversation_id?: string | null
          delivered_at?: string | null
          delivery_status?: string | null
          direction: string
          guardian_id?: string | null
          id?: string
          media_url?: string | null
          patient_id: string
          read_at?: string | null
          related_appointment_id?: string | null
          sender_type?: string
          sent_at?: string | null
          template_key?: string | null
          twilio_sid?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          conversation_id?: string | null
          delivered_at?: string | null
          delivery_status?: string | null
          direction?: string
          guardian_id?: string | null
          id?: string
          media_url?: string | null
          patient_id?: string
          read_at?: string | null
          related_appointment_id?: string | null
          sender_type?: string
          sent_at?: string | null
          template_key?: string | null
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "twilio_conversations"
            referencedColumns: ["id"]
          },
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
      nps_surveys: {
        Row: {
          alert_status: string
          alert_updated_at: string | null
          alert_updated_by: string | null
          appointment_id: string | null
          created_at: string
          dispatched_at: string
          feedback_text: string | null
          guardian_id: string
          id: string
          meeting_id: string | null
          patient_id: string
          phone_number: string
          responded_at: string | null
          score: number | null
        }
        Insert: {
          alert_status?: string
          alert_updated_at?: string | null
          alert_updated_by?: string | null
          appointment_id?: string | null
          created_at?: string
          dispatched_at?: string
          feedback_text?: string | null
          guardian_id: string
          id?: string
          meeting_id?: string | null
          patient_id: string
          phone_number: string
          responded_at?: string | null
          score?: number | null
        }
        Update: {
          alert_status?: string
          alert_updated_at?: string | null
          alert_updated_by?: string | null
          appointment_id?: string | null
          created_at?: string
          dispatched_at?: string
          feedback_text?: string | null
          guardian_id?: string
          id?: string
          meeting_id?: string | null
          patient_id?: string
          phone_number?: string
          responded_at?: string | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nps_surveys_alert_updated_by_fkey"
            columns: ["alert_updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_surveys_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_surveys_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_surveys_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_surveys_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_access: {
        Row: {
          access_type: string
          discipline: string | null
          granted_at: string
          granted_by: string | null
          id: string
          patient_id: string
          profile_id: string
          revoked_at: string | null
          role_in_team: string | null
        }
        Insert: {
          access_type: string
          discipline?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          patient_id: string
          profile_id: string
          revoked_at?: string | null
          role_in_team?: string | null
        }
        Update: {
          access_type?: string
          discipline?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          patient_id?: string
          profile_id?: string
          revoked_at?: string | null
          role_in_team?: string | null
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
      patient_charges: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          id: string
          paid_at: string | null
          patient_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          description: string
          due_date?: string | null
          id?: string
          paid_at?: string | null
          patient_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          id?: string
          paid_at?: string | null
          patient_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_charges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_charges_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
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
      patient_tags: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string
          patient_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          patient_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_tags_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address_bairro: string | null
          address_cep: string | null
          address_cidade: string | null
          address_complemento: string | null
          address_logradouro: string | null
          address_numero: string | null
          address_uf: string | null
          birth_date: string
          cid: string | null
          clinic_id: string
          complaint: string | null
          contract_sent_at: string | null
          contract_signed_at: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          entry_source: string | null
          evaluated_at: string | null
          first_contact_at: string | null
          first_session_at: string | null
          full_name: string
          id: string
          naturalidade: string | null
          payment_confirmed_at: string | null
          sexo: string | null
          status: string
          support_level: string | null
          whatsapp_group_added_at: string | null
        }
        Insert: {
          address_bairro?: string | null
          address_cep?: string | null
          address_cidade?: string | null
          address_complemento?: string | null
          address_logradouro?: string | null
          address_numero?: string | null
          address_uf?: string | null
          birth_date: string
          cid?: string | null
          clinic_id: string
          complaint?: string | null
          contract_sent_at?: string | null
          contract_signed_at?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          entry_source?: string | null
          evaluated_at?: string | null
          first_contact_at?: string | null
          first_session_at?: string | null
          full_name: string
          id?: string
          naturalidade?: string | null
          payment_confirmed_at?: string | null
          sexo?: string | null
          status?: string
          support_level?: string | null
          whatsapp_group_added_at?: string | null
        }
        Update: {
          address_bairro?: string | null
          address_cep?: string | null
          address_cidade?: string | null
          address_complemento?: string | null
          address_logradouro?: string | null
          address_numero?: string | null
          address_uf?: string | null
          birth_date?: string
          cid?: string | null
          clinic_id?: string
          complaint?: string | null
          contract_sent_at?: string | null
          contract_signed_at?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          entry_source?: string | null
          evaluated_at?: string | null
          first_contact_at?: string | null
          first_session_at?: string | null
          full_name?: string
          id?: string
          naturalidade?: string | null
          payment_confirmed_at?: string | null
          sexo?: string | null
          status?: string
          support_level?: string | null
          whatsapp_group_added_at?: string | null
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
      pending_queue_assignments: {
        Row: {
          assigned_to: string | null
          category: string
          clinic_id: string
          created_at: string
          due_at: string
          escalated_at: string | null
          id: string
          item_id: string
          patient_id: string | null
          resolved_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          category: string
          clinic_id: string
          created_at?: string
          due_at: string
          escalated_at?: string | null
          id?: string
          item_id: string
          patient_id?: string | null
          resolved_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string
          clinic_id?: string
          created_at?: string
          due_at?: string
          escalated_at?: string | null
          id?: string
          item_id?: string
          patient_id?: string | null
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_queue_assignments_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_queue_assignments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_queue_assignments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
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
          horizon: string | null
          id: string
          methodology: string | null
          status: string
          strategy: string | null
          supervisor_notes: string | null
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
          horizon?: string | null
          id?: string
          methodology?: string | null
          status?: string
          strategy?: string | null
          supervisor_notes?: string | null
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
          horizon?: string | null
          id?: string
          methodology?: string | null
          status?: string
          strategy?: string | null
          supervisor_notes?: string | null
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
      professional_documents: {
        Row: {
          content: string
          created_at: string | null
          doc_key: string
          meta: Json | null
          professional_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          doc_key: string
          meta?: Json | null
          professional_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          doc_key?: string
          meta?: Json | null
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_documents_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_pins: {
        Row: {
          failed_attempts: number
          locked_until: string | null
          pin_hash: string
          professional_id: string
          updated_at: string | null
        }
        Insert: {
          failed_attempts?: number
          locked_until?: string | null
          pin_hash: string
          professional_id: string
          updated_at?: string | null
        }
        Update: {
          failed_attempts?: number
          locked_until?: string | null
          pin_hash?: string
          professional_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_pins_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: true
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_presence: {
        Row: {
          action: string
          auth_method: string
          created_at: string | null
          created_by: string | null
          geo: Json | null
          id: string
          note: string | null
          professional_id: string | null
          professional_name: string | null
          timestamp: string
          unit_id: string | null
        }
        Insert: {
          action: string
          auth_method?: string
          created_at?: string | null
          created_by?: string | null
          geo?: Json | null
          id?: string
          note?: string | null
          professional_id?: string | null
          professional_name?: string | null
          timestamp?: string
          unit_id?: string | null
        }
        Update: {
          action?: string
          auth_method?: string
          created_at?: string | null
          created_by?: string | null
          geo?: Json | null
          id?: string
          note?: string | null
          professional_id?: string | null
          professional_name?: string | null
          timestamp?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_presence_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_presence_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_self_registration_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          professional_id: string
          token_hash: string
          uploads_used: number
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          professional_id: string
          token_hash: string
          uploads_used?: number
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          professional_id?: string
          token_hash?: string
          uploads_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_self_registration_tokens_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: true
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          active: boolean
          autonomy_declaration_accepted_at: string | null
          autonomy_declaration_version: string | null
          bank_account: string | null
          bank_account_type: string | null
          bank_agency: string | null
          bank_name: string | null
          birthdate: string | null
          cnae_principal: string | null
          cnpj: string | null
          contract_end: string | null
          contract_notes: string | null
          contract_start: string | null
          council_number: string | null
          council_type: string | null
          council_uf: string | null
          council_validity: string | null
          cpf: string | null
          created_at: string | null
          email: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_complemento: string | null
          endereco_logradouro: string | null
          endereco_numero: string | null
          endereco_uf: string | null
          id: string
          inscricao_municipal: string | null
          lgpd_consent_accepted_at: string | null
          name: string
          natureza_juridica: string | null
          nome_fantasia: string | null
          notice_days: number | null
          payment_day: number | null
          phone: string | null
          photo: string | null
          pix_key: string | null
          profession: string | null
          razao_social: string | null
          registration_status: string
          remuneration_model: string | null
          remuneration_value: number | null
          rep_birthdate: string | null
          rep_cpf: string | null
          rep_email: string | null
          rep_name: string | null
          rep_phone: string | null
          rep_rg: string | null
          rep_role: string | null
          self_registered_at: string | null
          service_description: string | null
          specialties: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          unit_id: string
        }
        Insert: {
          active?: boolean
          autonomy_declaration_accepted_at?: string | null
          autonomy_declaration_version?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          birthdate?: string | null
          cnae_principal?: string | null
          cnpj?: string | null
          contract_end?: string | null
          contract_notes?: string | null
          contract_start?: string | null
          council_number?: string | null
          council_type?: string | null
          council_uf?: string | null
          council_validity?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          endereco_uf?: string | null
          id?: string
          inscricao_municipal?: string | null
          lgpd_consent_accepted_at?: string | null
          name: string
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          notice_days?: number | null
          payment_day?: number | null
          phone?: string | null
          photo?: string | null
          pix_key?: string | null
          profession?: string | null
          razao_social?: string | null
          registration_status?: string
          remuneration_model?: string | null
          remuneration_value?: number | null
          rep_birthdate?: string | null
          rep_cpf?: string | null
          rep_email?: string | null
          rep_name?: string | null
          rep_phone?: string | null
          rep_rg?: string | null
          rep_role?: string | null
          self_registered_at?: string | null
          service_description?: string | null
          specialties?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          unit_id: string
        }
        Update: {
          active?: boolean
          autonomy_declaration_accepted_at?: string | null
          autonomy_declaration_version?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          birthdate?: string | null
          cnae_principal?: string | null
          cnpj?: string | null
          contract_end?: string | null
          contract_notes?: string | null
          contract_start?: string | null
          council_number?: string | null
          council_type?: string | null
          council_uf?: string | null
          council_validity?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          endereco_uf?: string | null
          id?: string
          inscricao_municipal?: string | null
          lgpd_consent_accepted_at?: string | null
          name?: string
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          notice_days?: number | null
          payment_day?: number | null
          phone?: string | null
          photo?: string | null
          pix_key?: string | null
          profession?: string | null
          razao_social?: string | null
          registration_status?: string
          remuneration_model?: string | null
          remuneration_value?: number | null
          rep_birthdate?: string | null
          rep_cpf?: string | null
          rep_email?: string | null
          rep_name?: string | null
          rep_phone?: string | null
          rep_rg?: string | null
          rep_role?: string | null
          self_registered_at?: string | null
          service_description?: string | null
          specialties?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professionals_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
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
          discipline: string | null
          esdm_certified: boolean
          full_name: string
          id: string
          is_rt: boolean
          phone: string | null
          role: string
          signature_pin_failed_attempts: number
          signature_pin_hash: string | null
          signature_pin_locked_until: string | null
          signature_pin_updated_at: string | null
        }
        Insert: {
          active?: boolean
          clinic_id: string
          council_number?: string | null
          council_type?: string | null
          created_at?: string
          discipline?: string | null
          esdm_certified?: boolean
          full_name: string
          id: string
          is_rt?: boolean
          phone?: string | null
          role: string
          signature_pin_failed_attempts?: number
          signature_pin_hash?: string | null
          signature_pin_locked_until?: string | null
          signature_pin_updated_at?: string | null
        }
        Update: {
          active?: boolean
          clinic_id?: string
          council_number?: string | null
          council_type?: string | null
          created_at?: string
          discipline?: string | null
          esdm_certified?: boolean
          full_name?: string
          id?: string
          is_rt?: boolean
          phone?: string | null
          role?: string
          signature_pin_failed_attempts?: number
          signature_pin_hash?: string | null
          signature_pin_locked_until?: string | null
          signature_pin_updated_at?: string | null
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
          area: string | null
          clinic_id: string
          digitization_risk_accepted_at: string
          digitization_risk_accepted_by: string
          display_name: string | null
          id: string
          is_validated: boolean
          license_note: string | null
          license_purchased_at: string | null
          name: string
          version: string | null
        }
        Insert: {
          area?: string | null
          clinic_id: string
          digitization_risk_accepted_at: string
          digitization_risk_accepted_by: string
          display_name?: string | null
          id?: string
          is_validated?: boolean
          license_note?: string | null
          license_purchased_at?: string | null
          name: string
          version?: string | null
        }
        Update: {
          area?: string | null
          clinic_id?: string
          digitization_risk_accepted_at?: string
          digitization_risk_accepted_by?: string
          display_name?: string | null
          id?: string
          is_validated?: boolean
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
      quick_responses: {
        Row: {
          clinic_id: string
          content_text: string
          created_at: string
          created_by: string | null
          id: string
          shortcut: string
          title: string
        }
        Insert: {
          clinic_id: string
          content_text: string
          created_at?: string
          created_by?: string | null
          id?: string
          shortcut: string
          title: string
        }
        Update: {
          clinic_id?: string
          content_text?: string
          created_at?: string
          created_by?: string | null
          id?: string
          shortcut?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_responses_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_responses_created_by_fkey"
            columns: ["created_by"]
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
      registration_draft_files: {
        Row: {
          created_at: string
          detected_type: string | null
          document_id: string | null
          draft_id: string
          id: string
          mime_type: string
          original_name: string | null
          size_bytes: number | null
          storage_path: string
          twilio_media_url: string | null
        }
        Insert: {
          created_at?: string
          detected_type?: string | null
          document_id?: string | null
          draft_id: string
          id?: string
          mime_type: string
          original_name?: string | null
          size_bytes?: number | null
          storage_path: string
          twilio_media_url?: string | null
        }
        Update: {
          created_at?: string
          detected_type?: string | null
          document_id?: string | null
          draft_id?: string
          id?: string
          mime_type?: string
          original_name?: string | null
          size_bytes?: number | null
          storage_path?: string
          twilio_media_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registration_draft_files_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_draft_files_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "registration_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_drafts: {
        Row: {
          attempts: number
          clinic_id: string
          created_at: string
          error: string | null
          extracted: Json | null
          fields_confidence: Json | null
          guardian_id: string | null
          guardian_message: string | null
          id: string
          last_file_at: string
          locked_at: string | null
          model: string | null
          patient_id: string | null
          processed_at: string | null
          processing_started_at: string | null
          reject_reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          source: string
          source_phone: string | null
          status: string
          submitted_by: string | null
          validated_at: string | null
          validated_by: string | null
          warnings: string[]
        }
        Insert: {
          attempts?: number
          clinic_id: string
          created_at?: string
          error?: string | null
          extracted?: Json | null
          fields_confidence?: Json | null
          guardian_id?: string | null
          guardian_message?: string | null
          id?: string
          last_file_at?: string
          locked_at?: string | null
          model?: string | null
          patient_id?: string | null
          processed_at?: string | null
          processing_started_at?: string | null
          reject_reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          source: string
          source_phone?: string | null
          status?: string
          submitted_by?: string | null
          validated_at?: string | null
          validated_by?: string | null
          warnings?: string[]
        }
        Update: {
          attempts?: number
          clinic_id?: string
          created_at?: string
          error?: string | null
          extracted?: Json | null
          fields_confidence?: Json | null
          guardian_id?: string | null
          guardian_message?: string | null
          id?: string
          last_file_at?: string
          locked_at?: string | null
          model?: string | null
          patient_id?: string | null
          processed_at?: string | null
          processing_started_at?: string | null
          reject_reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          source?: string
          source_phone?: string | null
          status?: string
          submitted_by?: string | null
          validated_at?: string | null
          validated_by?: string | null
          warnings?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "registration_drafts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_drafts_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_drafts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_drafts_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_drafts_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_drafts_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reschedule_requests: {
        Row: {
          appointment_id: string
          created_at: string
          id: string
          message: string
          requested_by: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          id?: string
          message: string
          requested_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          id?: string
          message?: string
          requested_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reschedule_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reschedule_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reschedule_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      session_intervention_logs: {
        Row: {
          appointment_id: string
          description: string | null
          id: string
          intervention_value: string
          patient_id: string
          recorded_at: string
          resultado: string | null
          therapist_id: string
        }
        Insert: {
          appointment_id: string
          description?: string | null
          id?: string
          intervention_value: string
          patient_id: string
          recorded_at?: string
          resultado?: string | null
          therapist_id: string
        }
        Update: {
          appointment_id?: string
          description?: string | null
          id?: string
          intervention_value?: string
          patient_id?: string
          recorded_at?: string
          resultado?: string | null
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_intervention_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_intervention_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_intervention_logs_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_note_media: {
        Row: {
          appointment_id: string
          created_at: string
          id: string
          mime_type: string
          patient_id: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          id?: string
          mime_type: string
          patient_id: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          id?: string
          mime_type?: string
          patient_id?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_note_media_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_note_media_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_note_media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_notes: {
        Row: {
          appointment_id: string
          created_at_device: string
          created_at_server: string
          edit_justification: string | null
          free_text: string | null
          id: string
          opened_at: string | null
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
          edit_justification?: string | null
          free_text?: string | null
          id?: string
          opened_at?: string | null
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
          edit_justification?: string | null
          free_text?: string | null
          id?: string
          opened_at?: string | null
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
            foreignKeyName: "session_notes_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "v_session_note_sign_duration"
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
      system_user_audit: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          detail: Json
          id: string
          target_email: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          target_email?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          target_email?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      system_user_permissions: {
        Row: {
          notes: string | null
          permissions: Json
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          notes?: string | null
          permissions?: Json
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          notes?: string | null
          permissions?: Json
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
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
          delivered_at: string | null
          delivered_by: string | null
          discipline_mix: Json
          family_accepted_at: string | null
          family_priorities: string | null
          general_objective: string | null
          id: string
          patient_id: string
          previous_plan_id: string | null
          review_due_at: string | null
          status: string
          supervisor_notes: string | null
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          delivered_at?: string | null
          delivered_by?: string | null
          discipline_mix?: Json
          family_accepted_at?: string | null
          family_priorities?: string | null
          general_objective?: string | null
          id?: string
          patient_id: string
          previous_plan_id?: string | null
          review_due_at?: string | null
          status?: string
          supervisor_notes?: string | null
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          delivered_at?: string | null
          delivered_by?: string | null
          discipline_mix?: Json
          family_accepted_at?: string | null
          family_priorities?: string | null
          general_objective?: string | null
          id?: string
          patient_id?: string
          previous_plan_id?: string | null
          review_due_at?: string | null
          status?: string
          supervisor_notes?: string | null
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
            foreignKeyName: "treatment_plans_delivered_by_fkey"
            columns: ["delivered_by"]
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
          {
            foreignKeyName: "treatment_plans_previous_plan_id_fkey"
            columns: ["previous_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
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
      twilio_conversations: {
        Row: {
          assigned_to: string | null
          conversation_sid: string | null
          created_at: string
          guardian_id: string | null
          id: string
          is_bot_active: boolean
          last_message_at: string | null
          patient_id: string
          phone_number: string
          status: string
          unread_count: number
        }
        Insert: {
          assigned_to?: string | null
          conversation_sid?: string | null
          created_at?: string
          guardian_id?: string | null
          id?: string
          is_bot_active?: boolean
          last_message_at?: string | null
          patient_id: string
          phone_number: string
          status?: string
          unread_count?: number
        }
        Update: {
          assigned_to?: string | null
          conversation_sid?: string | null
          created_at?: string
          guardian_id?: string | null
          id?: string
          is_bot_active?: boolean
          last_message_at?: string | null
          patient_id?: string
          phone_number?: string
          status?: string
          unread_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "twilio_conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twilio_conversations_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twilio_conversations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          address: string | null
          biometric_required: boolean
          clt_custom_contract_text: string | null
          clt_enabled: boolean
          clt_geofence_required: boolean
          clt_kiosk_email: string | null
          clt_self_registration_enabled: boolean
          clt_tolerance_minutes: number
          cnpj: string | null
          contrato_pj_custom_text: string | null
          created_at: string | null
          declaracao_custom_text: string | null
          ficha_custom_text: string | null
          id: string
          kiosk_email: string | null
          lat: number
          lng: number
          logo_url: string | null
          name: string
          pae_custom_text: string | null
          phone: string | null
          pj_enabled: boolean
          pj_kiosk_email: string | null
          pj_self_registration_enabled: boolean
          radius_km: number
          radius_m: number
          razao_social: string | null
          tce_custom_text: string | null
          workspace_id: string
        }
        Insert: {
          address?: string | null
          biometric_required?: boolean
          clt_custom_contract_text?: string | null
          clt_enabled?: boolean
          clt_geofence_required?: boolean
          clt_kiosk_email?: string | null
          clt_self_registration_enabled?: boolean
          clt_tolerance_minutes?: number
          cnpj?: string | null
          contrato_pj_custom_text?: string | null
          created_at?: string | null
          declaracao_custom_text?: string | null
          ficha_custom_text?: string | null
          id: string
          kiosk_email?: string | null
          lat: number
          lng: number
          logo_url?: string | null
          name: string
          pae_custom_text?: string | null
          phone?: string | null
          pj_enabled?: boolean
          pj_kiosk_email?: string | null
          pj_self_registration_enabled?: boolean
          radius_km?: number
          radius_m?: number
          razao_social?: string | null
          tce_custom_text?: string | null
          workspace_id?: string
        }
        Update: {
          address?: string | null
          biometric_required?: boolean
          clt_custom_contract_text?: string | null
          clt_enabled?: boolean
          clt_geofence_required?: boolean
          clt_kiosk_email?: string | null
          clt_self_registration_enabled?: boolean
          clt_tolerance_minutes?: number
          cnpj?: string | null
          contrato_pj_custom_text?: string | null
          created_at?: string | null
          declaracao_custom_text?: string | null
          ficha_custom_text?: string | null
          id?: string
          kiosk_email?: string | null
          lat?: number
          lng?: number
          logo_url?: string | null
          name?: string
          pae_custom_text?: string | null
          phone?: string | null
          pj_enabled?: boolean
          pj_kiosk_email?: string | null
          pj_self_registration_enabled?: boolean
          radius_km?: number
          radius_m?: number
          razao_social?: string | null
          tce_custom_text?: string | null
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
      voice_emergency_broadcasts: {
        Row: {
          created_at: string
          id: string
          message_template: string
          occurrence_date: string
          shift: string | null
          supervisor_id: string
          therapist_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_template: string
          occurrence_date: string
          shift?: string | null
          supervisor_id: string
          therapist_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_template?: string
          occurrence_date?: string
          shift?: string | null
          supervisor_id?: string
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_emergency_broadcasts_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_emergency_broadcasts_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_emergency_logs: {
        Row: {
          attempt_number: number
          broadcast_id: string
          call_sid: string | null
          call_status: string
          created_at: string
          fallback_sent: boolean
          guardian_id: string | null
          id: string
          patient_id: string
          phone_number: string
          updated_at: string
        }
        Insert: {
          attempt_number?: number
          broadcast_id: string
          call_sid?: string | null
          call_status?: string
          created_at?: string
          fallback_sent?: boolean
          guardian_id?: string | null
          id?: string
          patient_id: string
          phone_number: string
          updated_at?: string
        }
        Update: {
          attempt_number?: number
          broadcast_id?: string
          call_sid?: string | null
          call_status?: string
          created_at?: string
          fallback_sent?: boolean
          guardian_id?: string | null
          id?: string
          patient_id?: string
          phone_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_emergency_logs_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "voice_emergency_broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_emergency_logs_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_emergency_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
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
      v_contribution_margin: {
        Row: {
          clinic_id: string | null
          competence_month: string | null
          contribution_margin: number | null
          gross_revenue: number | null
          margin_percentage: number | null
          total_therapist_payout: number | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      v_insurer_concentration: {
        Row: {
          clinic_id: string | null
          concentration_pct: number | null
          insurer_id: string | null
          insurer_name: string | null
          patient_count: number | null
          total_patients: number | null
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
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ltv_months: {
        Row: {
          avg_ltv_months: number | null
          clinic_id: string | null
          total_discharged_patients: number | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      v_payout_ratio: {
        Row: {
          clinic_id: string | null
          competence_month: string | null
          gross_revenue: number | null
          payout_ratio_pct: number | null
          total_payouts: number | null
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
      v_revenue_per_room_hour: {
        Row: {
          clinic_id: string | null
          competence_month: string | null
          revenue_per_hour: number | null
          total_revenue: number | null
          total_room_hours: number | null
          total_sessions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      v_session_note_sign_duration: {
        Row: {
          appointment_id: string | null
          created_at_server: string | null
          id: string | null
          patient_id: string | null
          seconds_to_sign: number | null
          therapist_id: string | null
          version: number | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
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
      accept_family_lgpd_consent: { Args: never; Returns: undefined }
      accept_professional_terms: {
        Args: { p_pin: string; p_professional_id: string; p_version: string }
        Returns: undefined
      }
      app_current_role: { Args: never; Returns: string }
      assert_system_user_admin: {
        Args: { p_workspace_scope: Json }
        Returns: undefined
      }
      attach_employee_self_registration_document: {
        Args: {
          p_content: string
          p_doc_key: string
          p_employee_id: string
          p_meta?: Json
          p_token: string
        }
        Returns: Json
      }
      attach_professional_self_registration_document: {
        Args: {
          p_content: string
          p_doc_key: string
          p_meta?: Json
          p_professional_id: string
          p_token: string
        }
        Returns: Json
      }
      auto_resolve_appointments: { Args: never; Returns: undefined }
      book_anamnesis_slot_atomic: {
        Args: {
          p_discipline?: string
          p_ends_at: string
          p_request_id: string
          p_room_id: string
          p_starts_at: string
          p_therapist_id: string
        }
        Returns: Json
      }
      book_intake_lead_slot_atomic: {
        Args: {
          p_discipline?: string
          p_ends_at: string
          p_lead_id: string
          p_room_id: string
          p_starts_at: string
          p_therapist_id: string
        }
        Returns: Json
      }
      change_intern_password: {
        Args: { p_intern_id: string; p_new_password: string }
        Returns: undefined
      }
      change_professional_pin: {
        Args: {
          p_current_pin: string
          p_new_pin: string
          p_professional_id: string
        }
        Returns: undefined
      }
      claim_insurance_intake_batches: {
        Args: { p_batch_id?: string; p_limit?: number }
        Returns: {
          attempts: number
          clinic_id: string
          created_at: string
          detected_insurer_name: string | null
          error: string | null
          extracted: Json | null
          id: string
          insurer_id: string | null
          leads_count: number
          locked_at: string | null
          mime_type: string
          model: string | null
          original_name: string | null
          processed_at: string | null
          size_bytes: number | null
          status: string
          storage_path: string
          uploaded_by: string | null
          warnings: string[]
        }[]
        SetofOptions: {
          from: "*"
          to: "insurance_intake_batches"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_registration_drafts: {
        Args: { p_draft_id?: string; p_limit?: number }
        Returns: {
          attempts: number
          clinic_id: string
          created_at: string
          error: string | null
          extracted: Json | null
          fields_confidence: Json | null
          guardian_id: string | null
          guardian_message: string | null
          id: string
          last_file_at: string
          locked_at: string | null
          model: string | null
          patient_id: string | null
          processed_at: string | null
          processing_started_at: string | null
          reject_reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          source: string
          source_phone: string | null
          status: string
          submitted_by: string | null
          validated_at: string | null
          validated_by: string | null
          warnings: string[]
        }[]
        SetofOptions: {
          from: "*"
          to: "registration_drafts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      close_employee_timesheet: {
        Args: { p_competencia: string; p_employee_id: string; p_summary?: Json }
        Returns: undefined
      }
      close_monthly_metric_snapshots: { Args: never; Returns: undefined }
      close_monthly_payouts: { Args: never; Returns: undefined }
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
      confirm_attendance: {
        Args: { p_appointment_id: string }
        Returns: undefined
      }
      create_employee_self_registration: {
        Args: {
          p_address: Json
          p_bank_account: string
          p_bank_account_type: string
          p_bank_agency: string
          p_bank_name: string
          p_biometric_consent_accepted: boolean
          p_biometric_consent_version: string
          p_birthdate: string
          p_birthplace: string
          p_cnh: string
          p_cnh_category: string
          p_cpf: string
          p_ctps_number: string
          p_ctps_series: string
          p_ctps_uf: string
          p_dependents: Json
          p_education: string
          p_email: string
          p_face_descriptor: string
          p_father_name: string
          p_lgpd_consent_accepted: boolean
          p_marital_status: string
          p_mother_name: string
          p_name: string
          p_nationality: string
          p_phone: string
          p_pis: string
          p_pix_key: string
          p_reservist_cert: string
          p_rg: string
          p_rg_issuer: string
          p_sex: string
          p_unit_id: string
          p_voter_title: string
        }
        Returns: Json
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
      create_professional_self_registration: {
        Args: {
          p_autonomy_declaration_accepted: boolean
          p_autonomy_declaration_version: string
          p_bank_account: string
          p_bank_account_type: string
          p_bank_agency: string
          p_bank_name: string
          p_cnae_principal: string
          p_cnpj: string
          p_contract_start: string
          p_council_number: string
          p_council_type: string
          p_council_uf: string
          p_council_validity: string
          p_email: string
          p_endereco_bairro: string
          p_endereco_cep: string
          p_endereco_cidade: string
          p_endereco_complemento: string
          p_endereco_logradouro: string
          p_endereco_numero: string
          p_endereco_uf: string
          p_inscricao_municipal: string
          p_lgpd_consent_accepted: boolean
          p_name: string
          p_natureza_juridica: string
          p_nome_fantasia: string
          p_notice_days: number
          p_payment_day: number
          p_phone: string
          p_pix_key: string
          p_profession: string
          p_razao_social: string
          p_remuneration_model: string
          p_remuneration_value: number
          p_rep_birthdate: string
          p_rep_cpf: string
          p_rep_email: string
          p_rep_name: string
          p_rep_phone: string
          p_rep_rg: string
          p_rep_role: string
          p_service_description: string
          p_specialties: string
          p_unit_id: string
        }
        Returns: Json
      }
      create_system_user: {
        Args: {
          p_email: string
          p_name: string
          p_notes?: string
          p_password: string
          p_permissions?: Json
          p_role: string
          p_unit_id?: string
          p_workspace_scope?: Json
        }
        Returns: string
      }
      current_clinic_id: { Args: never; Returns: string }
      delete_intern_user: { Args: { p_intern_id: string }; Returns: undefined }
      delete_system_user: { Args: { p_user_id: string }; Returns: undefined }
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
      escalate_overdue_queue_items: { Args: never; Returns: number }
      fail:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      family_guidance_feed: {
        Args: { p_limit?: number; p_patient_id: string }
        Returns: {
          appointment_id: string
          orientacoes: string[]
          starts_at: string
        }[]
      }
      findfuncs: { Args: { "": string }; Returns: string[] }
      finish: { Args: { exception_on_failure?: boolean }; Returns: string[] }
      format_type_string: { Args: { "": string }; Returns: string }
      generate_from_recurrence_anchor: {
        Args: { p_recurrence_id: string; p_weeks_ahead?: number }
        Returns: {
          created: boolean
          error: string
          starts_at: string
        }[]
      }
      generate_recurrence_sessions: {
        Args: {
          p_appointment_type_id: string
          p_authorization_id: string
          p_discipline: string
          p_duration_minutes: number
          p_from_date?: string
          p_is_provisional: boolean
          p_modality: string
          p_patient_id: string
          p_recurrence_id: string
          p_room_id: string
          p_therapist_id: string
          p_time_of_day: string
          p_weekday: number
          p_weeks_ahead?: number
        }
        Returns: {
          created: boolean
          error: string
          starts_at: string
        }[]
      }
      get_employee_kiosk_roster: {
        Args: { p_unit?: string }
        Returns: {
          biometric_consent_at: string
          face_descriptor: string
          id: string
          last_ts: string
          last_type: string
          name: string
          photo: string
        }[]
      }
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
      is_valid_professional_pin: { Args: { p_pin: string }; Returns: boolean }
      isnt_empty: { Args: { "": string }; Returns: string }
      jwt_has_workspace_access: {
        Args: { target_workspace: string }
        Returns: boolean
      }
      jwt_intern_self_workspace: { Args: never; Returns: string }
      jwt_is_employee_kiosk_for_unit: {
        Args: { target_unit: string }
        Returns: boolean
      }
      jwt_is_professional_kiosk_for_unit: {
        Args: { target_unit: string }
        Returns: boolean
      }
      jwt_is_supervisor_for_unit: {
        Args: { target_unit: string }
        Returns: boolean
      }
      jwt_own_unit_workspace: { Args: never; Returns: string }
      list_system_user_audit: { Args: { p_limit?: number }; Returns: Json }
      list_system_users: { Args: never; Returns: Json }
      lives_ok: { Args: { "": string }; Returns: string }
      log_patient_access: {
        Args: { p_patient_id: string; p_reason?: string }
        Returns: undefined
      }
      log_system_user_action: {
        Args: {
          p_action: string
          p_detail?: Json
          p_target_email: string
          p_target_user_id: string
        }
        Returns: undefined
      }
      no_plan: { Args: never; Returns: boolean[] }
      num_failed: { Args: never; Returns: number }
      os_name: { Args: never; Returns: string }
      pass:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      patient_absence_stats: {
        Args: { p_patient_id: string }
        Returns: {
          consecutive_faltas: number
          faltas_pct_3m: number
        }[]
      }
      patient_authorization_summary: {
        Args: { p_patient_id: string }
        Returns: {
          authorization_id: string
          guide_number: string
          insurer_name: string
          patient_insurance_id: string
          procedure_code: string
          sessions_authorized: number
          sessions_used: number
          status: string
          valid_from: string
          valid_to: string
        }[]
      }
      patient_contact_summary: {
        Args: { p_patient_id: string }
        Returns: {
          guardian_id: string
          guardian_name: string
          image_consent: boolean
          is_emergency_contact: boolean
          is_financial: boolean
          phone: string
          relationship: string
        }[]
      }
      patient_status_as_of: {
        Args: { p_at: string; p_patient_id: string }
        Returns: string
      }
      pg_version: { Args: never; Returns: string }
      pg_version_num: { Args: never; Returns: number }
      pgtap_version: { Args: never; Returns: number }
      professional_has_pin: {
        Args: { p_professional_id: string }
        Returns: boolean
      }
      pts_review_due_at: { Args: { p_patient_id: string }; Returns: string }
      refresh_absence_alerts: { Args: never; Returns: number }
      refresh_authorization_renewal_requests: { Args: never; Returns: number }
      refresh_glosa_patterns: { Args: never; Returns: number }
      refresh_reassessment_alerts: { Args: never; Returns: undefined }
      regenerate_active_grade_sessions: {
        Args: { p_weeks_ahead?: number }
        Returns: undefined
      }
      register_employee_time_record: {
        Args: {
          p_biometric?: Json
          p_employee_id: string
          p_geo?: Json
          p_photo?: string
          p_type: string
        }
        Returns: Json
      }
      register_professional_presence: {
        Args: {
          p_action: string
          p_geo?: Json
          p_note?: string
          p_pin: string
          p_professional_id: string
        }
        Returns: Json
      }
      reset_intern_password: {
        Args: { p_intern_id: string; p_new_password: string }
        Returns: undefined
      }
      reset_system_user_password: {
        Args: { p_new_password: string; p_user_id: string }
        Returns: undefined
      }
      runtests:
        | { Args: never; Returns: string[] }
        | { Args: { "": string }; Returns: string[] }
      seed_intake_steps: { Args: { p_patient_id: string }; Returns: undefined }
      session_note_pending: {
        Args: { p_appointment_id: string }
        Returns: boolean
      }
      set_family_image_consent: {
        Args: { p_consent: boolean }
        Returns: undefined
      }
      set_insurer_intake_profile: {
        Args: { p_insurer_id: string; p_profile: Json }
        Returns: undefined
      }
      set_intake_step_complete: {
        Args: {
          p_completed_by?: string
          p_patient_id: string
          p_step_key: string
        }
        Returns: undefined
      }
      set_intake_step_na: {
        Args: { p_patient_id: string; p_step_key: string }
        Returns: undefined
      }
      set_professional_pin: {
        Args: { p_pin: string; p_professional_id: string }
        Returns: undefined
      }
      set_system_user_active: {
        Args: { p_active: boolean; p_user_id: string }
        Returns: undefined
      }
      skip:
        | { Args: { "": string }; Returns: string }
        | { Args: { how_many: number; why: string }; Returns: string }
      system_user_manageable_roles: { Args: never; Returns: string[] }
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
      update_system_user: {
        Args: {
          p_name?: string
          p_notes?: string
          p_permissions?: Json
          p_role?: string
          p_unit_id?: string
          p_user_id: string
          p_workspace_scope?: Json
        }
        Returns: undefined
      }
      upsert_metric_snapshot: {
        Args: {
          p_metric_key: string
          p_period_end: string
          p_period_start: string
          p_scope_id: string
          p_scope_type: string
          p_value: number
        }
        Returns: undefined
      }
      verify_professional_pin_internal: {
        Args: { p_pin: string; p_professional_id: string }
        Returns: undefined
      }
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
