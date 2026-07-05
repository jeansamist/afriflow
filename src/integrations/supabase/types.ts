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
      call_logs: {
        Row: {
          client_id: string | null
          cost_credits: number
          created_at: string
          direction: string
          dossier_id: string | null
          duration_seconds: number
          from_number: string
          id: string
          recording_url: string | null
          status: string | null
          to_number: string
          twilio_call_sid: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          cost_credits?: number
          created_at?: string
          direction: string
          dossier_id?: string | null
          duration_seconds?: number
          from_number: string
          id?: string
          recording_url?: string | null
          status?: string | null
          to_number: string
          twilio_call_sid: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          cost_credits?: number
          created_at?: string
          direction?: string
          dossier_id?: string | null
          duration_seconds?: number
          from_number?: string
          id?: string
          recording_url?: string | null
          status?: string | null
          to_number?: string
          twilio_call_sid?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_client_fk"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_dossier_fk"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_clients: {
        Row: {
          company_name: string | null
          contact_email: string | null
          contact_name: string
          contact_phone: string | null
          created_at: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          contact_email?: string | null
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_clients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dossiers: {
        Row: {
          client_id: string | null
          created_at: string
          description: string | null
          id: string
          status: Database["public"]["Enums"]["dossier_status_type"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          status?: Database["public"]["Enums"]["dossier_status_type"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          status?: Database["public"]["Enums"]["dossier_status_type"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dossiers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      fx_rates: {
        Row: {
          base_currency: string
          created_at: string
          fetched_at: string
          id: string
          quote_currency: string
          rate: number
          source: string
        }
        Insert: {
          base_currency: string
          created_at?: string
          fetched_at?: string
          id?: string
          quote_currency: string
          rate: number
          source?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          fetched_at?: string
          id?: string
          quote_currency?: string
          rate?: number
          source?: string
        }
        Relationships: []
      }
      in_app_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link_to: string | null
          metadata: Json
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link_to?: string | null
          metadata?: Json
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link_to?: string | null
          metadata?: Json
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          amount: number
          created_at: string
          currency: string
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id: string
          metadata: Json
          reference_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          metadata?: Json
          reference_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          entry_type?: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          metadata?: Json
          reference_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      minute_transactions: {
        Row: {
          bucket: string
          created_at: string
          id: string
          kind: string
          metadata: Json | null
          minutes_delta: number
          reference: string | null
          user_id: string
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: string
          kind: string
          metadata?: Json | null
          minutes_delta: number
          reference?: string | null
          user_id: string
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json | null
          minutes_delta?: number
          reference?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_links: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          currency: string
          description: string
          dossier_id: string | null
          fx_locked_at: string | null
          fx_rate: number | null
          hosted_url: string | null
          id: string
          local_amount: number | null
          local_currency: string | null
          status: Database["public"]["Enums"]["payment_status_type"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          client_id?: string | null
          created_at?: string
          currency?: string
          description: string
          dossier_id?: string | null
          fx_locked_at?: string | null
          fx_rate?: number | null
          hosted_url?: string | null
          id?: string
          local_amount?: number | null
          local_currency?: string | null
          status?: Database["public"]["Enums"]["payment_status_type"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          currency?: string
          description?: string
          dossier_id?: string | null
          fx_locked_at?: string | null
          fx_rate?: number | null
          hosted_url?: string | null
          id?: string
          local_amount?: number | null
          local_currency?: string | null
          status?: Database["public"]["Enums"]["payment_status_type"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_client_fk"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_dossier_fk"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          admin_note: string | null
          created_at: string
          failure_reason: string | null
          fee_amount: number
          fx_rate: number | null
          gross_amount: number
          gross_currency: string
          id: string
          local_amount: number | null
          local_currency: string | null
          mobile_money_holder_name: string | null
          mobile_money_number: string | null
          mobile_money_operator: string | null
          net_amount: number
          payment_link_id: string | null
          provider: string
          provider_reference: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["payout_status_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          failure_reason?: string | null
          fee_amount?: number
          fx_rate?: number | null
          gross_amount: number
          gross_currency: string
          id?: string
          local_amount?: number | null
          local_currency?: string | null
          mobile_money_holder_name?: string | null
          mobile_money_number?: string | null
          mobile_money_operator?: string | null
          net_amount: number
          payment_link_id?: string | null
          provider?: string
          provider_reference?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["payout_status_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          failure_reason?: string | null
          fee_amount?: number
          fx_rate?: number | null
          gross_amount?: number
          gross_currency?: string
          id?: string
          local_amount?: number | null
          local_currency?: string | null
          mobile_money_holder_name?: string | null
          mobile_money_number?: string | null
          mobile_money_operator?: string | null
          net_amount?: number
          payment_link_id?: string | null
          provider?: string
          provider_reference?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["payout_status_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_allocations: {
        Row: {
          assigned_at: string
          country_iso: string
          created_at: string
          e164: string
          id: string
          provider: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          country_iso: string
          created_at?: string
          e164: string
          id?: string
          provider?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          country_iso?: string
          created_at?: string
          e164?: string
          id?: string
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      phone_wallets: {
        Row: {
          allowed_call_countries: string[]
          created_at: string
          cycle_ends_at: string | null
          extra_seconds: number
          included_minutes: number
          included_used_seconds: number
          last_reset_at: string
          plan_name: string
          plan_status: Database["public"]["Enums"]["plan_status"]
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_call_countries?: string[]
          created_at?: string
          cycle_ends_at?: string | null
          extra_seconds?: number
          included_minutes?: number
          included_used_seconds?: number
          last_reset_at?: string
          plan_name?: string
          plan_status?: Database["public"]["Enums"]["plan_status"]
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_call_countries?: string[]
          created_at?: string
          cycle_ends_at?: string | null
          extra_seconds?: number
          included_minutes?: number
          included_used_seconds?: number
          last_reset_at?: string
          plan_name?: string
          plan_status?: Database["public"]["Enums"]["plan_status"]
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          allocated_phone_number: string | null
          country_iso: string | null
          created_at: string
          first_name: string | null
          id: string
          is_frozen: boolean
          is_premium: boolean
          kyc_doc_address: string | null
          kyc_doc_id_back: string | null
          kyc_doc_id_front: string | null
          kyc_doc_selfie: string | null
          kyc_rejection_reason: string | null
          kyc_reviewed_at: string | null
          kyc_status: Database["public"]["Enums"]["kyc_status_type"]
          kyc_submitted_at: string | null
          last_name: string | null
          mobile_money_holder_name: string | null
          mobile_money_number: string | null
          mobile_money_operator: string | null
          payout_currency: string | null
          status: Database["public"]["Enums"]["user_status_type"]
          updated_at: string
        }
        Insert: {
          allocated_phone_number?: string | null
          country_iso?: string | null
          created_at?: string
          first_name?: string | null
          id: string
          is_frozen?: boolean
          is_premium?: boolean
          kyc_doc_address?: string | null
          kyc_doc_id_back?: string | null
          kyc_doc_id_front?: string | null
          kyc_doc_selfie?: string | null
          kyc_rejection_reason?: string | null
          kyc_reviewed_at?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status_type"]
          kyc_submitted_at?: string | null
          last_name?: string | null
          mobile_money_holder_name?: string | null
          mobile_money_number?: string | null
          mobile_money_operator?: string | null
          payout_currency?: string | null
          status?: Database["public"]["Enums"]["user_status_type"]
          updated_at?: string
        }
        Update: {
          allocated_phone_number?: string | null
          country_iso?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          is_frozen?: boolean
          is_premium?: boolean
          kyc_doc_address?: string | null
          kyc_doc_id_back?: string | null
          kyc_doc_id_front?: string | null
          kyc_doc_selfie?: string | null
          kyc_rejection_reason?: string | null
          kyc_reviewed_at?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status_type"]
          kyc_submitted_at?: string | null
          last_name?: string | null
          mobile_money_holder_name?: string | null
          mobile_money_number?: string | null
          mobile_money_operator?: string | null
          payout_currency?: string | null
          status?: Database["public"]["Enums"]["user_status_type"]
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      daily_payment_total_eur: { Args: { _user_id: string }; Returns: number }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      dossier_status_type:
        | "OPEN"
        | "IN_PROGRESS"
        | "WAITING_CLIENT"
        | "CLOSED"
        | "ARCHIVED"
      kyc_status_type:
        | "NOT_SUBMITTED"
        | "PENDING_REVIEW"
        | "APPROVED"
        | "REJECTED"
      ledger_entry_type: "DEBIT" | "CREDIT"
      payment_status_type: "GENERATED" | "PAID" | "EXPIRED" | "CANCELLED"
      payout_status_type: "PENDING" | "PROCESSING" | "SENT" | "FAILED"
      plan_status: "TRIAL" | "ACTIVE" | "RESTRICTED" | "CANCELED"
      user_status_type: "PENDING_EMAIL_VALIDATION" | "ACTIVE" | "SUSPENDED"
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
      app_role: ["admin", "moderator", "user"],
      dossier_status_type: [
        "OPEN",
        "IN_PROGRESS",
        "WAITING_CLIENT",
        "CLOSED",
        "ARCHIVED",
      ],
      kyc_status_type: [
        "NOT_SUBMITTED",
        "PENDING_REVIEW",
        "APPROVED",
        "REJECTED",
      ],
      ledger_entry_type: ["DEBIT", "CREDIT"],
      payment_status_type: ["GENERATED", "PAID", "EXPIRED", "CANCELLED"],
      payout_status_type: ["PENDING", "PROCESSING", "SENT", "FAILED"],
      plan_status: ["TRIAL", "ACTIVE", "RESTRICTED", "CANCELED"],
      user_status_type: ["PENDING_EMAIL_VALIDATION", "ACTIVE", "SUSPENDED"],
    },
  },
} as const
