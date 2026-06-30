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
      ai_reports: {
        Row: {
          content: string
          created_at: string | null
          id: string
          title: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          title: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "ai_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_tasks: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          system_prompt: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          system_prompt: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          system_prompt?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "ai_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          created_at: string
          estimated_cost: number
          id: string
          input_tokens: number
          model: string
          output_tokens: number
          provider: string
          task: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_cost?: number
          id?: string
          input_tokens?: number
          model: string
          output_tokens?: number
          provider: string
          task: string
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_cost?: number
          id?: string
          input_tokens?: number
          model?: string
          output_tokens?: number
          provider?: string
          task?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          all_day: boolean | null
          attendees: string[] | null
          confirmed_at: string | null
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
          no_show_at: string | null
          property_id: string | null
          reminder_sent_24h: boolean | null
          reminder_sent_2h: boolean | null
          requires_confirmation: boolean | null
          start_time: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          all_day?: boolean | null
          attendees?: string[] | null
          confirmed_at?: string | null
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
          no_show_at?: string | null
          property_id?: string | null
          reminder_sent_24h?: boolean | null
          reminder_sent_2h?: boolean | null
          requires_confirmation?: boolean | null
          start_time: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          all_day?: boolean | null
          attendees?: string[] | null
          confirmed_at?: string | null
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
          no_show_at?: string | null
          property_id?: string | null
          reminder_sent_24h?: boolean | null
          reminder_sent_2h?: boolean | null
          requires_confirmation?: boolean | null
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
      contact_alert_requests: {
        Row: {
          auto_send_email: boolean | null
          contact_id: string | null
          created_at: string
          email_body: string | null
          email_subject: string | null
          id: string
          is_active: boolean
          last_synced_at: string | null
          lead_id: string | null
          max_price: number | null
          min_bedrooms: number | null
          min_price: number | null
          name: string
          notes: string | null
          notification_channel: string
          opportunity_type: string
          preferred_cities: string[]
          preferred_districts: string[]
          property_types: string[]
          send_cc: boolean | null
          typologies: string[]
          updated_at: string
          urgency: string
          user_id: string
        }
        Insert: {
          auto_send_email?: boolean | null
          contact_id?: string | null
          created_at?: string
          email_body?: string | null
          email_subject?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          lead_id?: string | null
          max_price?: number | null
          min_bedrooms?: number | null
          min_price?: number | null
          name: string
          notes?: string | null
          notification_channel?: string
          opportunity_type?: string
          preferred_cities?: string[]
          preferred_districts?: string[]
          property_types?: string[]
          send_cc?: boolean | null
          typologies?: string[]
          updated_at?: string
          urgency?: string
          user_id: string
        }
        Update: {
          auto_send_email?: boolean | null
          contact_id?: string | null
          created_at?: string
          email_body?: string | null
          email_subject?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          lead_id?: string | null
          max_price?: number | null
          min_bedrooms?: number | null
          min_price?: number | null
          name?: string
          notes?: string | null
          notification_channel?: string
          opportunity_type?: string
          preferred_cities?: string[]
          preferred_districts?: string[]
          property_types?: string[]
          send_cc?: boolean | null
          typologies?: string[]
          updated_at?: string
          urgency?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_alert_requests_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_alert_requests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_alert_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "contact_alert_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_opportunity_matches: {
        Row: {
          contact_id: string | null
          created_at: string
          development_id: string | null
          id: string
          lead_id: string | null
          match_reasons: string[]
          match_score: number
          notification_channel: string
          opportunity_type: string
          property_id: string | null
          request_id: string
          status: string
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          development_id?: string | null
          id?: string
          lead_id?: string | null
          match_reasons?: string[]
          match_score: number
          notification_channel: string
          opportunity_type: string
          property_id?: string | null
          request_id: string
          status?: string
          task_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          development_id?: string | null
          id?: string
          lead_id?: string | null
          match_reasons?: string[]
          match_score?: number
          notification_channel?: string
          opportunity_type?: string
          property_id?: string | null
          request_id?: string
          status?: string
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_opportunity_matches_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_opportunity_matches_development_id_fkey"
            columns: ["development_id"]
            isOneToOne: false
            referencedRelation: "developments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_opportunity_matches_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_opportunity_matches_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_opportunity_matches_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "contact_alert_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_opportunity_matches_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_opportunity_matches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "contact_opportunity_matches_user_id_fkey"
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
      daily_digest_settings: {
        Row: {
          created_at: string | null
          delivery_time: string | null
          enabled: boolean | null
          id: string
          include_events: boolean | null
          include_hot_leads: boolean | null
          include_overdue_proposals: boolean | null
          include_tasks: boolean | null
          send_email: boolean | null
          send_notification: boolean | null
          send_whatsapp: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          delivery_time?: string | null
          enabled?: boolean | null
          id?: string
          include_events?: boolean | null
          include_hot_leads?: boolean | null
          include_overdue_proposals?: boolean | null
          include_tasks?: boolean | null
          send_email?: boolean | null
          send_notification?: boolean | null
          send_whatsapp?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          delivery_time?: string | null
          enabled?: boolean | null
          id?: string
          include_events?: boolean | null
          include_hot_leads?: boolean | null
          include_overdue_proposals?: boolean | null
          include_tasks?: boolean | null
          send_email?: boolean | null
          send_notification?: boolean | null
          send_whatsapp?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          amount: number
          created_at: string | null
          deal_type: string
          id: string
          lead_id: string | null
          notes: string | null
          transaction_date: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          deal_type: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          transaction_date: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          deal_type?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          transaction_date?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "deals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      developments: {
        Row: {
          address: string | null
          available_units: number | null
          city: string | null
          created_at: string
          delivery_date: string | null
          description: string | null
          developer_name: string | null
          district: string | null
          highlights: string[] | null
          id: string
          images: string[] | null
          main_image_url: string | null
          name: string
          postal_code: string | null
          price_from: number | null
          price_to: number | null
          published_at: string | null
          reference_code: string | null
          status: string
          total_units: number | null
          typologies: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          available_units?: number | null
          city?: string | null
          created_at?: string
          delivery_date?: string | null
          description?: string | null
          developer_name?: string | null
          district?: string | null
          highlights?: string[] | null
          id?: string
          images?: string[] | null
          main_image_url?: string | null
          name: string
          postal_code?: string | null
          price_from?: number | null
          price_to?: number | null
          published_at?: string | null
          reference_code?: string | null
          status?: string
          total_units?: number | null
          typologies?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          available_units?: number | null
          city?: string | null
          created_at?: string
          delivery_date?: string | null
          description?: string | null
          developer_name?: string | null
          district?: string | null
          highlights?: string[] | null
          id?: string
          images?: string[] | null
          main_image_url?: string | null
          name?: string
          postal_code?: string | null
          price_from?: number | null
          price_to?: number | null
          published_at?: string | null
          reference_code?: string | null
          status?: string
          total_units?: number | null
          typologies?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "developments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "developments_user_id_fkey"
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
      email_templates: {
        Row: {
          attachments: Json | null
          created_at: string | null
          description: string | null
          html_body: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          recipient_emails: string[] | null
          subject: string
          template_type: string
          text_body: string | null
          updated_at: string | null
          user_id: string | null
          variables: Json | null
        }
        Insert: {
          attachments?: Json | null
          created_at?: string | null
          description?: string | null
          html_body: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          recipient_emails?: string[] | null
          subject: string
          template_type: string
          text_body?: string | null
          updated_at?: string | null
          user_id?: string | null
          variables?: Json | null
        }
        Update: {
          attachments?: Json | null
          created_at?: string | null
          description?: string | null
          html_body?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          recipient_emails?: string[] | null
          subject?: string
          template_type?: string
          text_body?: string | null
          updated_at?: string | null
          user_id?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "email_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_property_portals: {
        Row: {
          api_key: string | null
          api_secret: string | null
          base_url: string | null
          created_at: string | null
          custom_settings: Json | null
          id: string
          is_enabled: boolean | null
          provider_name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          api_key?: string | null
          api_secret?: string | null
          base_url?: string | null
          created_at?: string | null
          custom_settings?: Json | null
          id?: string
          is_enabled?: boolean | null
          provider_name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          api_key?: string | null
          api_secret?: string | null
          base_url?: string | null
          created_at?: string | null
          custom_settings?: Json | null
          id?: string
          is_enabled?: boolean | null
          provider_name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      first_contact_alerts: {
        Row: {
          alert_type: string
          alerted_at: string
          id: string
          lead_id: string
          minutes_elapsed: number
          user_id: string
        }
        Insert: {
          alert_type: string
          alerted_at?: string
          id?: string
          lead_id: string
          minutes_elapsed: number
          user_id: string
        }
        Update: {
          alert_type?: string
          alerted_at?: string
          id?: string
          lead_id?: string
          minutes_elapsed?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "first_contact_alerts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      frontend_settings: {
        Row: {
          category: string
          description: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          category: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          category?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "frontend_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "frontend_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          acquisitions_target: number | null
          created_at: string | null
          created_by: string | null
          goal_type: string
          id: string
          period: string
          revenue_target: number | null
          semester: number | null
          updated_at: string | null
          user_id: string | null
          year: number
        }
        Insert: {
          acquisitions_target?: number | null
          created_at?: string | null
          created_by?: string | null
          goal_type: string
          id?: string
          period: string
          revenue_target?: number | null
          semester?: number | null
          updated_at?: string | null
          user_id?: string | null
          year: number
        }
        Update: {
          acquisitions_target?: number | null
          created_at?: string | null
          created_by?: string | null
          goal_type?: string
          id?: string
          period?: string
          revenue_target?: number | null
          semester?: number | null
          updated_at?: string | null
          user_id?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_integrations: {
        Row: {
          access_token: string
          auto_sync: boolean | null
          calendar_id: string | null
          created_at: string | null
          expires_at: string
          google_email: string
          id: string
          last_sync_at: string | null
          refresh_token: string | null
          sync_direction: string | null
          sync_events: boolean | null
          sync_notes: boolean | null
          sync_tasks: boolean | null
          updated_at: string | null
          user_id: string
          webhook_channel_id: string | null
          webhook_expiration: string | null
        }
        Insert: {
          access_token: string
          auto_sync?: boolean | null
          calendar_id?: string | null
          created_at?: string | null
          expires_at: string
          google_email: string
          id?: string
          last_sync_at?: string | null
          refresh_token?: string | null
          sync_direction?: string | null
          sync_events?: boolean | null
          sync_notes?: boolean | null
          sync_tasks?: boolean | null
          updated_at?: string | null
          user_id: string
          webhook_channel_id?: string | null
          webhook_expiration?: string | null
        }
        Update: {
          access_token?: string
          auto_sync?: boolean | null
          calendar_id?: string | null
          created_at?: string | null
          expires_at?: string
          google_email?: string
          id?: string
          last_sync_at?: string | null
          refresh_token?: string | null
          sync_direction?: string | null
          sync_events?: boolean | null
          sync_notes?: boolean | null
          sync_tasks?: boolean | null
          updated_at?: string | null
          user_id?: string
          webhook_channel_id?: string | null
          webhook_expiration?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "google_calendar_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gpt_api_keys: {
        Row: {
          api_key: string
          created_at: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          model: string
          name: string
          property_matcher_enabled: boolean | null
          provider: string
          user_id: string
        }
        Insert: {
          api_key: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          model?: string
          name: string
          property_matcher_enabled?: boolean | null
          provider?: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          model?: string
          name?: string
          property_matcher_enabled?: boolean | null
          provider?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gpt_api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "gpt_api_keys_user_id_fkey"
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
          client_id: string | null
          client_secret: string | null
          created_at: string | null
          enabled: boolean | null
          id: string
          integration_name: string
          is_active: boolean | null
          redirect_uri: string | null
          scopes: string[] | null
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          client_secret?: string | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          integration_name: string
          is_active?: boolean | null
          redirect_uri?: string | null
          scopes?: string[] | null
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          client_secret?: string | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          integration_name?: string
          is_active?: boolean | null
          redirect_uri?: string | null
          scopes?: string[] | null
          settings?: Json | null
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
      lead_columns_config: {
        Row: {
          column_key: string
          column_label: string
          column_order: number
          column_width: string | null
          created_at: string | null
          id: string
          is_visible: boolean | null
          updated_at: string | null
        }
        Insert: {
          column_key: string
          column_label: string
          column_order: number
          column_width?: string | null
          created_at?: string | null
          id?: string
          is_visible?: boolean | null
          updated_at?: string | null
        }
        Update: {
          column_key?: string
          column_label?: string
          column_order?: number
          column_width?: string | null
          created_at?: string | null
          id?: string
          is_visible?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      lead_consents: {
        Row: {
          channel: string
          consent_text: string | null
          consent_type: string
          created_at: string
          evidence_ref: string | null
          granted_at: string | null
          id: string
          lead_id: string
          revoked_at: string | null
          source: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          consent_text?: string | null
          consent_type?: string
          created_at?: string
          evidence_ref?: string | null
          granted_at?: string | null
          id?: string
          lead_id: string
          revoked_at?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          consent_text?: string | null
          consent_type?: string
          created_at?: string
          evidence_ref?: string | null
          granted_at?: string | null
          id?: string
          lead_id?: string
          revoked_at?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_consents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_memory: {
        Row: {
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          lead_id: string
          source: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          lead_id: string
          source: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          lead_id?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_memory_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_memory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "lead_memory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          lead_id: string
          note: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_id: string
          note: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_id?: string
          note?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "lead_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_score_history: {
        Row: {
          budget_fit_score: number | null
          calculated_at: string
          created_at: string
          engagement_score: number | null
          id: string
          lead_id: string
          recency_score: number | null
          response_time_score: number | null
          score: number
          source_score: number | null
          trigger_reason: string | null
          user_id: string
        }
        Insert: {
          budget_fit_score?: number | null
          calculated_at?: string
          created_at?: string
          engagement_score?: number | null
          id?: string
          lead_id: string
          recency_score?: number | null
          response_time_score?: number | null
          score: number
          source_score?: number | null
          trigger_reason?: string | null
          user_id: string
        }
        Update: {
          budget_fit_score?: number | null
          calculated_at?: string
          created_at?: string
          engagement_score?: number | null
          id?: string
          lead_id?: string
          recency_score?: number | null
          response_time_score?: number | null
          score?: number
          source_score?: number | null
          trigger_reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_score_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_workflow_rules: {
        Row: {
          action_config: Json | null
          action_type: string
          actions: Json | null
          cadence_type: string | null
          created_at: string | null
          delay_days: number | null
          delay_hours: number | null
          description: string | null
          enabled: boolean | null
          id: string
          name: string
          steps: Json | null
          stop_on_response: boolean | null
          trigger_status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          action_config?: Json | null
          action_type: string
          actions?: Json | null
          cadence_type?: string | null
          created_at?: string | null
          delay_days?: number | null
          delay_hours?: number | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          name: string
          steps?: Json | null
          stop_on_response?: boolean | null
          trigger_status: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          action_config?: Json | null
          action_type?: string
          actions?: Json | null
          cadence_type?: string | null
          created_at?: string | null
          delay_days?: number | null
          delay_hours?: number | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          name?: string
          steps?: Json | null
          stop_on_response?: boolean | null
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
          archive_reason: string | null
          archived_at: string | null
          assigned_to: string | null
          bathrooms: number | null
          bedrooms: number | null
          birthday: string | null
          budget: number | null
          budget_max: number | null
          budget_min: number | null
          buy_purpose: string | null
          buyer_status: string | null
          consent_token: string | null
          contact_id: string | null
          created_at: string | null
          custom_fields: Json | null
          desired_price: number | null
          development_id: string | null
          development_name: string | null
          email: string | null
          email_opt_out: boolean | null
          email_opted_out_at: string | null
          email_unsub_token: string | null
          estimated_value: number | null
          first_contact_at: string | null
          follow_up_state:
            | Database["public"]["Enums"]["lead_follow_up_state"]
            | null
          has_property_to_sell: boolean | null
          id: string
          important_dates: Json | null
          is_development: boolean | null
          last_activity_date: string | null
          last_contact_date: string | null
          last_contact_outcome: string | null
          last_reactivation_sent_at: string | null
          lead_score: number | null
          lead_type: string | null
          location_preference: string | null
          max_area: number | null
          meta_ad_id: string | null
          meta_form_id: string | null
          meta_lead_id: string | null
          min_area: number | null
          name: string
          needs_financing: boolean | null
          next_follow_up: string | null
          notes: string | null
          notion_page_id: string | null
          phone: string | null
          probability: number | null
          property_area: number | null
          property_type: string | null
          purchase_timeline: string | null
          reactivation_attempts: number | null
          score: number | null
          seller_status: string | null
          source: string | null
          status: string | null
          tags: string[] | null
          temperature: string | null
          typology: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          assigned_to?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          birthday?: string | null
          budget?: number | null
          budget_max?: number | null
          budget_min?: number | null
          buy_purpose?: string | null
          buyer_status?: string | null
          consent_token?: string | null
          contact_id?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          desired_price?: number | null
          development_id?: string | null
          development_name?: string | null
          email?: string | null
          email_opt_out?: boolean | null
          email_opted_out_at?: string | null
          email_unsub_token?: string | null
          estimated_value?: number | null
          first_contact_at?: string | null
          follow_up_state?:
            | Database["public"]["Enums"]["lead_follow_up_state"]
            | null
          has_property_to_sell?: boolean | null
          id?: string
          important_dates?: Json | null
          is_development?: boolean | null
          last_activity_date?: string | null
          last_contact_date?: string | null
          last_contact_outcome?: string | null
          last_reactivation_sent_at?: string | null
          lead_score?: number | null
          lead_type?: string | null
          location_preference?: string | null
          max_area?: number | null
          meta_ad_id?: string | null
          meta_form_id?: string | null
          meta_lead_id?: string | null
          min_area?: number | null
          name: string
          needs_financing?: boolean | null
          next_follow_up?: string | null
          notes?: string | null
          notion_page_id?: string | null
          phone?: string | null
          probability?: number | null
          property_area?: number | null
          property_type?: string | null
          purchase_timeline?: string | null
          reactivation_attempts?: number | null
          score?: number | null
          seller_status?: string | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          temperature?: string | null
          typology?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          assigned_to?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          birthday?: string | null
          budget?: number | null
          budget_max?: number | null
          budget_min?: number | null
          buy_purpose?: string | null
          buyer_status?: string | null
          consent_token?: string | null
          contact_id?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          desired_price?: number | null
          development_id?: string | null
          development_name?: string | null
          email?: string | null
          email_opt_out?: boolean | null
          email_opted_out_at?: string | null
          email_unsub_token?: string | null
          estimated_value?: number | null
          first_contact_at?: string | null
          follow_up_state?:
            | Database["public"]["Enums"]["lead_follow_up_state"]
            | null
          has_property_to_sell?: boolean | null
          id?: string
          important_dates?: Json | null
          is_development?: boolean | null
          last_activity_date?: string | null
          last_contact_date?: string | null
          last_contact_outcome?: string | null
          last_reactivation_sent_at?: string | null
          lead_score?: number | null
          lead_type?: string | null
          location_preference?: string | null
          max_area?: number | null
          meta_ad_id?: string | null
          meta_form_id?: string | null
          meta_lead_id?: string | null
          min_area?: number | null
          name?: string
          needs_financing?: boolean | null
          next_follow_up?: string | null
          notes?: string | null
          notion_page_id?: string | null
          phone?: string | null
          probability?: number | null
          property_area?: number | null
          property_type?: string | null
          purchase_timeline?: string | null
          reactivation_attempts?: number | null
          score?: number | null
          seller_status?: string | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          temperature?: string | null
          typology?: string | null
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
            foreignKeyName: "leads_development_id_fkey"
            columns: ["development_id"]
            isOneToOne: false
            referencedRelation: "developments"
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
      meta_app_settings: {
        Row: {
          app_id: string
          app_secret: string
          created_at: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
          verify_token: string
          webhook_url: string | null
        }
        Insert: {
          app_id: string
          app_secret: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          verify_token: string
          webhook_url?: string | null
        }
        Update: {
          app_id?: string
          app_secret?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          verify_token?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      meta_field_mappings: {
        Row: {
          created_at: string | null
          crm_field_name: string
          field_type: string | null
          form_config_id: string
          id: string
          is_required: boolean | null
          meta_field_label: string | null
          meta_field_name: string
          transform_rule: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          crm_field_name: string
          field_type?: string | null
          form_config_id: string
          id?: string
          is_required?: boolean | null
          meta_field_label?: string | null
          meta_field_name: string
          transform_rule?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          crm_field_name?: string
          field_type?: string | null
          form_config_id?: string
          id?: string
          is_required?: boolean | null
          meta_field_label?: string | null
          meta_field_name?: string
          transform_rule?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_field_mappings_form_config_id_fkey"
            columns: ["form_config_id"]
            isOneToOne: false
            referencedRelation: "meta_form_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_form_configs: {
        Row: {
          auto_assign_to: string | null
          created_at: string | null
          custom_settings: Json | null
          default_status: string | null
          form_id: string
          form_name: string | null
          id: string
          is_active: boolean | null
          notification_email: string | null
          page_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_assign_to?: string | null
          created_at?: string | null
          custom_settings?: Json | null
          default_status?: string | null
          form_id: string
          form_name?: string | null
          id?: string
          is_active?: boolean | null
          notification_email?: string | null
          page_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_assign_to?: string | null
          created_at?: string | null
          custom_settings?: Json | null
          default_status?: string | null
          form_id?: string
          form_name?: string | null
          id?: string
          is_active?: boolean | null
          notification_email?: string | null
          page_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      meta_form_mappings: {
        Row: {
          created_at: string | null
          field_mappings: Json
          form_id: string
          form_name: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          field_mappings?: Json
          form_id: string
          form_name?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          field_mappings?: Json
          form_id?: string
          form_name?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      meta_integrations: {
        Row: {
          auto_daily_sync: boolean | null
          created_at: string | null
          daily_sync_hour: number | null
          id: string
          is_active: boolean | null
          last_daily_sync_at: string | null
          last_sync_at: string | null
          page_access_token: string
          page_id: string
          page_name: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
          webhook_subscribed: boolean | null
        }
        Insert: {
          auto_daily_sync?: boolean | null
          created_at?: string | null
          daily_sync_hour?: number | null
          id?: string
          is_active?: boolean | null
          last_daily_sync_at?: string | null
          last_sync_at?: string | null
          page_access_token: string
          page_id: string
          page_name?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
          webhook_subscribed?: boolean | null
        }
        Update: {
          auto_daily_sync?: boolean | null
          created_at?: string | null
          daily_sync_hour?: number | null
          id?: string
          is_active?: boolean | null
          last_daily_sync_at?: string | null
          last_sync_at?: string | null
          page_access_token?: string
          page_id?: string
          page_name?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
          webhook_subscribed?: boolean | null
        }
        Relationships: []
      }
      meta_notification_settings: {
        Row: {
          client_email_template: string | null
          consultant_email_template: string | null
          created_at: string | null
          id: string
          notification_enabled: boolean | null
          notify_client: boolean | null
          notify_consultant: boolean | null
          updated_at: string | null
        }
        Insert: {
          client_email_template?: string | null
          consultant_email_template?: string | null
          created_at?: string | null
          id?: string
          notification_enabled?: boolean | null
          notify_client?: boolean | null
          notify_consultant?: boolean | null
          updated_at?: string | null
        }
        Update: {
          client_email_template?: string | null
          consultant_email_template?: string | null
          created_at?: string | null
          id?: string
          notification_enabled?: boolean | null
          notify_client?: boolean | null
          notify_consultant?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      meta_sync_history: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_details: Json | null
          errors_count: number | null
          form_id: string | null
          id: string
          leads_created: number | null
          leads_processed: number | null
          leads_skipped: number | null
          leads_updated: number | null
          page_id: string
          started_at: string | null
          status: string | null
          sync_type: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_details?: Json | null
          errors_count?: number | null
          form_id?: string | null
          id?: string
          leads_created?: number | null
          leads_processed?: number | null
          leads_skipped?: number | null
          leads_updated?: number | null
          page_id: string
          started_at?: string | null
          status?: string | null
          sync_type: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_details?: Json | null
          errors_count?: number | null
          form_id?: string | null
          id?: string
          leads_created?: number | null
          leads_processed?: number | null
          leads_skipped?: number | null
          leads_updated?: number | null
          page_id?: string
          started_at?: string | null
          status?: string | null
          sync_type?: string
          user_id?: string
        }
        Relationships: []
      }
      meta_webhook_logs: {
        Row: {
          ad_id: string | null
          created_at: string | null
          error_message: string | null
          form_id: string | null
          id: string
          leadgen_id: string
          page_id: string
          status: string
          webhook_payload: Json
        }
        Insert: {
          ad_id?: string | null
          created_at?: string | null
          error_message?: string | null
          form_id?: string | null
          id?: string
          leadgen_id: string
          page_id: string
          status?: string
          webhook_payload: Json
        }
        Update: {
          ad_id?: string | null
          created_at?: string | null
          error_message?: string | null
          form_id?: string | null
          id?: string
          leadgen_id?: string
          page_id?: string
          status?: string
          webhook_payload?: Json
        }
        Relationships: []
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
      notion_integrations: {
        Row: {
          access_token: string
          bot_id: string | null
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
          workspace_id: string | null
          workspace_name: string | null
        }
        Insert: {
          access_token: string
          bot_id?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
          workspace_id?: string | null
          workspace_name?: string | null
        }
        Update: {
          access_token?: string
          bot_id?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
          workspace_id?: string | null
          workspace_name?: string | null
        }
        Relationships: []
      }
      notion_mappings: {
        Row: {
          created_at: string | null
          entity_type: string
          field_mappings: Json | null
          id: string
          notion_database_id: string
          notion_database_name: string | null
          sync_direction: string | null
          sync_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          entity_type: string
          field_mappings?: Json | null
          id?: string
          notion_database_id: string
          notion_database_name?: string | null
          sync_direction?: string | null
          sync_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          entity_type?: string
          field_mappings?: Json | null
          id?: string
          notion_database_id?: string
          notion_database_name?: string | null
          sync_direction?: string | null
          sync_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
          email_signature_image_url: string | null
          email_signature_text: string | null
          first_contact_alert_minutes: number | null
          full_name: string | null
          id: string
          is_active: boolean | null
          manager_id: string | null
          needs_relogin: boolean | null
          phone: string | null
          reply_email: string | null
          role: Database["public"]["Enums"]["user_role"]
          subscription_end_date: string | null
          subscription_plan: string | null
          subscription_status: string | null
          team_lead_id: string | null
          trial_ends_at: string | null
          updated_at: string | null
          whatsapp_module_enabled: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_daily_events?: boolean | null
          email_daily_tasks?: boolean | null
          email_new_lead_assigned?: boolean | null
          email_signature_image_url?: string | null
          email_signature_text?: string | null
          first_contact_alert_minutes?: number | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          manager_id?: string | null
          needs_relogin?: boolean | null
          phone?: string | null
          reply_email?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          subscription_end_date?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          team_lead_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          whatsapp_module_enabled?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_daily_events?: boolean | null
          email_daily_tasks?: boolean | null
          email_new_lead_assigned?: boolean | null
          email_signature_image_url?: string | null
          email_signature_text?: string | null
          first_contact_alert_minutes?: number | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          needs_relogin?: boolean | null
          phone?: string | null
          reply_email?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          subscription_end_date?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          team_lead_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          whatsapp_module_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          acquisition_date: string | null
          address: string | null
          amenities: string[] | null
          area: number | null
          bathrooms: number | null
          bedrooms: number | null
          city: string | null
          condominium_fee: number | null
          contact_id: string | null
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
          lead_id: string | null
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
          reverse_match_processed: boolean | null
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
          acquisition_date?: string | null
          address?: string | null
          amenities?: string[] | null
          area?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          condominium_fee?: number | null
          contact_id?: string | null
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
          lead_id?: string | null
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
          reverse_match_processed?: boolean | null
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
          acquisition_date?: string | null
          address?: string | null
          amenities?: string[] | null
          area?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          condominium_fee?: number | null
          contact_id?: string | null
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
          lead_id?: string | null
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
          reverse_match_processed?: boolean | null
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
            foreignKeyName: "properties_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
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
      user_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          user_id: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          user_id?: string | null
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          user_id?: string | null
          value?: string
        }
        Relationships: []
      }
      user_smtp_settings: {
        Row: {
          created_at: string | null
          from_email: string
          from_name: string | null
          id: string
          is_active: boolean
          reject_unauthorized: boolean | null
          smtp_host: string
          smtp_password: string
          smtp_port: number
          smtp_secure: boolean
          smtp_username: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          from_email: string
          from_name?: string | null
          id?: string
          is_active?: boolean
          reject_unauthorized?: boolean | null
          smtp_host: string
          smtp_password: string
          smtp_port?: number
          smtp_secure?: boolean
          smtp_username: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          from_email?: string
          from_name?: string | null
          id?: string
          is_active?: boolean
          reject_unauthorized?: boolean | null
          smtp_host?: string
          smtp_password?: string
          smtp_port?: number
          smtp_secure?: boolean
          smtp_username?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_smtp_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "user_smtp_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_settings: {
        Row: {
          access_token: string | null
          business_account_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          phone_number: string | null
          phone_number_id: string | null
          updated_at: string | null
          user_id: string
          verify_token: string | null
        }
        Insert: {
          access_token?: string | null
          business_account_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          phone_number?: string | null
          phone_number_id?: string | null
          updated_at?: string | null
          user_id: string
          verify_token?: string | null
        }
        Update: {
          access_token?: string | null
          business_account_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          phone_number?: string | null
          phone_number_id?: string | null
          updated_at?: string | null
          user_id?: string
          verify_token?: string | null
        }
        Relationships: []
      }
      workflow_cadences: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: number
          id: string
          last_executed_at: string | null
          lead_id: string
          next_execution_date: string | null
          started_at: string
          status: string | null
          stopped_reason: string | null
          updated_at: string
          user_id: string
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          last_executed_at?: string | null
          lead_id: string
          next_execution_date?: string | null
          started_at?: string
          status?: string | null
          stopped_reason?: string | null
          updated_at?: string
          user_id: string
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          last_executed_at?: string | null
          lead_id?: string
          next_execution_date?: string | null
          started_at?: string
          status?: string | null
          stopped_reason?: string | null
          updated_at?: string
          user_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_cadences_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_cadences_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "lead_workflow_rules"
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
      workflow_step_executions: {
        Row: {
          action_config: Json | null
          action_type: string
          cadence_id: string
          created_at: string
          error_message: string | null
          executed_at: string
          id: string
          status: string | null
          step_index: number
        }
        Insert: {
          action_config?: Json | null
          action_type: string
          cadence_id: string
          created_at?: string
          error_message?: string | null
          executed_at?: string
          id?: string
          status?: string | null
          step_index: number
        }
        Update: {
          action_config?: Json | null
          action_type?: string
          cadence_id?: string
          created_at?: string
          error_message?: string | null
          executed_at?: string
          id?: string
          status?: string | null
          step_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflow_step_executions_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "workflow_cadences"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      agent_performance: {
        Row: {
          agent_id: string | null
          agent_name: string | null
          completed_tasks: number | null
          email: string | null
          lost_leads: number | null
          pipeline_value: number | null
          role: Database["public"]["Enums"]["user_role"] | null
          total_leads: number | null
          total_properties: number | null
          total_tasks: number | null
          win_rate: number | null
          won_leads: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      assign_consultant_to_manager: {
        Args: { consultant_id: string; new_manager_id: string }
        Returns: boolean
      }
      can_access_record: { Args: { owner_id: string }; Returns: boolean }
      can_invite_user: { Args: never; Returns: boolean }
      can_manage_user: { Args: { target_user_id: string }; Returns: boolean }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_lead_statistics: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          conversion_rate: number
          converted_leads: number
          new_leads: number
          qualified_leads: number
          total_leads: number
        }[]
      }
      get_meta_sync_cron_info: {
        Args: never
        Returns: {
          active: boolean
          job_name: string
          jobid: number
          last_run: string
          next_run: string
          schedule: string
        }[]
      }
      get_meta_sync_cron_status: {
        Args: never
        Returns: {
          active: boolean
          command: string
          database: string
          jobid: number
          jobname: string
          nodename: string
          nodeport: number
          schedule: string
          username: string
        }[]
      }
      get_pipeline_overview: {
        Args: never
        Returns: {
          count: number
          stage: string
          total_value: number
        }[]
      }
      get_property_statistics: {
        Args: never
        Returns: {
          active_properties: number
          avg_price: number
          sold_properties: number
          total_properties: number
          total_value: number
        }[]
      }
      get_task_statistics: {
        Args: never
        Returns: {
          completed_tasks: number
          completion_rate: number
          overdue_tasks: number
          pending_tasks: number
          total_tasks: number
        }[]
      }
      get_team_agents: { Args: never; Returns: string[] }
      get_team_overview: {
        Args: never
        Returns: {
          active_leads: number
          created_at: string
          email: string
          full_name: string
          last_login: string
          manager_id: string
          manager_name: string
          role: Database["public"]["Enums"]["user_role"]
          total_leads: number
          user_id: string
        }[]
      }
      get_user_role: { Args: never; Returns: string }
      get_visible_user_ids: { Args: never; Returns: string[] }
      get_visible_users_with_details: {
        Args: never
        Returns: {
          email: string
          full_name: string
          id: string
          is_own_record: boolean
          manager_id: string
          role: Database["public"]["Enums"]["user_role"]
        }[]
      }
      invoke_meta_leads_sync: { Args: never; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      is_broker: { Args: never; Returns: boolean }
      is_team_lead: { Args: never; Returns: boolean }
      match_lead_memory: {
        Args: {
          p_lead_id: string
          p_match_count?: number
          p_query_embedding: string
        }
        Returns: {
          content: string
          id: string
          lead_id: string
          similarity: number
          source: string
        }[]
      }
      test_meta_sync: { Args: never; Returns: string }
      test_role_visibility: {
        Args: { test_role: Database["public"]["Enums"]["user_role"] }
        Returns: {
          acessa_integration_settings: boolean
          acessa_system_settings: boolean
          num_visible_users: number
          papel: string
          ve_todos_users: boolean
        }[]
      }
      update_lead_columns_order: {
        Args: { columns_data: Json }
        Returns: undefined
      }
      update_user_role: {
        Args: {
          new_role: Database["public"]["Enums"]["user_role"]
          target_user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      lead_follow_up_state:
        | "new"
        | "first_contact"
        | "in_conversation"
        | "qualified"
        | "no_reply"
        | "reengagement"
        | "archived"
        | "opt_out"
      user_role: "broker" | "team_lead" | "consultant" | "admin"
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
      lead_follow_up_state: [
        "new",
        "first_contact",
        "in_conversation",
        "qualified",
        "no_reply",
        "reengagement",
        "archived",
        "opt_out",
      ],
      user_role: ["broker", "team_lead", "consultant", "admin"],
    },
  },
} as const
