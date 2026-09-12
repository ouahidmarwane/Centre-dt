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
      cancel_intervention: {
        Args: { target_intervention_id: string; target_patient_id: string }
        Returns: boolean
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
      create_intervention: {
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
      get_patient_financial_summary: {
        Args: { target_patient_id: string }
        Returns: {
          outstanding: number
          total_due: number
          total_received: number
        }[]
      }
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
    }
    Enums: {
      app_role: "doctor" | "assistant"
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
      payment_method: "cash" | "card" | "bank_transfer" | "cheque" | "other"
      payment_status: "received" | "reversed"
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
      payment_method: ["cash", "card", "bank_transfer", "cheque", "other"],
      payment_status: ["received", "reversed"],
      security_event_severity: ["info", "warning", "critical"],
    },
  },
} as const
