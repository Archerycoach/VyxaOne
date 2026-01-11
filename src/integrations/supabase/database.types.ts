 
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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean | null
          attendees: string[] | null
          contact_id: string | null
          created_at: string | null
          custom_fields: Json | null
          description: string | null
          end_time: string
          event_type: string | null
          google_calendar_id: string | null
          google_event_id: string | null
          id: string
          is_synced: boolean | null
          lead_id: string | null
          location: string | null
          property_id: string | null
          start_time: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          all_day?: boolean | null
          attendees?: string[] | null
          contact_id?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          end_time: string
          event_type?: string | null
          google_calendar_id?: string | null
          google_event_id?: string | null
          id?: string
          is_synced?: boolean | null
          lead_id?: string | null
          location?: string | null
          property_id?: string | null
          start_time: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          all_day?: boolean | null
          attendees?: string[] | null
          contact_id?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          end_time?: string
          event_type?: string | null
          google_calendar_id?: string | null
          google_event_id?: string | null
          id?: string
          is_synced?: boolean | null
          lead_id?: string | null
          location?: string | null
          property_id?: string | null
          start_time?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "calendar_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          auto_message_config: Json | null
          birth_date: string | null
          company: string | null
          created_at: string | null
          email: string | null
          id: string
          lead_source_id: string | null
          name: string
          notes: string | null
          phone: string | null
          position: string | null
          tags: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_message_config?: Json | null
          birth_date?: string | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          lead_source_id?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_message_config?: Json | null
          birth_date?: string | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          lead_source_id?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_lead_source_id_fkey"
            columns: ["lead_source_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string | null
          custom_fields: Json | null
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          lead_id: string | null
          name: string
          property_id: string | null
          tags: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          custom_fields?: Json | null
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          lead_id?: string | null
          name: string
          property_id?: string | null
          tags?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          custom_fields?: Json | null
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          lead_id?: string | null
          name?: string
          property_id?: string | null
          tags?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      image_uploads: {
        Row: {
          created_at: string | null
          entity_id: string | null
          entity_type: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_uploads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "image_uploads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_settings: {
        Row: {
          created_at: string | null
          id: string
          integration_name: string
          is_active: boolean | null
          last_tested_at: string | null
          settings: Json
          test_message: string | null
          test_status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          integration_name: string
          is_active?: boolean | null
          last_tested_at?: string | null
          settings?: Json
          test_message?: string | null
          test_status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          integration_name?: string
          is_active?: boolean | null
          last_tested_at?: string | null
          settings?: Json
          test_message?: string | null
          test_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      interactions: {
        Row: {
          contact_id: string | null
          content: string | null
          created_at: string | null
          id: string
          interaction_date: string | null
          interaction_type: string
          lead_id: string | null
          outcome: string | null
          property_id: string | null
          subject: string | null
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          interaction_date?: string | null
          interaction_type: string
          lead_id?: string | null
          outcome?: string | null
          property_id?: string | null
          subject?: string | null
          user_id: string
        }
        Update: {
          contact_id?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          interaction_date?: string | null
          interaction_type?: string
          lead_id?: string | null
          outcome?: string | null
          property_id?: string | null
          subject?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_workflow_rules: {
        Row: {
          action_config: Json | null
          action_type: string
          created_at: string | null
          delay_days: number | null
          delay_hours: number | null
          description: string | null
          enabled: boolean | null
          id: string
          name: string
          trigger_status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          action_config?: Json | null
          action_type: string
          created_at?: string | null
          delay_days?: number | null
          delay_hours?: number | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          name: string
          trigger_status: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          action_config?: Json | null
          action_type?: string
          created_at?: string | null
          delay_days?: number | null
          delay_hours?: number | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          name?: string
          trigger_status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_workflow_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "lead_workflow_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          archived_at: string | null
          assigned_to: string | null
          bathrooms: number | null
          bedrooms: number | null
          budget: number | null
          budget_max: number | null
          budget_min: number | null
          contact_id: string | null
          created_at: string | null
          custom_fields: Json | null
          desired_price: number | null
          email: string | null
          estimated_value: number | null
          id: string
          last_contact_date: string | null
          lead_score: number | null
          lead_type: string | null
          location_preference: string | null
          max_area: number | null
          min_area: number | null
          name: string
          needs_financing: boolean | null
          next_follow_up: string | null
          notes: string | null
          phone: string | null
          probability: number | null
          property_area: number | null
          property_type: string | null
          score: number | null
          source: string | null
          status: string | null
          tags: string[] | null
          temperature: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          assigned_to?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          budget?: number | null
          budget_max?: number | null
          budget_min?: number | null
          contact_id?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          desired_price?: number | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          last_contact_date?: string | null
          lead_score?: number | null
          lead_type?: string | null
          location_preference?: string | null
          max_area?: number | null
          min_area?: number | null
          name: string
          needs_financing?: boolean | null
          next_follow_up?: string | null
          notes?: string | null
          phone?: string | null
          probability?: number | null
          property_area?: number | null
          property_type?: string | null
          score?: number | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          temperature?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          archived_at?: string | null
          assigned_to?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          budget?: number | null
          budget_max?: number | null
          budget_min?: number | null
          contact_id?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          desired_price?: number | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          last_contact_date?: string | null
          lead_score?: number | null
          lead_type?: string | null
          location_preference?: string | null
          max_area?: number | null
          min_area?: number | null
          name?: string
          needs_financing?: boolean | null
          next_follow_up?: string | null
          notes?: string | null
          phone?: string | null
          probability?: number | null
          property_area?: number | null
          property_type?: string | null
          score?: number | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          temperature?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "leads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          message: string | null
          notification_type: string | null
          read_at: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          notification_type?: string | null
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          notification_type?: string | null
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_history: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          eupago_transaction_id: string | null
          id: string
          metadata: Json | null
          payment_date: string | null
          payment_method: string | null
          payment_reference: string | null
          status: string | null
          stripe_payment_intent_id: string | null
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          eupago_transaction_id?: string | null
          id?: string
          metadata?: Json | null
          payment_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          eupago_transaction_id?: string | null
          id?: string
          metadata?: Json | null
          payment_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "payment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          email_daily_events: boolean | null
          email_daily_tasks: boolean | null
          email_new_lead_assigned: boolean | null
          full_name: string | null
          id: string
          is_active: boolean | null
          phone: string | null
          reply_email: string | null
          role: string | null
          team_lead_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_daily_events?: boolean | null
          email_daily_tasks?: boolean | null
          email_new_lead_assigned?: boolean | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          phone?: string | null
          reply_email?: string | null
          role?: string | null
          team_lead_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_daily_events?: boolean | null
          email_daily_tasks?: boolean | null
          email_new_lead_assigned?: boolean | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          phone?: string | null
          reply_email?: string | null
          role?: string | null
          team_lead_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_lead_id_fkey"
            columns: ["team_lead_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "profiles_team_lead_id_fkey"
            columns: ["team_lead_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string | null
          amenities: string[] | null
          area: number | null
          bathrooms: number | null
          bedrooms: number | null
          city: string | null
          condominium_fee: number | null
          country: string | null
          created_at: string | null
          custom_fields: Json | null
          description: string | null
          district: string | null
          energy_rating: string | null
          features: string[] | null
          floor: number | null
          id: string
          images: string[] | null
          is_featured: boolean | null
          land_area: number | null
          latitude: number | null
          listed_at: string | null
          longitude: number | null
          main_image_url: string | null
          notes: string | null
          postal_code: string | null
          price: number | null
          price_per_sqm: number | null
          property_type: string
          reference_code: string | null
          rental_price: number | null
          status: string | null
          title: string
          total_floors: number | null
          typology: string | null
          updated_at: string | null
          user_id: string
          video_url: string | null
          views_count: number | null
          virtual_tour_url: string | null
          year_built: number | null
        }
        Insert: {
          address?: string | null
          amenities?: string[] | null
          area?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          condominium_fee?: number | null
          country?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          district?: string | null
          energy_rating?: string | null
          features?: string[] | null
          floor?: number | null
          id?: string
          images?: string[] | null
          is_featured?: boolean | null
          land_area?: number | null
          latitude?: number | null
          listed_at?: string | null
          longitude?: number | null
          main_image_url?: string | null
          notes?: string | null
          postal_code?: string | null
          price?: number | null
          price_per_sqm?: number | null
          property_type: string
          reference_code?: string | null
          rental_price?: number | null
          status?: string | null
          title: string
          total_floors?: number | null
          typology?: string | null
          updated_at?: string | null
          user_id: string
          video_url?: string | null
          views_count?: number | null
          virtual_tour_url?: string | null
          year_built?: number | null
        }
        Update: {
          address?: string | null
          amenities?: string[] | null
          area?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          condominium_fee?: number | null
          country?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          district?: string | null
          energy_rating?: string | null
          features?: string[] | null
          floor?: number | null
          id?: string
          images?: string[] | null
          is_featured?: boolean | null
          land_area?: number | null
          latitude?: number | null
          listed_at?: string | null
          longitude?: number | null
          main_image_url?: string | null
          notes?: string | null
          postal_code?: string | null
          price?: number | null
          price_per_sqm?: number | null
          property_type?: string
          reference_code?: string | null
          rental_price?: number | null
          status?: string | null
          title?: string
          total_floors?: number | null
          typology?: string | null
          updated_at?: string | null
          user_id?: string
          video_url?: string | null
          views_count?: number | null
          virtual_tour_url?: string | null
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "properties_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_matches: {
        Row: {
          created_at: string | null
          id: string
          lead_id: string
          match_reasons: string[] | null
          match_score: number | null
          property_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          lead_id: string
          match_reasons?: string[] | null
          match_score?: number | null
          property_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lead_id?: string
          match_reasons?: string[] | null
          match_score?: number | null
          property_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_matches_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_matches_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          billing_interval: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          limits: Json | null
          name: string
          price: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          updated_at: string | null
        }
        Insert: {
          billing_interval?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          limits?: Json | null
          name: string
          price: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_interval?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          limits?: Json | null
          name?: string
          price?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          eupago_reference: string | null
          id: string
          plan_id: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          eupago_reference?: string | null
          id?: string
          plan_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          eupago_reference?: string | null
          id?: string
          plan_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          custom_fields: Json | null
          description: string | null
          due_date: string | null
          google_event_id: string | null
          id: string
          is_synced: boolean | null
          notes: string | null
          priority: string | null
          related_contact_id: string | null
          related_lead_id: string | null
          related_property_id: string | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          due_date?: string | null
          google_event_id?: string | null
          id?: string
          is_synced?: boolean | null
          notes?: string | null
          priority?: string | null
          related_contact_id?: string | null
          related_lead_id?: string | null
          related_property_id?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          due_date?: string | null
          google_event_id?: string | null
          id?: string
          is_synced?: boolean | null
          notes?: string | null
          priority?: string | null
          related_contact_id?: string | null
          related_lead_id?: string | null
          related_property_id?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_related_contact_id_fkey"
            columns: ["related_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_related_lead_id_fkey"
            columns: ["related_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_related_property_id_fkey"
            columns: ["related_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          body: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          subject: string | null
          template_type: string
          updated_at: string | null
          user_id: string
          variables: string[] | null
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subject?: string | null
          template_type: string
          updated_at?: string | null
          user_id: string
          variables?: string[] | null
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string | null
          template_type?: string
          updated_at?: string | null
          user_id?: string
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_integrations: {
        Row: {
          access_token: string | null
          calendar_id: string | null
          created_at: string | null
          id: string
          integration_type: string
          is_active: boolean | null
          metadata: Json | null
          refresh_token: string | null
          token_expiry: string | null
          updated_at: string | null
          user_id: string
          webhook_channel_id: string | null
          webhook_expiration: string | null
          webhook_resource_id: string | null
        }
        Insert: {
          access_token?: string | null
          calendar_id?: string | null
          created_at?: string | null
          id?: string
          integration_type: string
          is_active?: boolean | null
          metadata?: Json | null
          refresh_token?: string | null
          token_expiry?: string | null
          updated_at?: string | null
          user_id: string
          webhook_channel_id?: string | null
          webhook_expiration?: string | null
          webhook_resource_id?: string | null
        }
        Update: {
          access_token?: string | null
          calendar_id?: string | null
          created_at?: string | null
          id?: string
          integration_type?: string
          is_active?: boolean | null
          metadata?: Json | null
          refresh_token?: string | null
          token_expiry?: string | null
          updated_at?: string | null
          user_id?: string
          webhook_channel_id?: string | null
          webhook_expiration?: string | null
          webhook_resource_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "user_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_executions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          executed_at: string | null
          id: string
          lead_id: string
          status: string
          user_id: string
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          lead_id: string
          status?: string
          user_id: string
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          lead_id?: string
          status?: string
          user_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_executions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_executions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "workflow_executions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "lead_workflow_rules"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      agent_performance: {
        Row: {
          agent_id: string | null
          completed_tasks: number | null
          full_name: string | null
          interactions_30d: number | null
          new_leads_30d: number | null
          role: string | null
          total_interactions: number | null
          total_leads: number | null
          total_tasks: number | null
          won_leads: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_lead_score: { Args: { lead_id: string }; Returns: number }
      cleanup_old_data: { Args: never; Returns: undefined }
      get_all_profiles_for_admin: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string
          role: string
          updated_at: string
        }[]
      }
      get_current_user_role: { Args: never; Returns: string }
      get_lead_statistics: {
        Args: { user_uuid: string }
        Returns: {
          active_leads: number
          cold_leads: number
          converted_leads: number
          hot_leads: number
          total_leads: number
          warm_leads: number
        }[]
      }
      get_pipeline_overview: {
        Args: never
        Returns: {
          avg_score: number
          count: number
          lead_type: string
          status: string
          total_value: number
        }[]
      }
      get_property_statistics: {
        Args: { user_uuid: string }
        Returns: {
          available_properties: number
          avg_price: number
          reserved_properties: number
          sold_properties: number
          total_properties: number
        }[]
      }
      get_task_statistics: {
        Args: { user_uuid: string }
        Returns: {
          completed_tasks: number
          in_progress_tasks: number
          overdue_tasks: number
          pending_tasks: number
          total_tasks: number
        }[]
      }
      is_team_member: { Args: { target_user_id: string }; Returns: boolean }
      refresh_lead_statistics: {
        Args: never
        Returns: {
          active_leads: number
          avg_score: number
          converted_leads: number
          full_name: string
          total_leads: number
          total_value: number
          user_id: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
    Enums: {},
  },
} as const
