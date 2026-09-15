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
      appointment_reminders: {
        Row: {
          appointment_id: string
          handled_at: string
          handled_by: string
          id: string
          reminder_type: Database["public"]["Enums"]["appointment_reminder_type"]
        }
        Insert: {
          appointment_id: string
          handled_at?: string
          handled_by: string
          id?: string
          reminder_type: Database["public"]["Enums"]["appointment_reminder_type"]
        }
        Update: {
          appointment_id?: string
          handled_at?: string
          handled_by?: string
          id?: string
          reminder_type?: Database["public"]["Enums"]["appointment_reminder_type"]
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reminders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_revisions: {
        Row: {
          appointment_id: string
          changed_at: string
          changed_by: string
          changed_by_role: Database["public"]["Enums"]["app_role"]
          ends_at: string
          id: string
          notes: string | null
          patient_id: string
          purpose: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          title: string
        }
        Insert: {
          appointment_id: string
          changed_at?: string
          changed_by: string
          changed_by_role: Database["public"]["Enums"]["app_role"]
          ends_at: string
          id?: string
          notes?: string | null
          patient_id: string
          purpose?: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          title: string
        }
        Update: {
          appointment_id?: string
          changed_at?: string
          changed_by?: string
          changed_by_role?: Database["public"]["Enums"]["app_role"]
          ends_at?: string
          id?: string
          notes?: string | null
          patient_id?: string
          purpose?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_revisions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_revisions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string
          ends_at: string
          id: string
          idempotency_key: string
          notes: string | null
          patient_id: string
          purpose: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          title: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by: string
          ends_at: string
          id?: string
          idempotency_key: string
          notes?: string | null
          patient_id: string
          purpose?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          title: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string
          ends_at?: string
          id?: string
          idempotency_key?: string
          notes?: string | null
          patient_id?: string
          purpose?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          title?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          metadata: Json
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          user_agent?: string | null
        }
        Relationships: []
      }
      blocked_ips: {
        Row: {
          blocked_by: string
          created_at: string
          expires_at: string | null
          id: string
          ip_address: unknown
          is_active: boolean
          reason: string
        }
        Insert: {
          blocked_by: string
          created_at?: string
          expires_at?: string | null
          id?: string
          ip_address: unknown
          is_active?: boolean
          reason: string
        }
        Update: {
          blocked_by?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          ip_address?: unknown
          is_active?: boolean
          reason?: string
        }
        Relationships: []
      }
      dental_finding_revisions: {
        Row: {
          changed_at: string
          changed_by: string
          changed_by_role: Database["public"]["Enums"]["app_role"]
          condition: Database["public"]["Enums"]["dental_condition"]
          dentition: Database["public"]["Enums"]["dentition_type"]
          event_type: Database["public"]["Enums"]["dental_finding_event"]
          finding_id: string
          id: string
          notes: string | null
          patient_id: string
          recommendation: string | null
          status: Database["public"]["Enums"]["dental_finding_status"]
          tooth_number: number
        }
        Insert: {
          changed_at?: string
          changed_by: string
          changed_by_role: Database["public"]["Enums"]["app_role"]
          condition: Database["public"]["Enums"]["dental_condition"]
          dentition: Database["public"]["Enums"]["dentition_type"]
          event_type: Database["public"]["Enums"]["dental_finding_event"]
          finding_id: string
          id?: string
          notes?: string | null
          patient_id: string
          recommendation?: string | null
          status: Database["public"]["Enums"]["dental_finding_status"]
          tooth_number: number
        }
        Update: {
          changed_at?: string
          changed_by?: string
          changed_by_role?: Database["public"]["Enums"]["app_role"]
          condition?: Database["public"]["Enums"]["dental_condition"]
          dentition?: Database["public"]["Enums"]["dentition_type"]
          event_type?: Database["public"]["Enums"]["dental_finding_event"]
          finding_id?: string
          id?: string
          notes?: string | null
          patient_id?: string
          recommendation?: string | null
          status?: Database["public"]["Enums"]["dental_finding_status"]
          tooth_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "dental_finding_revisions_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "dental_findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dental_finding_revisions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      dental_findings: {
        Row: {
          condition: Database["public"]["Enums"]["dental_condition"]
          created_at: string
          created_by: string
          dentition: Database["public"]["Enums"]["dentition_type"]
          id: string
          is_active: boolean
          notes: string | null
          patient_id: string
          recommendation: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["dental_finding_status"]
          tooth_number: number
          updated_at: string
          updated_by: string
        }
        Insert: {
          condition: Database["public"]["Enums"]["dental_condition"]
          created_at?: string
          created_by: string
          dentition?: Database["public"]["Enums"]["dentition_type"]
          id?: string
          is_active?: boolean
          notes?: string | null
          patient_id: string
          recommendation?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dental_finding_status"]
          tooth_number: number
          updated_at?: string
          updated_by: string
        }
        Update: {
          condition?: Database["public"]["Enums"]["dental_condition"]
          created_at?: string
          created_by?: string
          dentition?: Database["public"]["Enums"]["dentition_type"]
          id?: string
          is_active?: boolean
          notes?: string | null
          patient_id?: string
          recommendation?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dental_finding_status"]
          tooth_number?: number
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "dental_findings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_findings: {
        Row: {
          dental_finding_id: string
          intervention_id: string
        }
        Insert: {
          dental_finding_id: string
          intervention_id: string
        }
        Update: {
          dental_finding_id?: string
          intervention_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_findings_dental_finding_id_fkey"
            columns: ["dental_finding_id"]
            isOneToOne: false
            referencedRelation: "dental_findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_findings_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_revisions: {
        Row: {
          amount_due: number
          changed_at: string
          changed_by: string
          changed_by_role: Database["public"]["Enums"]["app_role"]
          id: string
          intervention_id: string
          nature: string
          notes: string | null
          patient_id: string
          performed_at: string
          status: Database["public"]["Enums"]["intervention_status"]
        }
        Insert: {
          amount_due: number
          changed_at?: string
          changed_by: string
          changed_by_role: Database["public"]["Enums"]["app_role"]
          id?: string
          intervention_id: string
          nature: string
          notes?: string | null
          patient_id: string
          performed_at: string
          status: Database["public"]["Enums"]["intervention_status"]
        }
        Update: {
          amount_due?: number
          changed_at?: string
          changed_by?: string
          changed_by_role?: Database["public"]["Enums"]["app_role"]
          id?: string
          intervention_id?: string
          nature?: string
          notes?: string | null
          patient_id?: string
          performed_at?: string
          status?: Database["public"]["Enums"]["intervention_status"]
        }
        Relationships: [
          {
            foreignKeyName: "intervention_revisions_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_revisions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_teeth: {
        Row: {
          intervention_id: string
          tooth_number: number
        }
        Insert: {
          intervention_id: string
          tooth_number: number
        }
        Update: {
          intervention_id?: string
          tooth_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "intervention_teeth_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      interventions: {
        Row: {
          amount_due: number
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string
          id: string
          idempotency_key: string
          nature: string
          notes: string | null
          patient_id: string
          performed_at: string
          status: Database["public"]["Enums"]["intervention_status"]
          updated_at: string
          updated_by: string
        }
        Insert: {
          amount_due: number
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by: string
          id?: string
          idempotency_key: string
          nature: string
          notes?: string | null
          patient_id: string
          performed_at: string
          status: Database["public"]["Enums"]["intervention_status"]
          updated_at?: string
          updated_by: string
        }
        Update: {
          amount_due?: number
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string
          id?: string
          idempotency_key?: string
          nature?: string
          notes?: string | null
          patient_id?: string
          performed_at?: string
          status?: Database["public"]["Enums"]["intervention_status"]
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "interventions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description_snapshot: string
          id: string
          intervention_id: string
          invoice_id: string
          line_total: number
          position: number
          quantity: number
          unit_amount: number
        }
        Insert: {
          created_at?: string
          description_snapshot: string
          id?: string
          intervention_id: string
          invoice_id: string
          line_total: number
          position: number
          quantity?: number
          unit_amount: number
        }
        Update: {
          created_at?: string
          description_snapshot?: string
          id?: string
          intervention_id?: string
          invoice_id?: string
          line_total?: number
          position?: number
          quantity?: number
          unit_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          clinic_name_snapshot: string
          created_at: string
          id: string
          idempotency_key: string
          invoice_number: string
          issued_at: string
          issued_by: string
          issuer_name_snapshot: string
          patient_address_snapshot: string | null
          patient_first_name_snapshot: string
          patient_id: string
          patient_last_name_snapshot: string
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          total: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          clinic_name_snapshot?: string
          created_at?: string
          id?: string
          idempotency_key: string
          invoice_number: string
          issued_at?: string
          issued_by: string
          issuer_name_snapshot: string
          patient_address_snapshot?: string | null
          patient_first_name_snapshot: string
          patient_id: string
          patient_last_name_snapshot: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          total: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          clinic_name_snapshot?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          invoice_number?: string
          issued_at?: string
          issued_by?: string
          issuer_name_snapshot?: string
          patient_address_snapshot?: string | null
          patient_first_name_snapshot?: string
          patient_id?: string
          patient_last_name_snapshot?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          total?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          allergy_notes: string | null
          archived_at: string | null
          created_at: string
          created_by: string
          date_of_birth: string | null
          first_name: string
          general_notes: string | null
          has_allergies: boolean
          has_medical_history: boolean
          has_mutuelle: boolean
          id: string
          is_active: boolean
          last_name: string
          medical_history_notes: string | null
          mutuelle_name: string | null
          phone: string
          profession: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          address?: string | null
          allergy_notes?: string | null
          archived_at?: string | null
          created_at?: string
          created_by: string
          date_of_birth?: string | null
          first_name: string
          general_notes?: string | null
          has_allergies?: boolean
          has_medical_history?: boolean
          has_mutuelle?: boolean
          id?: string
          is_active?: boolean
          last_name: string
          medical_history_notes?: string | null
          mutuelle_name?: string | null
          phone: string
          profession?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          address?: string | null
          allergy_notes?: string | null
          archived_at?: string | null
          created_at?: string
          created_by?: string
          date_of_birth?: string | null
          first_name?: string
          general_notes?: string | null
          has_allergies?: boolean
          has_medical_history?: boolean
          has_mutuelle?: boolean
          id?: string
          is_active?: boolean
          last_name?: string
          medical_history_notes?: string | null
          mutuelle_name?: string | null
          phone?: string
          profession?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      payment_receipts: {
        Row: {
          amount_snapshot: number
          clinic_name_snapshot: string
          created_at: string
          id: string
          idempotency_key: string
          issued_at: string
          issued_by: string
          issuer_name_snapshot: string
          patient_address_snapshot: string | null
          patient_first_name_snapshot: string
          patient_id: string
          patient_last_name_snapshot: string
          payment_id: string
          payment_method_snapshot: Database["public"]["Enums"]["payment_method"]
          payment_received_at_snapshot: string
          receipt_number: string
        }
        Insert: {
          amount_snapshot: number
          clinic_name_snapshot?: string
          created_at?: string
          id?: string
          idempotency_key: string
          issued_at?: string
          issued_by: string
          issuer_name_snapshot: string
          patient_address_snapshot?: string | null
          patient_first_name_snapshot: string
          patient_id: string
          patient_last_name_snapshot: string
          payment_id: string
          payment_method_snapshot: Database["public"]["Enums"]["payment_method"]
          payment_received_at_snapshot: string
          receipt_number: string
        }
        Update: {
          amount_snapshot?: number
          clinic_name_snapshot?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          issued_at?: string
          issued_by?: string
          issuer_name_snapshot?: string
          patient_address_snapshot?: string | null
          patient_first_name_snapshot?: string
          patient_id?: string
          patient_last_name_snapshot?: string
          payment_id?: string
          payment_method_snapshot?: Database["public"]["Enums"]["payment_method"]
          payment_received_at_snapshot?: string
          receipt_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          idempotency_key: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          patient_id: string
          received_at: string
          reference: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          id?: string
          idempotency_key: string
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          patient_id: string
          received_at: string
          reference?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          idempotency_key?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          patient_id?: string
          received_at?: string
          reference?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_items: {
        Row: {
          created_at: string
          dosage: string
          duration: string | null
          frequency: string
          id: string
          instructions: string | null
          medication_name: string
          position: number
          prescription_id: string
          route: string | null
        }
        Insert: {
          created_at?: string
          dosage: string
          duration?: string | null
          frequency: string
          id?: string
          instructions?: string | null
          medication_name: string
          position: number
          prescription_id: string
          route?: string | null
        }
        Update: {
          created_at?: string
          dosage?: string
          duration?: string | null
          frequency?: string
          id?: string
          instructions?: string | null
          medication_name?: string
          position?: number
          prescription_id?: string
          route?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescription_items_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          clinic_name_snapshot: string
          created_at: string
          created_by: string
          id: string
          issued_at: string
          notes: string | null
          patient_date_of_birth_snapshot: string | null
          patient_first_name_snapshot: string
          patient_id: string
          patient_last_name_snapshot: string
          prescriber_name_snapshot: string
          status: Database["public"]["Enums"]["prescription_status"]
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          clinic_name_snapshot?: string
          created_at?: string
          created_by: string
          id?: string
          issued_at?: string
          notes?: string | null
          patient_date_of_birth_snapshot?: string | null
          patient_first_name_snapshot: string
          patient_id: string
          patient_last_name_snapshot: string
          prescriber_name_snapshot: string
          status?: Database["public"]["Enums"]["prescription_status"]
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          clinic_name_snapshot?: string
          created_at?: string
          created_by?: string
          id?: string
          issued_at?: string
          notes?: string | null
          patient_date_of_birth_snapshot?: string | null
          patient_first_name_snapshot?: string
          patient_id?: string
          patient_last_name_snapshot?: string
          prescriber_name_snapshot?: string
          status?: Database["public"]["Enums"]["prescription_status"]
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: unknown
          metadata: Json
          severity: Database["public"]["Enums"]["security_event_severity"]
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          severity?: Database["public"]["Enums"]["security_event_severity"]
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          severity?: Database["public"]["Enums"]["security_event_severity"]
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          auth_session_id: string
          ended_at: string | null
          first_seen_at: string
          id: string
          ip_address: unknown
          last_seen_at: string
          metadata: Json
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_session_id: string
          ended_at?: string | null
          first_seen_at?: string
          id?: string
          ip_address?: unknown
          last_seen_at?: string
          metadata?: Json
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_session_id?: string
          ended_at?: string | null
          first_seen_at?: string
          id?: string
          ip_address?: unknown
          last_seen_at?: string
          metadata?: Json
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_patient: { Args: { patient_id: string }; Returns: boolean }
      cancel_appointment: {
        Args: {
          target_appointment_id: string
          target_patient_id: string
          target_reason: string
        }
        Returns: boolean
      }
      cancel_intervention: {
        Args: { target_intervention_id: string; target_patient_id: string }
        Returns: boolean
      }
      create_appointment: {
        Args: {
          target_ends_at: string
          target_idempotency_key: string
          target_notes: string
          target_patient_id: string
          target_purpose: string
          target_starts_at: string
          target_title: string
        }
        Returns: string
      }
      create_dental_finding: {
        Args: {
          target_condition: Database["public"]["Enums"]["dental_condition"]
          target_notes?: string
          target_patient_id: string
          target_recommendation?: string
          target_status: Database["public"]["Enums"]["dental_finding_status"]
          target_tooth_number: number
        }
        Returns: string
      }
      create_intervention:
        | {
            Args: {
              target_amount_due: number
              target_finding_ids?: string[]
              target_idempotency_key: string
              target_nature: string
              target_notes?: string
              target_patient_id: string
              target_performed_at: string
              target_status: Database["public"]["Enums"]["intervention_status"]
              target_teeth?: number[]
            }
            Returns: string
          }
        | {
            Args: {
              target_amount_due: number
              target_finding_ids?: string[]
              target_nature: string
              target_notes?: string
              target_patient_id: string
              target_performed_at: string
              target_status: Database["public"]["Enums"]["intervention_status"]
              target_teeth?: number[]
            }
            Returns: string
          }
      create_invoice: {
        Args: {
          target_idempotency_key: string
          target_intervention_ids: string[]
          target_patient_id: string
        }
        Returns: string
      }
      create_ip_policy: {
        Args: {
          target_expires_at: string
          target_ip: unknown
          target_reason: string
        }
        Returns: string
      }
      create_payment_receipt: {
        Args: {
          target_idempotency_key: string
          target_patient_id: string
          target_payment_id: string
        }
        Returns: string
      }
      create_prescription: {
        Args: {
          target_items: Json
          target_notes: string
          target_patient_id: string
        }
        Returns: string
      }
      disable_ip_policy: {
        Args: { target_policy_id: string }
        Returns: boolean
      }
      get_accounting_dashboard: {
        Args: {
          target_bucket: string
          target_end_date: string
          target_start_date: string
        }
        Returns: {
          active_patient_count: number
          current_outstanding: number
          intervention_count: number
          payment_count: number
          payment_methods: Json
          period_net: number
          production: number
          received: number
          series: Json
        }[]
      }
      get_due_appointment_reminders: {
        Args: { reference_time?: string }
        Returns: {
          appointment_id: string
          patient_first_name: string
          patient_id: string
          patient_phone: string
          reminder_type: Database["public"]["Enums"]["appointment_reminder_type"]
          starts_at: string
        }[]
      }
      get_main_dashboard: { Args: { reference_time?: string }; Returns: Json }
      get_patient_financial_summary: {
        Args: { target_patient_id: string }
        Returns: {
          outstanding: number
          total_due: number
          total_received: number
        }[]
      }
      get_security_center: { Args: { reference_time?: string }; Returns: Json }
      mark_appointment_reminder_handled: {
        Args: {
          target_appointment_id: string
          target_patient_id: string
          target_type: Database["public"]["Enums"]["appointment_reminder_type"]
        }
        Returns: boolean
      }
      observe_current_session: { Args: never; Returns: undefined }
      record_inactive_account_denied: { Args: never; Returns: undefined }
      record_logout: { Args: never; Returns: undefined }
      record_payment: {
        Args: {
          target_amount: number
          target_idempotency_key: string
          target_method: Database["public"]["Enums"]["payment_method"]
          target_notes?: string
          target_patient_id: string
          target_received_at: string
          target_reference?: string
        }
        Returns: string
      }
      resolve_dental_finding: {
        Args: { target_finding_id: string; target_patient_id: string }
        Returns: boolean
      }
      reverse_payment: {
        Args: {
          target_patient_id: string
          target_payment_id: string
          target_reason: string
        }
        Returns: boolean
      }
      search_patients: {
        Args: { patient_status?: string; search_term?: string }
        Returns: {
          date_of_birth: string
          first_name: string
          has_mutuelle: boolean
          id: string
          is_active: boolean
          last_name: string
          mutuelle_name: string
          phone: string
          updated_at: string
        }[]
      }
      set_appointment_status: {
        Args: {
          target_appointment_id: string
          target_patient_id: string
          target_status: Database["public"]["Enums"]["appointment_status"]
        }
        Returns: boolean
      }
      set_user_active: {
        Args: { target_active: boolean; target_user_id: string }
        Returns: boolean
      }
      update_appointment: {
        Args: {
          target_appointment_id: string
          target_ends_at: string
          target_notes: string
          target_patient_id: string
          target_purpose: string
          target_starts_at: string
          target_title: string
        }
        Returns: boolean
      }
      update_dental_finding: {
        Args: {
          target_condition: Database["public"]["Enums"]["dental_condition"]
          target_finding_id: string
          target_notes?: string
          target_patient_id: string
          target_recommendation?: string
          target_status: Database["public"]["Enums"]["dental_finding_status"]
        }
        Returns: boolean
      }
      update_intervention: {
        Args: {
          target_amount_due: number
          target_finding_ids?: string[]
          target_intervention_id: string
          target_nature: string
          target_notes?: string
          target_patient_id: string
          target_performed_at: string
          target_status: Database["public"]["Enums"]["intervention_status"]
          target_teeth?: number[]
        }
        Returns: boolean
      }
      void_invoice: {
        Args: {
          target_invoice_id: string
          target_patient_id: string
          target_reason: string
        }
        Returns: boolean
      }
      void_prescription: {
        Args: {
          target_patient_id: string
          target_prescription_id: string
          target_reason: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "doctor" | "assistant"
      appointment_reminder_type: "day_before" | "two_hours_before"
      appointment_status: "scheduled" | "completed" | "cancelled" | "no_show"
      dental_condition:
        | "caries"
        | "missing"
        | "filled"
        | "crown"
        | "root_canal"
        | "fracture"
        | "implant"
        | "extraction_indicated"
        | "other"
      dental_finding_event:
        | "created"
        | "updated"
        | "status_changed"
        | "resolved"
      dental_finding_status: "untreated" | "monitoring" | "treated" | "resolved"
      dentition_type: "permanent"
      intervention_status: "planned" | "performed" | "cancelled"
      invoice_status: "active" | "voided"
      payment_method: "cash" | "card" | "bank_transfer" | "cheque" | "other"
      payment_status: "received" | "reversed"
      prescription_status: "active" | "voided"
      security_event_severity: "info" | "warning" | "critical"
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
    Enums: {
      app_role: ["doctor", "assistant"],
      appointment_reminder_type: ["day_before", "two_hours_before"],
      appointment_status: ["scheduled", "completed", "cancelled", "no_show"],
      dental_condition: [
        "caries",
        "missing",
        "filled",
        "crown",
        "root_canal",
        "fracture",
        "implant",
        "extraction_indicated",
        "other",
      ],
      dental_finding_event: [
        "created",
        "updated",
        "status_changed",
        "resolved",
      ],
      dental_finding_status: ["untreated", "monitoring", "treated", "resolved"],
      dentition_type: ["permanent"],
      intervention_status: ["planned", "performed", "cancelled"],
      invoice_status: ["active", "voided"],
      payment_method: ["cash", "card", "bank_transfer", "cheque", "other"],
      payment_status: ["received", "reversed"],
      prescription_status: ["active", "voided"],
      security_event_severity: ["info", "warning", "critical"],
    },
  },
} as const
