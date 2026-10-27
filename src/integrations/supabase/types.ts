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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      client_documents: {
        Row: {
          doc_type: Database["public"]["Enums"]["client_doc_type"]
          file_path: string | null
          id: string
          reject_reason: string | null
          status: Database["public"]["Enums"]["client_doc_status"]
          uploaded_at: string
          user_id: string
        }
        Insert: {
          doc_type: Database["public"]["Enums"]["client_doc_type"]
          file_path?: string | null
          id?: string
          reject_reason?: string | null
          status?: Database["public"]["Enums"]["client_doc_status"]
          uploaded_at?: string
          user_id: string
        }
        Update: {
          doc_type?: Database["public"]["Enums"]["client_doc_type"]
          file_path?: string | null
          id?: string
          reject_reason?: string | null
          status?: Database["public"]["Enums"]["client_doc_status"]
          uploaded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      companion_applications: {
        Row: {
          address: string
          address_proof_path: string | null
          birth_date: string | null
          birth_department: string | null
          birth_place: string | null
          cesu_number: string | null
          city: string | null
          created_at: string
          criminal_record_path: string | null
          email: string
          first_name: string
          has_cesu_number: boolean | null
          host_address_proof_path: string | null
          host_attestation_path: string | null
          host_id_path: string | null
          housing_status: string
          iban_path: string | null
          id: string
          id_card_back_path: string | null
          id_card_path: string | null
          id_passport_path: string | null
          id_type: string | null
          last_name: string
          motivation: string
          nir: string
          phone: string
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school: string | null
          selfie_path: string | null
          situation: string
          situation_proof_path: string | null
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
          user_id: string
          vitale_card_path: string | null
        }
        Insert: {
          address?: string
          address_proof_path?: string | null
          birth_date?: string | null
          birth_department?: string | null
          birth_place?: string | null
          cesu_number?: string | null
          city?: string | null
          created_at?: string
          criminal_record_path?: string | null
          email: string
          first_name: string
          has_cesu_number?: boolean | null
          host_address_proof_path?: string | null
          host_attestation_path?: string | null
          host_id_path?: string | null
          housing_status?: string
          iban_path?: string | null
          id?: string
          id_card_back_path?: string | null
          id_card_path?: string | null
          id_passport_path?: string | null
          id_type?: string | null
          last_name: string
          motivation?: string
          nir?: string
          phone: string
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school?: string | null
          selfie_path?: string | null
          situation?: string
          situation_proof_path?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id: string
          vitale_card_path?: string | null
        }
        Update: {
          address?: string
          address_proof_path?: string | null
          birth_date?: string | null
          birth_department?: string | null
          birth_place?: string | null
          cesu_number?: string | null
          city?: string | null
          created_at?: string
          criminal_record_path?: string | null
          email?: string
          first_name?: string
          has_cesu_number?: boolean | null
          host_address_proof_path?: string | null
          host_attestation_path?: string | null
          host_id_path?: string | null
          housing_status?: string
          iban_path?: string | null
          id?: string
          id_card_back_path?: string | null
          id_card_path?: string | null
          id_passport_path?: string | null
          id_type?: string | null
          last_name?: string
          motivation?: string
          nir?: string
          phone?: string
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school?: string | null
          selfie_path?: string | null
          situation?: string
          situation_proof_path?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id?: string
          vitale_card_path?: string | null
        }
        Relationships: []
      }
      contract_signature_codes: {
        Row: {
          attempts: number
          code_hash: string
          contract_id: string
          created_at: string
          expires_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          contract_id: string
          created_at?: string
          expires_at: string
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          contract_id?: string
          created_at?: string
          expires_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_signature_codes_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: true
            referencedRelation: "work_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signature_log: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          auth_method: string | null
          contract_id: string
          document_hash: string | null
          event: string
          id: string
          metadata: Json
          occurred_at: string
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          auth_method?: string | null
          contract_id: string
          document_hash?: string | null
          event: string
          id?: string
          metadata?: Json
          occurred_at?: string
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          auth_method?: string | null
          contract_id?: string
          document_hash?: string | null
          event?: string
          id?: string
          metadata?: Json
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_signature_log_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "work_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      mandataire_access_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          object_id: string
          object_type: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          object_id: string
          object_type: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          object_id?: string
          object_type?: string
        }
        Relationships: []
      }
      mission_payments: {
        Row: {
          amount_cents: number
          charged_at: string | null
          client_id: string
          companion_ref: string | null
          companion_user_id: string | null
          created_at: string
          failure_reason: string | null
          id: string
          last_run_at: string | null
          mission_at: string | null
          mission_id: string
          next_retry_at: string | null
          refund_amount_cents: number | null
          refund_reason: string | null
          refund_status: string
          refunded_at: string | null
          retry_count: number
          scheduled_charge_at: string | null
          simulate_failure: boolean
          status: string
          stripe_payment_method_id: string | null
          stripe_refund_id: string | null
          stripe_setup_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          charged_at?: string | null
          client_id: string
          companion_ref?: string | null
          companion_user_id?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          last_run_at?: string | null
          mission_at?: string | null
          mission_id: string
          next_retry_at?: string | null
          refund_amount_cents?: number | null
          refund_reason?: string | null
          refund_status?: string
          refunded_at?: string | null
          retry_count?: number
          scheduled_charge_at?: string | null
          simulate_failure?: boolean
          status?: string
          stripe_payment_method_id?: string | null
          stripe_refund_id?: string | null
          stripe_setup_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          charged_at?: string | null
          client_id?: string
          companion_ref?: string | null
          companion_user_id?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          last_run_at?: string | null
          mission_at?: string | null
          mission_id?: string
          next_retry_at?: string | null
          refund_amount_cents?: number | null
          refund_reason?: string | null
          refund_status?: string
          refunded_at?: string | null
          retry_count?: number
          scheduled_charge_at?: string | null
          simulate_failure?: boolean
          status?: string
          stripe_payment_method_id?: string | null
          stripe_refund_id?: string | null
          stripe_setup_intent_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_line: string
          birth_date: string | null
          birth_department: string | null
          birth_name: string
          birth_place: string | null
          cesu_number: string | null
          city: string
          created_at: string
          email: string
          first_name: string
          has_cesu_number: boolean | null
          id: string
          last_name: string
          phone: string
          postal_code: string
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          address_line?: string
          birth_date?: string | null
          birth_department?: string | null
          birth_name?: string
          birth_place?: string | null
          cesu_number?: string | null
          city?: string
          created_at?: string
          email?: string
          first_name?: string
          has_cesu_number?: boolean | null
          id: string
          last_name?: string
          phone?: string
          postal_code?: string
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          address_line?: string
          birth_date?: string | null
          birth_department?: string | null
          birth_name?: string
          birth_place?: string | null
          cesu_number?: string | null
          city?: string
          created_at?: string
          email?: string
          first_name?: string
          has_cesu_number?: boolean | null
          id?: string
          last_name?: string
          phone?: string
          postal_code?: string
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_contracts: {
        Row: {
          answers: Json
          client_id: string
          companion_answer_deadline: string | null
          companion_ref: string
          companion_signed_at: string | null
          companion_user_id: string | null
          contract_kind: string | null
          contract_snapshot: Json | null
          created_at: string
          document_hash: string | null
          effective_from: string | null
          effective_until: string | null
          employer_signed_at: string | null
          final_document: Json | null
          final_document_hash: string | null
          finalized_at: string | null
          first_mission_id: string | null
          id: string
          pdf_path: string | null
          refused_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          answers?: Json
          client_id: string
          companion_answer_deadline?: string | null
          companion_ref: string
          companion_signed_at?: string | null
          companion_user_id?: string | null
          contract_kind?: string | null
          contract_snapshot?: Json | null
          created_at?: string
          document_hash?: string | null
          effective_from?: string | null
          effective_until?: string | null
          employer_signed_at?: string | null
          final_document?: Json | null
          final_document_hash?: string | null
          finalized_at?: string | null
          first_mission_id?: string | null
          id?: string
          pdf_path?: string | null
          refused_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          client_id?: string
          companion_answer_deadline?: string | null
          companion_ref?: string
          companion_signed_at?: string | null
          companion_user_id?: string | null
          contract_kind?: string | null
          contract_snapshot?: Json | null
          created_at?: string
          document_hash?: string | null
          effective_from?: string | null
          effective_until?: string | null
          employer_signed_at?: string | null
          final_document?: Json | null
          final_document_hash?: string | null
          finalized_at?: string | null
          first_mission_id?: string | null
          id?: string
          pdf_path?: string | null
          refused_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      expire_overdue_contracts: { Args: never; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      refuse_contract_companion: {
        Args: { _companion_user_id: string; _contract_id: string }
        Returns: undefined
      }
      sign_contract_companion: {
        Args: {
          _companion_user_id: string
          _contract_id: string
          _final_document: Json
          _final_hash: string
          _recomputed_hash: string
        }
        Returns: undefined
      }
      sign_contract_employer: {
        Args: {
          _client_id: string
          _companion_user_id: string
          _contract_id: string
          _contract_kind: string
          _deadline: string
          _effective_from: string
          _effective_until: string
          _first_mission_id: string
          _hash: string
          _snapshot: Json
        }
        Returns: undefined
      }
      simulate_companion_answer: {
        Args: {
          _action: string
          _client_id: string
          _contract_id: string
          _final_document: Json
          _final_hash: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "mandataire"
      application_status:
        | "pending"
        | "approved"
        | "rejected"
        | "changes_requested"
      client_doc_status: "missing" | "pending" | "validated" | "rejected"
      client_doc_type:
        | "rib"
        | "identity"
        | "proof_of_address"
        | "identity_front"
        | "identity_back"
        | "identity_passport"
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
      app_role: ["mandataire"],
      application_status: [
        "pending",
        "approved",
        "rejected",
        "changes_requested",
      ],
      client_doc_status: ["missing", "pending", "validated", "rejected"],
      client_doc_type: [
        "rib",
        "identity",
        "proof_of_address",
        "identity_front",
        "identity_back",
        "identity_passport",
      ],
    },
  },
} as const
