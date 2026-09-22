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
          city: string | null
          created_at: string
          criminal_record_path: string | null
          email: string
          first_name: string
          host_address_proof_path: string | null
          host_attestation_path: string | null
          host_id_path: string | null
          housing_status: string
          iban_path: string | null
          id: string
          id_card_path: string | null
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
          city?: string | null
          created_at?: string
          criminal_record_path?: string | null
          email: string
          first_name: string
          host_address_proof_path?: string | null
          host_attestation_path?: string | null
          host_id_path?: string | null
          housing_status?: string
          iban_path?: string | null
          id?: string
          id_card_path?: string | null
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
          city?: string | null
          created_at?: string
          criminal_record_path?: string | null
          email?: string
          first_name?: string
          host_address_proof_path?: string | null
          host_attestation_path?: string | null
          host_id_path?: string | null
          housing_status?: string
          iban_path?: string | null
          id?: string
          id_card_path?: string | null
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
          mission_id: string
          next_retry_at: string | null
          retry_count: number
          scheduled_charge_at: string | null
          simulate_failure: boolean
          status: string
          stripe_payment_method_id: string | null
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
          mission_id: string
          next_retry_at?: string | null
          retry_count?: number
          scheduled_charge_at?: string | null
          simulate_failure?: boolean
          status?: string
          stripe_payment_method_id?: string | null
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
          mission_id?: string
          next_retry_at?: string | null
          retry_count?: number
          scheduled_charge_at?: string | null
          simulate_failure?: boolean
          status?: string
          stripe_payment_method_id?: string | null
          stripe_setup_intent_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_line: string
          city: string
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string
          postal_code: string
          updated_at: string
        }
        Insert: {
          address_line?: string
          city?: string
          created_at?: string
          email?: string
          first_name?: string
          id: string
          last_name?: string
          phone?: string
          postal_code?: string
          updated_at?: string
        }
        Update: {
          address_line?: string
          city?: string
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string
          postal_code?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
      client_doc_type: "rib" | "identity" | "proof_of_address"
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
      client_doc_type: ["rib", "identity", "proof_of_address"],
    },
  },
} as const
