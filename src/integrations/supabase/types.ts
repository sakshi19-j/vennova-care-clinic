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
      appointment_settings: {
        Row: {
          break_end: string | null
          break_start: string | null
          clinic_id: string
          clinic_name: string | null
          close_time: string
          holidays: string[]
          open_time: string
          slot_minutes: number
          updated_at: string
          working_days: number[]
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          clinic_id: string
          clinic_name?: string | null
          close_time?: string
          holidays?: string[]
          open_time?: string
          slot_minutes?: number
          updated_at?: string
          working_days?: number[]
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          clinic_id?: string
          clinic_name?: string | null
          close_time?: string
          holidays?: string[]
          open_time?: string
          slot_minutes?: number
          updated_at?: string
          working_days?: number[]
        }
        Relationships: []
      }
      appointment_slots: {
        Row: {
          backend_appointment_id: string | null
          booking_source: string
          chief_complaint: string | null
          clinic_id: string
          created_at: string
          end_time: string
          id: string
          patient_id: string | null
          patient_name: string
          patient_phone: string
          slot_date: string
          start_time: string
          status: string
          visit_type: string | null
        }
        Insert: {
          backend_appointment_id?: string | null
          booking_source?: string
          chief_complaint?: string | null
          clinic_id: string
          created_at?: string
          end_time: string
          id?: string
          patient_id?: string | null
          patient_name?: string
          patient_phone?: string
          slot_date: string
          start_time: string
          status?: string
          visit_type?: string | null
        }
        Update: {
          backend_appointment_id?: string | null
          booking_source?: string
          chief_complaint?: string | null
          clinic_id?: string
          created_at?: string
          end_time?: string
          id?: string
          patient_id?: string | null
          patient_name?: string
          patient_phone?: string
          slot_date?: string
          start_time?: string
          status?: string
          visit_type?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clinic_reserve_slot: {
        Args: {
          p_clinic: string
          p_date: string
          p_end: string
          p_name: string
          p_patient_id: string
          p_phone: string
          p_reason: string
          p_start: string
          p_visit_type: string
        }
        Returns: Json
      }
      clinic_slot_rows: {
        Args: { p_clinic: string; p_date?: string }
        Returns: {
          backend_appointment_id: string | null
          booking_source: string
          chief_complaint: string | null
          clinic_id: string
          created_at: string
          end_time: string
          id: string
          patient_id: string | null
          patient_name: string
          patient_phone: string
          slot_date: string
          start_time: string
          status: string
          visit_type: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "appointment_slots"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      clinic_update_slot_status: {
        Args: { p_backend_id?: string; p_id: string; p_status: string }
        Returns: undefined
      }
      public_book_slot: {
        Args: {
          p_clinic: string
          p_date: string
          p_end: string
          p_name: string
          p_phone: string
          p_reason?: string
          p_start: string
        }
        Returns: Json
      }
      public_booked_times: {
        Args: { p_clinic: string; p_date: string }
        Returns: string[]
      }
      public_booking_info: { Args: { p_clinic: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
