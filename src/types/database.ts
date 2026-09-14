export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          phone: string | null
          avatar_url: string | null
          role: Database['public']['Enums']['app_role']
          member_type: string
          arrears_periods: number
          is_active: boolean
          joined_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string
          phone?: string | null
          avatar_url?: string | null
          role?: Database['public']['Enums']['app_role']
          member_type?: string
          arrears_periods?: number
          is_active?: boolean
          joined_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          phone?: string | null
          avatar_url?: string | null
          role?: Database['public']['Enums']['app_role']
          member_type?: string
          arrears_periods?: number
          is_active?: boolean
          joined_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      cash_transactions: {
        Row: {
          id: string
          type: Database['public']['Enums']['cash_transaction_type']
          description: string
          amount: number
          category: string
          occurred_on: string
          notes: string | null
          created_by: string
          legacy_source_key: string | null
          legacy_source_timestamp: string | null
          created_at: string
          updated_at: string
          settlement_id: string | null
          reversal_of_id: string | null
        }
        Insert: {
          id?: string
          type: Database['public']['Enums']['cash_transaction_type']
          description: string
          amount: number
          category?: string
          occurred_on?: string
          notes?: string | null
          created_by: string
          legacy_source_key?: string | null
          legacy_source_timestamp?: string | null
          created_at?: string
          updated_at?: string
          settlement_id?: string | null
          reversal_of_id?: string | null
        }
        Update: {
          id?: string
          type?: Database['public']['Enums']['cash_transaction_type']
          description?: string
          amount?: number
          category?: string
          occurred_on?: string
          notes?: string | null
          created_by?: string
          legacy_source_key?: string | null
          legacy_source_timestamp?: string | null
          created_at?: string
          updated_at?: string
          settlement_id?: string | null
          reversal_of_id?: string | null
        }
        Relationships: []
      }
      contributions: {
        Row: {
          id: string
          member_id: string
          period_start: string
          period_end: string
          amount: number
          status: Database['public']['Enums']['contribution_status']
          paid_at: string | null
          period_count: number
          member_type: string
          settlement_id: string | null
          notes: string | null
          recorded_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          member_id: string
          period_start: string
          period_end: string
          amount: number
          status?: Database['public']['Enums']['contribution_status']
          paid_at?: string | null
          period_count?: number
          member_type?: string
          settlement_id?: string | null
          notes?: string | null
          recorded_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          member_id?: string
          period_start?: string
          period_end?: string
          amount?: number
          status?: Database['public']['Enums']['contribution_status']
          paid_at?: string | null
          period_count?: number
          member_type?: string
          settlement_id?: string | null
          notes?: string | null
          recorded_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          id: string
          title: string
          description: string | null
          starts_at: string
          location: string | null
          map_url: string | null
          legacy_source_key: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          starts_at: string
          location?: string | null
          map_url?: string | null
          legacy_source_key?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          starts_at?: string
          location?: string | null
          map_url?: string | null
          legacy_source_key?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      prayer_notes: {
        Row: {
          id: string
          title: string
          body: string
          is_pinned: boolean
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          body: string
          is_pinned?: boolean
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          body?: string
          is_pinned?: boolean
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      gallery_photos: {
        Row: {
          id: string
          title: string
          caption: string | null
          image_url: string
          taken_on: string | null
          is_published: boolean
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          caption?: string | null
          image_url: string
          taken_on?: string | null
          is_published?: boolean
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          caption?: string | null
          image_url?: string
          taken_on?: string | null
          is_published?: boolean
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      legacy_contribution_status: {
        Row: {
          id: string
          legacy_source_key: string
          source_period_label: string
          member_name: string
          member_type: string
          payment_status: string
          arrears: number | null
          phone: string | null
          matched_profile_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          legacy_source_key: string
          source_period_label?: string
          member_name: string
          member_type?: string
          payment_status?: string
          arrears?: number | null
          phone?: string | null
          matched_profile_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          legacy_source_key?: string
          source_period_label?: string
          member_name?: string
          member_type?: string
          payment_status?: string
          arrears?: number | null
          phone?: string | null
          matched_profile_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      legacy_deceased_people: {
        Row: {
          id: string
          legacy_source_key: string
          full_name: string
          lineage_label: string | null
          father_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          legacy_source_key: string
          full_name: string
          lineage_label?: string | null
          father_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          legacy_source_key?: string
          full_name?: string
          lineage_label?: string | null
          father_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      legacy_arisan_winners: {
        Row: {
          id: string
          legacy_source_key: string
          period_label: string
          winner_name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          legacy_source_key: string
          period_label: string
          winner_name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          legacy_source_key?: string
          period_label?: string
          winner_name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_cash_transactions: {
        Row: {
          id: string
          type: Database['public']['Enums']['cash_transaction_type']
          description: string
          amount: number
          category: string
          occurred_on: string
          created_at: string
          updated_at: string
        }
        Relationships: []
      }
      public_contributions: {
        Row: {
          id: string
          member_id: string
          member_name: string
          period_start: string
          period_end: string
          period_count: number
          member_type: string
          amount: number
          status: Database['public']['Enums']['contribution_status']
          paid_at: string | null
        }
        Relationships: []
      }
      public_events: {
        Row: {
          id: string
          title: string
          description: string | null
          starts_at: string
          location: string | null
          map_url: string | null
        }
        Relationships: []
      }
      public_members: {
        Row: {
          id: string
          full_name: string
          avatar_url: string | null
          role: Database['public']['Enums']['app_role']
          member_type: string
          is_active: boolean
          joined_at: string
          updated_at: string
        }
        Relationships: []
      }
      public_prayer_notes: {
        Row: {
          id: string
          title: string
          body: string
          is_pinned: boolean
          created_at: string
          updated_at: string
        }
        Relationships: []
      }
      public_gallery_photos: {
        Row: {
          id: string
          title: string
          caption: string | null
          image_url: string
          taken_on: string | null
          created_at: string
        }
        Relationships: []
      }
      manager_members: {
        Row: {
          id: string
          full_name: string
          phone: string | null
          avatar_url: string | null
          role: Database['public']['Enums']['app_role']
          member_type: string
          is_active: boolean
          joined_at: string
          created_at: string
          updated_at: string
        }
        Relationships: []
      }
      public_legacy_contribution_status: {
        Row: {
          id: string
          source_period_label: string
          member_name: string
          member_type: string
          payment_status: string
          arrears: number | null
        }
        Relationships: []
      }
      public_legacy_deceased_people: {
        Row: {
          id: string
          full_name: string
          lineage_label: string | null
          father_name: string | null
        }
        Relationships: []
      }
      public_legacy_arisan_winners: {
        Row: {
          id: string
          period_label: string
          winner_name: string
          description: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      is_admin_or_treasurer: { Args: Record<PropertyKey, never>; Returns: boolean }
      assign_manager_role: {
        Args: { p_user_id: string; p_role: Database['public']['Enums']['app_role'] }
        Returns: undefined
      }
      settle_contribution: {
        Args: {
          p_member_id: string
          p_period_start: string
          p_period_end: string
          p_period_count: number
          p_pin: string
        }
        Returns: Array<{
          success: boolean
          message: string
          settlement_id: string | null
          total_amount: number | null
        }>
      }
      create_expense: {
        Args: { p_description: string; p_amount: number; p_category: string; p_pin: string }
        Returns: Array<{ success: boolean; message: string; transaction_id: string | null }>
      }
      reverse_contribution_settlement: {
        Args: { p_settlement_id: string; p_pin: string }
        Returns: Array<{ success: boolean; message: string }>
      }
    }
    Enums: {
      app_role: 'admin' | 'treasurer' | 'member'
      cash_transaction_type: 'income' | 'expense'
      contribution_status: 'pending' | 'paid' | 'void'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}