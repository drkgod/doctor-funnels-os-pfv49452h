// AVOID UPDATING THIS FILE DIRECTLY. It is automatically generated.
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
      appointments: {
        Row: {
          created_at: string
          datetime_end: string
          datetime_start: string
          doctor_id: string | null
          google_event_id: string | null
          id: string
          notes: string | null
          patient_id: string
          status: string
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          datetime_end: string
          datetime_start: string
          doctor_id?: string | null
          google_event_id?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          status?: string
          tenant_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          datetime_end?: string
          datetime_start?: string
          doctor_id?: string | null
          google_event_id?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          status?: string
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
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
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          automation_id: string
          error_message: string | null
          executed_at: string
          id: string
          patient_id: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          automation_id: string
          error_message?: string | null
          executed_at?: string
          id?: string
          patient_id?: string | null
          status: string
          tenant_id: string
        }
        Update: {
          automation_id?: string
          error_message?: string | null
          executed_at?: string
          id?: string
          patient_id?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          action_config: Json
          action_type: string
          created_at: string
          execution_count: number
          id: string
          is_active: boolean
          last_executed_at: string | null
          name: string
          tenant_id: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          created_at?: string
          execution_count?: number
          id?: string
          is_active?: boolean
          last_executed_at?: string | null
          name: string
          tenant_id: string
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          created_at?: string
          execution_count?: number
          id?: string
          is_active?: boolean
          last_executed_at?: string | null
          name?: string
          tenant_id?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      body_maps: {
        Row: {
          created_at: string | null
          id: string
          map_type: string
          notes: string | null
          points: Json | null
          record_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          map_type: string
          notes?: string | null
          points?: Json | null
          record_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          map_type?: string
          notes?: string | null
          points?: Json | null
          record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "body_maps_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_configs: {
        Row: {
          created_at: string
          id: string
          max_tokens: number
          model: string
          rag_enabled: boolean
          status: string
          system_prompt: string
          temperature: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_tokens?: number
          model?: string
          rag_enabled?: boolean
          status?: string
          system_prompt?: string
          temperature?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_tokens?: number
          model?: string
          rag_enabled?: boolean
          status?: string
          system_prompt?: string
          temperature?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_documents: {
        Row: {
          bot_config_id: string
          chunk_count: number
          created_at: string
          embedding_status: string
          file_name: string
          file_url: string
          id: string
          tenant_id: string
        }
        Insert: {
          bot_config_id: string
          chunk_count?: number
          created_at?: string
          embedding_status?: string
          file_name: string
          file_url: string
          id?: string
          tenant_id: string
        }
        Update: {
          bot_config_id?: string
          chunk_count?: number
          created_at?: string
          embedding_status?: string
          file_name?: string
          file_url?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_documents_bot_config_id_fkey"
            columns: ["bot_config_id"]
            isOneToOne: false
            referencedRelation: "bot_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_embeddings: {
        Row: {
          bot_document_id: string
          content: string
          created_at: string
          embedding: string
          id: string
          metadata: Json | null
          tenant_id: string
        }
        Insert: {
          bot_document_id: string
          content: string
          created_at?: string
          embedding: string
          id?: string
          metadata?: Json | null
          tenant_id: string
        }
        Update: {
          bot_document_id?: string
          content?: string
          created_at?: string
          embedding?: string
          id?: string
          metadata?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_embeddings_bot_document_id_fkey"
            columns: ["bot_document_id"]
            isOneToOne: false
            referencedRelation: "bot_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_embeddings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          is_bot_active: boolean
          last_message_at: string | null
          patient_id: string | null
          phone_number: string
          status: string
          tenant_id: string
          uazapi_chat_id: string | null
          unread_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_bot_active?: boolean
          last_message_at?: string | null
          patient_id?: string | null
          phone_number: string
          status?: string
          tenant_id: string
          uazapi_chat_id?: string | null
          unread_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_bot_active?: boolean
          last_message_at?: string | null
          patient_id?: string | null
          phone_number?: string
          status?: string
          tenant_id?: string
          uazapi_chat_id?: string | null
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_signatures: {
        Row: {
          created_at: string | null
          doctor_id: string | null
          document_id: string
          document_type: string
          id: string
          ip_address: string | null
          record_id: string | null
          signature_hash: string
          signature_type: string | null
          signed_at: string | null
          signer_crm: string | null
          signer_id: string
          signer_ip: string | null
          signer_name: string
          tenant_id: string
          user_agent: string | null
          verification_code: string | null
        }
        Insert: {
          created_at?: string | null
          doctor_id?: string | null
          document_id: string
          document_type: string
          id?: string
          ip_address?: string | null
          record_id?: string | null
          signature_hash: string
          signature_type?: string | null
          signed_at?: string | null
          signer_crm?: string | null
          signer_id: string
          signer_ip?: string | null
          signer_name: string
          tenant_id: string
          user_agent?: string | null
          verification_code?: string | null
        }
        Update: {
          created_at?: string | null
          doctor_id?: string | null
          document_id?: string
          document_type?: string
          id?: string
          ip_address?: string | null
          record_id?: string | null
          signature_hash?: string
          signature_type?: string | null
          signed_at?: string | null
          signer_crm?: string | null
          signer_id?: string
          signer_ip?: string | null
          signer_name?: string
          tenant_id?: string
          user_agent?: string | null
          verification_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_signatures_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_signatures_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_signatures_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_signatures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          bounced_count: number
          clicked_count: number
          created_at: string
          id: string
          name: string
          opened_count: number
          scheduled_at: string | null
          segment_filter: Json | null
          sent_count: number
          status: string
          template_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          bounced_count?: number
          clicked_count?: number
          created_at?: string
          id?: string
          name: string
          opened_count?: number
          scheduled_at?: string | null
          segment_filter?: Json | null
          sent_count?: number
          status?: string
          template_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          bounced_count?: number
          clicked_count?: number
          created_at?: string
          id?: string
          name?: string
          opened_count?: number
          scheduled_at?: string | null
          segment_filter?: Json | null
          sent_count?: number
          status?: string
          template_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          category: string
          created_at: string
          html_content: string
          id: string
          is_global: boolean
          name: string
          subject: string
          tenant_id: string | null
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          category?: string
          created_at?: string
          html_content: string
          id?: string
          is_global?: boolean
          name: string
          subject: string
          tenant_id?: string | null
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          category?: string
          created_at?: string
          html_content?: string
          id?: string
          is_global?: boolean
          name?: string
          subject?: string
          tenant_id?: string | null
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_record_sections: {
        Row: {
          ai_confidence: number | null
          ai_generated: boolean | null
          content: string | null
          created_at: string | null
          edited_after_ai: boolean | null
          id: string
          record_id: string
          section_type: string
          structured_data: Json | null
          updated_at: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_generated?: boolean | null
          content?: string | null
          created_at?: string | null
          edited_after_ai?: boolean | null
          id?: string
          record_id: string
          section_type: string
          structured_data?: Json | null
          updated_at?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_generated?: boolean | null
          content?: string | null
          created_at?: string | null
          edited_after_ai?: boolean | null
          id?: string
          record_id?: string
          section_type?: string
          structured_data?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_record_sections_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_records: {
        Row: {
          appointment_id: string | null
          chief_complaint: string | null
          completed_at: string | null
          created_at: string | null
          deleted_at: string | null
          doctor_id: string
          document_url: string | null
          id: string
          patient_id: string
          record_type: string
          signature_hash: string | null
          signature_ip: string | null
          signed_at: string | null
          specialty: string
          started_at: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          appointment_id?: string | null
          chief_complaint?: string | null
          completed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          doctor_id: string
          document_url?: string | null
          id?: string
          patient_id: string
          record_type?: string
          signature_hash?: string | null
          signature_ip?: string | null
          signed_at?: string | null
          specialty?: string
          started_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          appointment_id?: string | null
          chief_complaint?: string | null
          completed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          doctor_id?: string
          document_url?: string | null
          id?: string
          patient_id?: string
          record_type?: string
          signature_hash?: string | null
          signature_ip?: string | null
          signed_at?: string | null
          specialty?: string
          started_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_reports: {
        Row: {
          content: string | null
          created_at: string | null
          doctor_id: string
          document_url: string | null
          id: string
          patient_id: string
          record_id: string | null
          report_type: string
          signature_hash: string | null
          signed_at: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          doctor_id: string
          document_url?: string | null
          id?: string
          patient_id: string
          record_id?: string | null
          report_type?: string
          signature_hash?: string | null
          signed_at?: string | null
          tenant_id: string
          title: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          doctor_id?: string
          document_url?: string | null
          id?: string
          patient_id?: string
          record_id?: string | null
          report_type?: string
          signature_hash?: string | null
          signed_at?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_reports_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_reports_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_reports_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          delivery_status: string | null
          direction: string
          id: string
          message_type: string
          sender_type: string
          tenant_id: string
          uazapi_message_id: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          delivery_status?: string | null
          direction: string
          id?: string
          message_type?: string
          sender_type: string
          tenant_id: string
          uazapi_message_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          delivery_status?: string | null
          direction?: string
          id?: string
          message_type?: string
          sender_type?: string
          tenant_id?: string
          uazapi_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          assigned_to: string | null
          cpf: string | null
          created_at: string
          date_of_birth: string | null
          deleted_at: string | null
          email: string | null
          full_name: string
          gender: string | null
          id: string
          notes: string | null
          phone: string | null
          pipeline_stage: string
          source: string
          tags: string[] | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          cpf?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          full_name: string
          gender?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string
          source?: string
          tags?: string[] | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          cpf?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string
          source?: string
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          created_at: string | null
          doctor_id: string
          document_url: string | null
          general_instructions: string | null
          id: string
          medications: Json | null
          patient_id: string
          prescription_type: string
          record_id: string | null
          signature_hash: string | null
          signed_at: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          doctor_id: string
          document_url?: string | null
          general_instructions?: string | null
          id?: string
          medications?: Json | null
          patient_id: string
          prescription_type?: string
          record_id?: string | null
          signature_hash?: string | null
          signed_at?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          doctor_id?: string
          document_url?: string | null
          general_instructions?: string | null
          id?: string
          medications?: Json | null
          patient_id?: string
          prescription_type?: string
          record_id?: string | null
          signature_hash?: string | null
          signed_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          crm_number: string | null
          crm_state: string | null
          deleted_at: string | null
          full_name: string
          id: string
          phone: string | null
          role: string
          specialty: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          crm_number?: string | null
          crm_state?: string | null
          deleted_at?: string | null
          full_name: string
          id: string
          phone?: string | null
          role?: string
          specialty?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          crm_number?: string | null
          crm_state?: string | null
          deleted_at?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          role?: string
          specialty?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      specialty_templates: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean | null
          sections: Json | null
          specialty: string
          template_name: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          sections?: Json | null
          specialty: string
          template_name: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          sections?: Json | null
          specialty?: string
          template_name?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "specialty_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_api_keys: {
        Row: {
          created_at: string
          encrypted_key: string
          id: string
          metadata: Json | null
          provider: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          encrypted_key: string
          id?: string
          metadata?: Json | null
          provider: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          encrypted_key?: string
          id?: string
          metadata?: Json | null
          provider?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_email_usage: {
        Row: {
          created_at: string
          emails_sent: number
          id: string
          limit_reached: boolean
          month: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          emails_sent?: number
          id?: string
          limit_reached?: boolean
          month: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          emails_sent?: number
          id?: string
          limit_reached?: boolean
          month?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_email_usage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_modules: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          limits: Json | null
          module_key: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          limits?: Json | null
          module_key: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          limits?: Json | null
          module_key?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_modules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_whatsapp_usage: {
        Row: {
          created_at: string
          id: string
          limit_reached: boolean
          messages_received: number
          messages_sent: number
          month: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          limit_reached?: boolean
          messages_received?: number
          messages_sent?: number
          month: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          limit_reached?: boolean
          messages_received?: number
          messages_sent?: number
          month?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_whatsapp_usage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address: string | null
          business_hours: Json | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          plan: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_hours?: Json | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          plan?: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_hours?: Json | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          plan?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      transcriptions: {
        Row: {
          audio_url: string | null
          created_at: string | null
          deepgram_request_id: string | null
          duration_seconds: number | null
          error_message: string | null
          id: string
          processed_text: string | null
          raw_text: string | null
          record_id: string
          speaker_segments: Json | null
          status: string
          tenant_id: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string | null
          deepgram_request_id?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          processed_text?: string | null
          raw_text?: string | null
          record_id: string
          speaker_segments?: Json | null
          status?: string
          tenant_id: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string | null
          deepgram_request_id?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          processed_text?: string | null
          raw_text?: string | null
          record_id?: string
          speaker_segments?: Json | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcriptions_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plans: {
        Row: {
          created_at: string | null
          description: string | null
          doctor_id: string
          end_date: string | null
          id: string
          notes: string | null
          paid_value: number | null
          patient_id: string
          procedures: Json | null
          products: Json | null
          start_date: string | null
          status: string
          tenant_id: string
          title: string
          total_value: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          doctor_id: string
          end_date?: string | null
          id?: string
          notes?: string | null
          paid_value?: number | null
          patient_id: string
          procedures?: Json | null
          products?: Json | null
          start_date?: string | null
          status?: string
          tenant_id: string
          title: string
          total_value?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          doctor_id?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          paid_value?: number | null
          patient_id?: string
          procedures?: Json | null
          products?: Json | null
          start_date?: string | null
          status?: string
          tenant_id?: string
          title?: string
          total_value?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plans_doctor_id_fkey"
            columns: ["doctor_id"]
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
            foreignKeyName: "treatment_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_codes: {
        Row: {
          code: string | null
          created_at: string | null
          document_id: string
          document_type: string
          expires_at: string | null
          hash_code: string
          id: string
          is_valid: boolean | null
          record_id: string | null
          signed_at: string
          signer_crm: string | null
          signer_name: string
          tenant_id: string
          type: string | null
          used_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          document_id: string
          document_type: string
          expires_at?: string | null
          hash_code: string
          id?: string
          is_valid?: boolean | null
          record_id?: string | null
          signed_at: string
          signer_crm?: string | null
          signer_name: string
          tenant_id: string
          type?: string | null
          used_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          document_id?: string
          document_type?: string
          expires_at?: string | null
          hash_code?: string
          id?: string
          is_valid?: boolean | null
          record_id?: string | null
          signed_at?: string
          signer_crm?: string | null
          signer_name?: string
          tenant_id?: string
          type?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_codes_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_codes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrypt_api_key: {
        Args: { encrypted_value: string; secret_key: string }
        Returns: string
      }
      encrypt_api_key: {
        Args: { key_value: string; secret_key: string }
        Returns: string
      }
      get_user_role: { Args: never; Returns: string }
      get_user_tenant_id: { Args: never; Returns: string }
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


// ====== DATABASE EXTENDED CONTEXT (auto-generated) ======
// This section contains actual PostgreSQL column types, constraints, RLS policies,
// functions, triggers, indexes and materialized views not present in the type definitions above.
// IMPORTANT: The TypeScript types above map UUID, TEXT, VARCHAR all to "string".
// Use the COLUMN TYPES section below to know the real PostgreSQL type for each column.
// Always use the correct PostgreSQL type when writing SQL migrations.

// --- COLUMN TYPES (actual PostgreSQL types) ---
// Use this to know the real database type when writing migrations.
// "string" in TypeScript types above may be uuid, text, varchar, timestamptz, etc.
// Table: appointments
//   id: uuid (not null, default: gen_random_uuid())
//   tenant_id: uuid (not null)
//   patient_id: uuid (not null)
//   doctor_id: uuid (nullable)
//   datetime_start: timestamp with time zone (not null)
//   datetime_end: timestamp with time zone (not null)
//   type: text (not null, default: 'consultation'::text)
//   status: text (not null, default: 'pending'::text)
//   google_event_id: text (nullable)
//   notes: text (nullable)
//   created_at: timestamp with time zone (not null, default: now())
//   updated_at: timestamp with time zone (not null, default: now())
// Table: audit_logs
//   id: uuid (not null, default: gen_random_uuid())
//   tenant_id: uuid (nullable)
//   user_id: uuid (nullable)
//   action: text (not null)
//   entity_type: text (nullable)
//   entity_id: uuid (nullable)
//   details: jsonb (nullable)
//   ip_address: text (nullable)
//   created_at: timestamp with time zone (not null, default: now())
// Table: automation_logs
//   id: uuid (not null, default: gen_random_uuid())
//   tenant_id: uuid (not null)
//   automation_id: uuid (not null)
//   patient_id: uuid (nullable)
//   status: text (not null)
//   error_message: text (nullable)
//   executed_at: timestamp with time zone (not null, default: now())
// Table: automations
//   id: uuid (not null, default: gen_random_uuid())
//   tenant_id: uuid (not null)
//   name: text (not null)
//   trigger_type: text (not null)
//   trigger_config: jsonb (not null, default: '{}'::jsonb)
//   action_type: text (not null)
//   action_config: jsonb (not null, default: '{}'::jsonb)
//   is_active: boolean (not null, default: false)
//   execution_count: integer (not null, default: 0)
//   last_executed_at: timestamp with time zone (nullable)
//   created_at: timestamp with time zone (not null, default: now())
//   updated_at: timestamp with time zone (not null, default: now())
// Table: body_maps
//   id: uuid (not null, default: gen_random_uuid())
//   record_id: uuid (not null)
//   map_type: text (not null)
//   points: jsonb (nullable, default: '[]'::jsonb)
//   notes: text (nullable, default: ''::text)
//   created_at: timestamp with time zone (nullable, default: now())
// Table: bot_configs
//   id: uuid (not null, default: gen_random_uuid())
//   tenant_id: uuid (not null)
//   model: text (not null, default: 'gpt-4o'::text)
//   system_prompt: text (not null, default: ''::text)
//   temperature: numeric (not null, default: 0.7)
//   max_tokens: integer (not null, default: 1024)
//   rag_enabled: boolean (not null, default: false)
//   status: text (not null, default: 'paused'::text)
//   created_at: timestamp with time zone (not null, default: now())
//   updated_at: timestamp with time zone (not null, default: now())
// Table: bot_documents
//   id: uuid (not null, default: gen_random_uuid())
//   tenant_id: uuid (not null)
//   bot_config_id: uuid (not null)
//   file_name: text (not null)
//   file_url: text (not null)
//   embedding_status: text (not null, default: 'pending'::text)
//   chunk_count: integer (not null, default: 0)
//   created_at: timestamp with time zone (not null, default: now())
// Table: bot_embeddings
//   id: uuid (not null, default: gen_random_uuid())
//   tenant_id: uuid (not null)
//   bot_document_id: uuid (not null)
//   content: text (not null)
//   embedding: vector (not null)
//   metadata: jsonb (nullable)
//   created_at: timestamp with time zone (not null, default: now())
// Table: conversations
//   id: uuid (not null, default: gen_random_uuid())
//   tenant_id: uuid (not null)
//   patient_id: uuid (nullable)
//   uazapi_chat_id: text (nullable)
//   phone_number: text (not null)
//   last_message_at: timestamp with time zone (nullable)
//   status: text (not null, default: 'active'::text)
//   is_bot_active: boolean (not null, default: true)
//   unread_count: integer (not null, default: 0)
//   created_at: timestamp with time zone (not null, default: now())
//   updated_at: timestamp with time zone (not null, default: now())
// Table: document_signatures
//   id: uuid (not null, default: gen_random_uuid())
//   document_type: text (not null)
//   document_id: uuid (not null)
//   tenant_id: uuid (not null)
//   signer_id: uuid (not null)
//   signer_name: text (not null)
//   signer_crm: text (nullable)
//   signature_hash: text (not null)
//   signer_ip: text (nullable)
//   user_agent: text (nullable)
//   signed_at: timestamp with time zone (nullable, default: now())
//   created_at: timestamp with time zone (nullable, default: now())
//   verification_code: text (nullable)
//   doctor_id: uuid (nullable)
//   record_id: uuid (nullable)
//   signature_type: text (nullable)
//   ip_address: text (nullable)
// Table: email_campaigns
//   id: uuid (not null, default: gen_random_uuid())
//   tenant_id: uuid (not null)
//   template_id: uuid (nullable)
//   name: text (not null)
//   segment_filter: jsonb (nullable)
//   status: text (not null, default: 'draft'::text)
//   scheduled_at: timestamp with time zone (nullable)
//   sent_count: integer (not null, default: 0)
//   opened_count: integer (not null, default: 0)
//   clicked_count: integer (not null, default: 0)
//   bounced_count: integer (not null, default: 0)
//   created_at: timestamp with time zone (not null, default: now())
//   updated_at: timestamp with time zone (not null, default: now())
// Table: email_templates
//   id: uuid (not null, default: gen_random_uuid())
//   tenant_id: uuid (nullable)
//   name: text (not null)
//   subject: text (not null)
//   html_content: text (not null)
//   category: text (not null, default: 'marketing'::text)
//   variables: _text (nullable, default: '{}'::text[])
//   is_global: boolean (not null, default: false)
//   created_at: timestamp with time zone (not null, default: now())
//   updated_at: timestamp with time zone (not null, default: now())
// Table: medical_record_sections
//   id: uuid (not null, default: gen_random_uuid())
//   record_id: uuid (not null)
//   section_type: text (not null)
//   content: text (nullable, default: ''::text)
//   structured_data: jsonb (nullable, default: '{}'::jsonb)
//   ai_generated: boolean (nullable, default: false)
//   ai_confidence: numeric (nullable)
//   edited_after_ai: boolean (nullable, default: false)
//   created_at: timestamp with time zone (nullable, default: now())
//   updated_at: timestamp with time zone (nullable, default: now())
// Table: medical_records
//   id: uuid (not null, default: gen_random_uuid())
//   tenant_id: uuid (not null)
//   patient_id: uuid (not null)
//   doctor_id: uuid (not null)
//   appointment_id: uuid (nullable)
//   specialty: text (not null, default: 'general'::text)
//   record_type: text (not null, default: 'consultation'::text)
//   status: text (not null, default: 'in_progress'::text)
//   chief_complaint: text (nullable)
//   started_at: timestamp with time zone (nullable, default: now())
//   completed_at: timestamp with time zone (nullable)
//   signed_at: timestamp with time zone (nullable)
//   signature_hash: text (nullable)
//   signature_ip: text (nullable)
//   document_url: text (nullable)
//   created_at: timestamp with time zone (nullable, default: now())
//   updated_at: timestamp with time zone (nullable, default: now())
//   deleted_at: timestamp with time zone (nullable)
// Table: medical_reports
//   id: uuid (not null, default: gen_random_uuid())
//   record_id: uuid (nullable)
//   tenant_id: uuid (not null)
//   patient_id: uuid (not null)
//   doctor_id: uuid (not null)
//   report_type: text (not null, default: 'custom'::text)
//   title: text (not null)
//   content: text (nullable, default: ''::text)
//   document_url: text (nullable)
//   signed_at: timestamp with time zone (nullable)
//   signature_hash: text (nullable)
//   created_at: timestamp with time zone (nullable, default: now())
// Table: messages
//   id: uuid (not null, default: gen_random_uuid())
//   tenant_id: uuid (not null)
//   conversation_id: uuid (not null)
//   direction: text (not null)
//   sender_type: text (not null)
//   content: text (not null)
//   message_type: text (not null, default: 'text'::text)
//   uazapi_message_id: text (nullable)
//   delivery_status: text (nullable)
//   created_at: timestamp with time zone (not null, default: now())
// Table: patients
//   id: uuid (not null, default: gen_random_uuid())
//   tenant_id: uuid (not null)
//   full_name: text (not null)
//   email: text (nullable)
//   phone: text (nullable)
//   cpf: text (nullable)
//   date_of_birth: date (nullable)
//   gender: text (nullable)
//   address: text (nullable)
//   source: text (not null, default: 'whatsapp'::text)
//   tags: _text (nullable, default: '{}'::text[])
//   notes: text (nullable)
//   pipeline_stage: text (not null, default: 'lead'::text)
//   assigned_to: uuid (nullable)
//   created_at: timestamp with time zone (not null, default: now())
//   updated_at: timestamp with time zone (not null, default: now())
//   deleted_at: timestamp with time zone (nullable)
// Table: prescriptions
//   id: uuid (not null, default: gen_random_uuid())
//   record_id: uuid (nullable)
//   tenant_id: uuid (not null)
//   patient_id: uuid (not null)
//   doctor_id: uuid (not null)
//   prescription_type: text (not null, default: 'simple'::text)
//   medications: jsonb (nullable, default: '[]'::jsonb)
//   general_instructions: text (nullable, default: ''::text)
//   document_url: text (nullable)
//   signed_at: timestamp with time zone (nullable)
//   signature_hash: text (nullable)
//   created_at: timestamp with time zone (nullable, default: now())
// Table: profiles
//   id: uuid (not null)
//   tenant_id: uuid (nullable)
//   full_name: text (not null)
//   role: text (not null, default: 'doctor'::text)
//   avatar_url: text (nullable)
//   phone: text (nullable)
//   created_at: timestamp with time zone (not null, default: now())
//   updated_at: timestamp with time zone (not null, default: now())
//   deleted_at: timestamp with time zone (nullable)
//   specialty: text (nullable)
//   crm_number: text (nullable)
//   crm_state: text (nullable)
// Table: specialty_templates
//   id: uuid (not null, default: gen_random_uuid())
//   tenant_id: uuid (nullable)
//   specialty: text (not null)
//   template_name: text (not null)
//   sections: jsonb (nullable, default: '[]'::jsonb)
//   is_default: boolean (nullable, default: false)
//   created_at: timestamp with time zone (nullable, default: now())
//   updated_at: timestamp with time zone (nullable, default: now())
// Table: tenant_api_keys
//   id: uuid (not null, default: gen_random_uuid())
//   tenant_id: uuid (not null)
//   provider: text (not null)
//   encrypted_key: text (not null)
//   metadata: jsonb (nullable)
//   status: text (not null, default: 'active'::text)
//   created_at: timestamp with time zone (not null, default: now())
//   updated_at: timestamp with time zone (not null, default: now())
// Table: tenant_email_usage
//   id: uuid (not null, default: gen_random_uuid())
//   tenant_id: uuid (not null)
//   month: date (not null)
//   emails_sent: integer (not null, default: 0)
//   limit_reached: boolean (not null, default: false)
//   created_at: timestamp with time zone (not null, default: now())
//   updated_at: timestamp with time zone (not null, default: now())
// Table: tenant_modules
//   id: uuid (not null, default: gen_random_uuid())
//   tenant_id: uuid (not null)
//   module_key: text (not null)
//   is_enabled: boolean (not null, default: false)
//   limits: jsonb (nullable)
//   created_at: timestamp with time zone (not null, default: now())
//   updated_at: timestamp with time zone (not null, default: now())
// Table: tenant_whatsapp_usage
//   id: uuid (not null, default: gen_random_uuid())
//   tenant_id: uuid (not null)
//   month: date (not null)
//   messages_sent: integer (not null, default: 0)
//   messages_received: integer (not null, default: 0)
//   limit_reached: boolean (not null, default: false)
//   created_at: timestamp with time zone (not null, default: now())
//   updated_at: timestamp with time zone (not null, default: now())
// Table: tenants
//   id: uuid (not null, default: gen_random_uuid())
//   name: text (not null)
//   slug: text (not null)
//   plan: text (not null, default: 'essential'::text)
//   status: text (not null, default: 'trial'::text)
//   logo_url: text (nullable)
//   address: text (nullable)
//   phone: text (nullable)
//   business_hours: jsonb (nullable)
//   created_at: timestamp with time zone (not null, default: now())
//   updated_at: timestamp with time zone (not null, default: now())
// Table: transcriptions
//   id: uuid (not null, default: gen_random_uuid())
//   record_id: uuid (not null)
//   tenant_id: uuid (not null)
//   raw_text: text (nullable, default: ''::text)
//   processed_text: text (nullable, default: ''::text)
//   duration_seconds: integer (nullable, default: 0)
//   speaker_segments: jsonb (nullable, default: '[]'::jsonb)
//   status: text (not null, default: 'recording'::text)
//   audio_url: text (nullable)
//   deepgram_request_id: text (nullable)
//   error_message: text (nullable)
//   created_at: timestamp with time zone (nullable, default: now())
// Table: treatment_plans
//   id: uuid (not null, default: gen_random_uuid())
//   tenant_id: uuid (not null)
//   patient_id: uuid (not null)
//   doctor_id: uuid (not null)
//   title: text (not null)
//   description: text (nullable, default: ''::text)
//   procedures: jsonb (nullable, default: '[]'::jsonb)
//   products: jsonb (nullable, default: '[]'::jsonb)
//   total_value: numeric (nullable, default: 0)
//   paid_value: numeric (nullable, default: 0)
//   status: text (not null, default: 'planned'::text)
//   start_date: date (nullable)
//   end_date: date (nullable)
//   notes: text (nullable, default: ''::text)
//   created_at: timestamp with time zone (nullable, default: now())
//   updated_at: timestamp with time zone (nullable, default: now())
// Table: verification_codes
//   id: uuid (not null, default: gen_random_uuid())
//   hash_code: text (not null)
//   document_type: text (not null)
//   document_id: uuid (not null)
//   tenant_id: uuid (not null)
//   signer_name: text (not null)
//   signer_crm: text (nullable)
//   signed_at: timestamp with time zone (not null)
//   is_valid: boolean (nullable, default: true)
//   created_at: timestamp with time zone (nullable, default: now())
//   code: text (nullable)
//   type: text (nullable)
//   expires_at: timestamp with time zone (nullable)
//   used_at: timestamp with time zone (nullable)
//   record_id: uuid (nullable)

// --- CONSTRAINTS ---
// Table: appointments
//   FOREIGN KEY appointments_doctor_id_fkey: FOREIGN KEY (doctor_id) REFERENCES profiles(id) ON DELETE SET NULL
//   FOREIGN KEY appointments_patient_id_fkey: FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
//   PRIMARY KEY appointments_pkey: PRIMARY KEY (id)
//   CHECK appointments_status_check: CHECK ((status = ANY (ARRAY['confirmed'::text, 'pending'::text, 'cancelled'::text, 'no_show'::text, 'completed'::text])))
//   FOREIGN KEY appointments_tenant_id_fkey: FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
//   CHECK appointments_type_check: CHECK ((type = ANY (ARRAY['consultation'::text, 'return'::text, 'procedure'::text])))
// Table: audit_logs
//   PRIMARY KEY audit_logs_pkey: PRIMARY KEY (id)
//   FOREIGN KEY audit_logs_tenant_id_fkey: FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
//   FOREIGN KEY audit_logs_user_id_fkey: FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL
// Table: automation_logs
//   FOREIGN KEY automation_logs_automation_id_fkey: FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
//   FOREIGN KEY automation_logs_patient_id_fkey: FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
//   PRIMARY KEY automation_logs_pkey: PRIMARY KEY (id)
//   CHECK automation_logs_status_check: CHECK ((status = ANY (ARRAY['success'::text, 'failed'::text, 'skipped'::text])))
//   FOREIGN KEY automation_logs_tenant_id_fkey: FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
// Table: automations
//   CHECK automations_action_type_check: CHECK ((action_type = ANY (ARRAY['send_whatsapp'::text, 'send_email'::text, 'move_pipeline'::text, 'create_task'::text])))
//   PRIMARY KEY automations_pkey: PRIMARY KEY (id)
//   FOREIGN KEY automations_tenant_id_fkey: FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
//   CHECK automations_trigger_type_check: CHECK ((trigger_type = ANY (ARRAY['stage_change'::text, 'time_after_event'::text, 'new_lead'::text, 'manual'::text, 'webhook'::text])))
// Table: body_maps
//   CHECK body_maps_map_type_check: CHECK ((map_type = ANY (ARRAY['body_front'::text, 'body_back'::text, 'face_front'::text, 'face_left'::text, 'face_right'::text, 'head_top'::text, 'hands'::text, 'feet'::text])))
//   PRIMARY KEY body_maps_pkey: PRIMARY KEY (id)
//   FOREIGN KEY body_maps_record_id_fkey: FOREIGN KEY (record_id) REFERENCES medical_records(id) ON DELETE CASCADE
// Table: bot_configs
//   PRIMARY KEY bot_configs_pkey: PRIMARY KEY (id)
//   CHECK bot_configs_status_check: CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text])))
//   CHECK bot_configs_temperature_check: CHECK (((temperature >= (0)::numeric) AND (temperature <= (2)::numeric)))
//   FOREIGN KEY bot_configs_tenant_id_fkey: FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
//   UNIQUE bot_configs_tenant_id_key: UNIQUE (tenant_id)
// Table: bot_documents
//   FOREIGN KEY bot_documents_bot_config_id_fkey: FOREIGN KEY (bot_config_id) REFERENCES bot_configs(id) ON DELETE CASCADE
//   CHECK bot_documents_embedding_status_check: CHECK ((embedding_status = ANY (ARRAY['pending'::text, 'processing'::text, 'ready'::text, 'error'::text])))
//   PRIMARY KEY bot_documents_pkey: PRIMARY KEY (id)
//   FOREIGN KEY bot_documents_tenant_id_fkey: FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
// Table: bot_embeddings
//   FOREIGN KEY bot_embeddings_bot_document_id_fkey: FOREIGN KEY (bot_document_id) REFERENCES bot_documents(id) ON DELETE CASCADE
//   PRIMARY KEY bot_embeddings_pkey: PRIMARY KEY (id)
//   FOREIGN KEY bot_embeddings_tenant_id_fkey: FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
// Table: conversations
//   FOREIGN KEY conversations_patient_id_fkey: FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
//   PRIMARY KEY conversations_pkey: PRIMARY KEY (id)
//   CHECK conversations_status_check: CHECK ((status = ANY (ARRAY['active'::text, 'waiting'::text, 'closed'::text])))
//   FOREIGN KEY conversations_tenant_id_fkey: FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
// Table: document_signatures
//   FOREIGN KEY document_signatures_doctor_id_fkey: FOREIGN KEY (doctor_id) REFERENCES profiles(id)
//   CHECK document_signatures_document_type_check: CHECK ((document_type = ANY (ARRAY['medical_record'::text, 'prescription'::text, 'report'::text, 'treatment_plan'::text])))
//   PRIMARY KEY document_signatures_pkey: PRIMARY KEY (id)
//   FOREIGN KEY document_signatures_record_id_fkey: FOREIGN KEY (record_id) REFERENCES medical_records(id)
//   FOREIGN KEY document_signatures_signer_id_fkey: FOREIGN KEY (signer_id) REFERENCES profiles(id) ON DELETE SET NULL
//   FOREIGN KEY document_signatures_tenant_id_fkey: FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
// Table: email_campaigns
//   PRIMARY KEY email_campaigns_pkey: PRIMARY KEY (id)
//   CHECK email_campaigns_status_check: CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'sending'::text, 'sent'::text, 'failed'::text])))
//   FOREIGN KEY email_campaigns_template_id_fkey: FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE SET NULL
//   FOREIGN KEY email_campaigns_tenant_id_fkey: FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
// Table: email_templates
//   CHECK email_templates_category_check: CHECK ((category = ANY (ARRAY['transactional'::text, 'marketing'::text, 'automation'::text])))
//   PRIMARY KEY email_templates_pkey: PRIMARY KEY (id)
//   FOREIGN KEY email_templates_tenant_id_fkey: FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
// Table: medical_record_sections
//   PRIMARY KEY medical_record_sections_pkey: PRIMARY KEY (id)
//   FOREIGN KEY medical_record_sections_record_id_fkey: FOREIGN KEY (record_id) REFERENCES medical_records(id) ON DELETE CASCADE
//   CHECK medical_record_sections_section_type_check: CHECK ((section_type = ANY (ARRAY['subjective'::text, 'objective'::text, 'assessment'::text, 'plan'::text, 'anamnesis'::text, 'physical_exam'::text, 'procedures'::text, 'evolution'::text, 'specialty_fields'::text, 'vital_signs'::text])))
// Table: medical_records
//   FOREIGN KEY medical_records_appointment_id_fkey: FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
//   FOREIGN KEY medical_records_doctor_id_fkey: FOREIGN KEY (doctor_id) REFERENCES profiles(id) ON DELETE SET NULL
//   FOREIGN KEY medical_records_patient_id_fkey: FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
//   PRIMARY KEY medical_records_pkey: PRIMARY KEY (id)
//   CHECK medical_records_record_type_check: CHECK ((record_type = ANY (ARRAY['consultation'::text, 'return'::text, 'procedure'::text, 'emergency'::text])))
//   CHECK medical_records_status_check: CHECK ((status = ANY (ARRAY['in_progress'::text, 'review'::text, 'completed'::text, 'signed'::text])))
//   FOREIGN KEY medical_records_tenant_id_fkey: FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
// Table: medical_reports
//   FOREIGN KEY medical_reports_doctor_id_fkey: FOREIGN KEY (doctor_id) REFERENCES profiles(id) ON DELETE SET NULL
//   FOREIGN KEY medical_reports_patient_id_fkey: FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
//   PRIMARY KEY medical_reports_pkey: PRIMARY KEY (id)
//   FOREIGN KEY medical_reports_record_id_fkey: FOREIGN KEY (record_id) REFERENCES medical_records(id) ON DELETE SET NULL
//   CHECK medical_reports_report_type_check: CHECK ((report_type = ANY (ARRAY['exam'::text, 'referral'::text, 'certificate'::text, 'medical_report'::text, 'sick_note'::text, 'custom'::text])))
//   FOREIGN KEY medical_reports_tenant_id_fkey: FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
// Table: messages
//   FOREIGN KEY messages_conversation_id_fkey: FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
//   CHECK messages_delivery_status_check: CHECK (((delivery_status = ANY (ARRAY['sent'::text, 'delivered'::text, 'read'::text, 'failed'::text])) OR (delivery_status IS NULL)))
//   CHECK messages_direction_check: CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text])))
//   CHECK messages_message_type_check: CHECK ((message_type = ANY (ARRAY['text'::text, 'image'::text, 'audio'::text, 'document'::text, 'video'::text])))
//   PRIMARY KEY messages_pkey: PRIMARY KEY (id)
//   CHECK messages_sender_type_check: CHECK ((sender_type = ANY (ARRAY['patient'::text, 'bot'::text, 'human'::text])))
//   FOREIGN KEY messages_tenant_id_fkey: FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
// Table: patients
//   FOREIGN KEY patients_assigned_to_fkey: FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL
//   CHECK patients_gender_check: CHECK (((gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text])) OR (gender IS NULL)))
//   CHECK patients_pipeline_stage_check: CHECK ((pipeline_stage = ANY (ARRAY['lead'::text, 'contact'::text, 'scheduled'::text, 'consultation'::text, 'return'::text, 'procedure'::text])))
//   PRIMARY KEY patients_pkey: PRIMARY KEY (id)
//   CHECK patients_source_check: CHECK ((source = ANY (ARRAY['whatsapp'::text, 'form'::text, 'phone'::text, 'referral'::text, 'doctoralia'::text, 'manual'::text])))
//   FOREIGN KEY patients_tenant_id_fkey: FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
// Table: prescriptions
//   FOREIGN KEY prescriptions_doctor_id_fkey: FOREIGN KEY (doctor_id) REFERENCES profiles(id) ON DELETE SET NULL
//   FOREIGN KEY prescriptions_patient_id_fkey: FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
//   PRIMARY KEY prescriptions_pkey: PRIMARY KEY (id)
//   CHECK prescriptions_prescription_type_check: CHECK ((prescription_type = ANY (ARRAY['simple'::text, 'controlled_b1'::text, 'controlled_a1'::text, 'special'::text, 'antimicrobial'::text])))
//   FOREIGN KEY prescriptions_record_id_fkey: FOREIGN KEY (record_id) REFERENCES medical_records(id) ON DELETE SET NULL
//   FOREIGN KEY prescriptions_tenant_id_fkey: FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
// Table: profiles
//   FOREIGN KEY profiles_id_fkey: FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
//   PRIMARY KEY profiles_pkey: PRIMARY KEY (id)
//   CHECK profiles_role_check: CHECK ((role = ANY (ARRAY['super_admin'::text, 'doctor'::text, 'secretary'::text])))
//   FOREIGN KEY profiles_tenant_id_fkey: FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
// Table: specialty_templates
//   PRIMARY KEY specialty_templates_pkey: PRIMARY KEY (id)
//   FOREIGN KEY specialty_templates_tenant_id_fkey: FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
// Table: tenant_api_keys
//   PRIMARY KEY tenant_api_keys_pkey: PRIMARY KEY (id)
//   CHECK tenant_api_keys_provider_check: CHECK ((provider = ANY (ARRAY['uazapi'::text, 'resend'::text, 'google_calendar'::text, 'openai'::text, 'deepgram'::text])))
//   CHECK tenant_api_keys_status_check: CHECK ((status = ANY (ARRAY['active'::text, 'error'::text, 'expired'::text])))
//   FOREIGN KEY tenant_api_keys_tenant_id_fkey: FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
//   UNIQUE unique_tenant_provider: UNIQUE (tenant_id, provider)
// Table: tenant_email_usage
//   PRIMARY KEY tenant_email_usage_pkey: PRIMARY KEY (id)
//   FOREIGN KEY tenant_email_usage_tenant_id_fkey: FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
//   UNIQUE tenant_email_usage_tenant_month_key: UNIQUE (tenant_id, month)
// Table: tenant_modules
//   CHECK tenant_modules_module_key_check: CHECK ((module_key = ANY (ARRAY['crm'::text, 'whatsapp'::text, 'email'::text, 'agenda'::text, 'dashboard'::text, 'templates'::text, 'automations'::text, 'ai_chatbot'::text, 'prontuarios'::text, 'reports'::text])))
//   PRIMARY KEY tenant_modules_pkey: PRIMARY KEY (id)
//   FOREIGN KEY tenant_modules_tenant_id_fkey: FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
//   UNIQUE tenant_modules_tenant_key: UNIQUE (tenant_id, module_key)
// Table: tenant_whatsapp_usage
//   PRIMARY KEY tenant_whatsapp_usage_pkey: PRIMARY KEY (id)
//   FOREIGN KEY tenant_whatsapp_usage_tenant_id_fkey: FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
//   UNIQUE tenant_whatsapp_usage_tenant_month_key: UNIQUE (tenant_id, month)
// Table: tenants
//   PRIMARY KEY tenants_pkey: PRIMARY KEY (id)
//   CHECK tenants_plan_check: CHECK ((plan = ANY (ARRAY['essential'::text, 'professional'::text, 'clinic'::text])))
//   UNIQUE tenants_slug_key: UNIQUE (slug)
//   CHECK tenants_status_check: CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'trial'::text, 'cancelled'::text])))
// Table: transcriptions
//   PRIMARY KEY transcriptions_pkey: PRIMARY KEY (id)
//   FOREIGN KEY transcriptions_record_id_fkey: FOREIGN KEY (record_id) REFERENCES medical_records(id) ON DELETE CASCADE
//   CHECK transcriptions_status_check: CHECK ((status = ANY (ARRAY['recording'::text, 'uploading'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
//   FOREIGN KEY transcriptions_tenant_id_fkey: FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
// Table: treatment_plans
//   FOREIGN KEY treatment_plans_doctor_id_fkey: FOREIGN KEY (doctor_id) REFERENCES profiles(id) ON DELETE SET NULL
//   FOREIGN KEY treatment_plans_patient_id_fkey: FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
//   PRIMARY KEY treatment_plans_pkey: PRIMARY KEY (id)
//   CHECK treatment_plans_status_check: CHECK ((status = ANY (ARRAY['planned'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])))
//   FOREIGN KEY treatment_plans_tenant_id_fkey: FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
// Table: verification_codes
//   UNIQUE verification_codes_hash_code_key: UNIQUE (hash_code)
//   PRIMARY KEY verification_codes_pkey: PRIMARY KEY (id)
//   FOREIGN KEY verification_codes_record_id_fkey: FOREIGN KEY (record_id) REFERENCES medical_records(id)
//   FOREIGN KEY verification_codes_tenant_id_fkey: FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE

// --- ROW LEVEL SECURITY POLICIES ---
// Table: appointments
//   Policy "super_admin_all" (ALL, PERMISSIVE) roles={public}
//     USING: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_crud" (ALL, PERMISSIVE) roles={public}
//     USING: (tenant_id = get_user_tenant_id())
// Table: audit_logs
//   Policy "super_admin_all" (ALL, PERMISSIVE) roles={public}
//     USING: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_select" (SELECT, PERMISSIVE) roles={public}
//     USING: (tenant_id = get_user_tenant_id())
// Table: automation_logs
//   Policy "super_admin_all" (ALL, PERMISSIVE) roles={public}
//     USING: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_select" (SELECT, PERMISSIVE) roles={public}
//     USING: (tenant_id = get_user_tenant_id())
// Table: automations
//   Policy "super_admin_all" (ALL, PERMISSIVE) roles={public}
//     USING: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_crud" (ALL, PERMISSIVE) roles={public}
//     USING: (tenant_id = get_user_tenant_id())
// Table: body_maps
//   Policy "sa_all_body_maps" (ALL, PERMISSIVE) roles={authenticated}
//     USING: (get_user_role() = 'super_admin'::text)
//     WITH CHECK: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_delete_body_maps" (DELETE, PERMISSIVE) roles={authenticated}
//     USING: (EXISTS ( SELECT 1    FROM medical_records mr   WHERE ((mr.id = body_maps.record_id) AND (mr.tenant_id = get_user_tenant_id()))))
//   Policy "tenant_insert_body_maps" (INSERT, PERMISSIVE) roles={authenticated}
//     WITH CHECK: (EXISTS ( SELECT 1    FROM medical_records mr   WHERE ((mr.id = body_maps.record_id) AND (mr.tenant_id = get_user_tenant_id()))))
//   Policy "tenant_select_body_maps" (SELECT, PERMISSIVE) roles={authenticated}
//     USING: (EXISTS ( SELECT 1    FROM medical_records mr   WHERE ((mr.id = body_maps.record_id) AND (mr.tenant_id = get_user_tenant_id()))))
//   Policy "tenant_update_body_maps" (UPDATE, PERMISSIVE) roles={authenticated}
//     USING: (EXISTS ( SELECT 1    FROM medical_records mr   WHERE ((mr.id = body_maps.record_id) AND (mr.tenant_id = get_user_tenant_id()))))
//     WITH CHECK: (EXISTS ( SELECT 1    FROM medical_records mr   WHERE ((mr.id = body_maps.record_id) AND (mr.tenant_id = get_user_tenant_id()))))
// Table: bot_configs
//   Policy "super_admin_all" (ALL, PERMISSIVE) roles={public}
//     USING: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_select" (SELECT, PERMISSIVE) roles={public}
//     USING: (tenant_id = get_user_tenant_id())
// Table: bot_documents
//   Policy "super_admin_all" (ALL, PERMISSIVE) roles={public}
//     USING: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_select" (SELECT, PERMISSIVE) roles={public}
//     USING: (tenant_id = get_user_tenant_id())
// Table: bot_embeddings
//   Policy "super_admin_all" (ALL, PERMISSIVE) roles={public}
//     USING: (get_user_role() = 'super_admin'::text)
// Table: conversations
//   Policy "super_admin_all" (ALL, PERMISSIVE) roles={public}
//     USING: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_crud" (ALL, PERMISSIVE) roles={public}
//     USING: (tenant_id = get_user_tenant_id())
// Table: document_signatures
//   Policy "sa_all_doc_signatures" (ALL, PERMISSIVE) roles={authenticated}
//     USING: (get_user_role() = 'super_admin'::text)
//     WITH CHECK: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_insert_doc_signatures" (INSERT, PERMISSIVE) roles={authenticated}
//     WITH CHECK: (tenant_id = get_user_tenant_id())
//   Policy "tenant_select_doc_signatures" (SELECT, PERMISSIVE) roles={authenticated}
//     USING: (tenant_id = get_user_tenant_id())
// Table: email_campaigns
//   Policy "super_admin_all" (ALL, PERMISSIVE) roles={public}
//     USING: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_crud" (ALL, PERMISSIVE) roles={public}
//     USING: (tenant_id = get_user_tenant_id())
// Table: email_templates
//   Policy "global_templates_select" (SELECT, PERMISSIVE) roles={public}
//     USING: (is_global = true)
//   Policy "super_admin_all" (ALL, PERMISSIVE) roles={public}
//     USING: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_crud" (ALL, PERMISSIVE) roles={public}
//     USING: (tenant_id = get_user_tenant_id())
// Table: medical_record_sections
//   Policy "sa_all_record_sections" (ALL, PERMISSIVE) roles={authenticated}
//     USING: (get_user_role() = 'super_admin'::text)
//     WITH CHECK: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_insert_record_sections" (INSERT, PERMISSIVE) roles={authenticated}
//     WITH CHECK: (EXISTS ( SELECT 1    FROM medical_records mr   WHERE ((mr.id = medical_record_sections.record_id) AND (mr.tenant_id = get_user_tenant_id()))))
//   Policy "tenant_select_record_sections" (SELECT, PERMISSIVE) roles={authenticated}
//     USING: (EXISTS ( SELECT 1    FROM medical_records mr   WHERE ((mr.id = medical_record_sections.record_id) AND (mr.tenant_id = get_user_tenant_id()))))
//   Policy "tenant_update_record_sections" (UPDATE, PERMISSIVE) roles={authenticated}
//     USING: (EXISTS ( SELECT 1    FROM medical_records mr   WHERE ((mr.id = medical_record_sections.record_id) AND (mr.tenant_id = get_user_tenant_id()))))
// Table: medical_records
//   Policy "sa_all_medical_records" (ALL, PERMISSIVE) roles={authenticated}
//     USING: (get_user_role() = 'super_admin'::text)
//     WITH CHECK: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_insert_medical_records" (INSERT, PERMISSIVE) roles={authenticated}
//     WITH CHECK: (tenant_id = get_user_tenant_id())
//   Policy "tenant_select_medical_records" (SELECT, PERMISSIVE) roles={authenticated}
//     USING: (tenant_id = get_user_tenant_id())
//   Policy "tenant_update_medical_records" (UPDATE, PERMISSIVE) roles={authenticated}
//     USING: (tenant_id = get_user_tenant_id())
//     WITH CHECK: (tenant_id = get_user_tenant_id())
// Table: medical_reports
//   Policy "sa_all_med_reports" (ALL, PERMISSIVE) roles={authenticated}
//     USING: (get_user_role() = 'super_admin'::text)
//     WITH CHECK: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_insert_med_reports" (INSERT, PERMISSIVE) roles={authenticated}
//     WITH CHECK: (tenant_id = get_user_tenant_id())
//   Policy "tenant_select_med_reports" (SELECT, PERMISSIVE) roles={authenticated}
//     USING: (tenant_id = get_user_tenant_id())
//   Policy "tenant_update_med_reports" (UPDATE, PERMISSIVE) roles={authenticated}
//     USING: (tenant_id = get_user_tenant_id())
//     WITH CHECK: (tenant_id = get_user_tenant_id())
// Table: messages
//   Policy "super_admin_all" (ALL, PERMISSIVE) roles={public}
//     USING: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_crud" (ALL, PERMISSIVE) roles={public}
//     USING: (tenant_id = get_user_tenant_id())
// Table: patients
//   Policy "super_admin_all" (ALL, PERMISSIVE) roles={public}
//     USING: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_crud" (ALL, PERMISSIVE) roles={public}
//     USING: (tenant_id = get_user_tenant_id())
// Table: prescriptions
//   Policy "sa_all_prescriptions" (ALL, PERMISSIVE) roles={authenticated}
//     USING: (get_user_role() = 'super_admin'::text)
//     WITH CHECK: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_insert_prescriptions" (INSERT, PERMISSIVE) roles={authenticated}
//     WITH CHECK: (tenant_id = get_user_tenant_id())
//   Policy "tenant_select_prescriptions" (SELECT, PERMISSIVE) roles={authenticated}
//     USING: (tenant_id = get_user_tenant_id())
//   Policy "tenant_update_prescriptions" (UPDATE, PERMISSIVE) roles={authenticated}
//     USING: (tenant_id = get_user_tenant_id())
//     WITH CHECK: (tenant_id = get_user_tenant_id())
// Table: profiles
//   Policy "super_admin_all" (ALL, PERMISSIVE) roles={public}
//     USING: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_members_select" (SELECT, PERMISSIVE) roles={public}
//     USING: (tenant_id = get_user_tenant_id())
//   Policy "users_own_profile" (SELECT, PERMISSIVE) roles={public}
//     USING: (id = auth.uid())
//   Policy "users_own_profile_update" (UPDATE, PERMISSIVE) roles={public}
//     USING: (id = auth.uid())
// Table: specialty_templates
//   Policy "sa_all_specialty_templates" (ALL, PERMISSIVE) roles={authenticated}
//     USING: (get_user_role() = 'super_admin'::text)
//     WITH CHECK: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_insert_specialty_templates" (INSERT, PERMISSIVE) roles={authenticated}
//     WITH CHECK: (tenant_id = get_user_tenant_id())
//   Policy "tenant_select_specialty_templates" (SELECT, PERMISSIVE) roles={authenticated}
//     USING: ((tenant_id = get_user_tenant_id()) OR (tenant_id IS NULL))
//   Policy "tenant_update_specialty_templates" (UPDATE, PERMISSIVE) roles={authenticated}
//     USING: (tenant_id = get_user_tenant_id())
//     WITH CHECK: (tenant_id = get_user_tenant_id())
// Table: tenant_api_keys
//   Policy "super_admin_all" (ALL, PERMISSIVE) roles={public}
//     USING: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_members_select" (SELECT, PERMISSIVE) roles={public}
//     USING: (tenant_id = get_user_tenant_id())
// Table: tenant_email_usage
//   Policy "super_admin_all" (ALL, PERMISSIVE) roles={public}
//     USING: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_select" (SELECT, PERMISSIVE) roles={public}
//     USING: (tenant_id = get_user_tenant_id())
// Table: tenant_modules
//   Policy "super_admin_all" (ALL, PERMISSIVE) roles={public}
//     USING: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_members_select" (SELECT, PERMISSIVE) roles={public}
//     USING: (tenant_id = get_user_tenant_id())
// Table: tenant_whatsapp_usage
//   Policy "super_admin_all" (ALL, PERMISSIVE) roles={public}
//     USING: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_select" (SELECT, PERMISSIVE) roles={public}
//     USING: (tenant_id = get_user_tenant_id())
// Table: tenants
//   Policy "super_admin_all" (ALL, PERMISSIVE) roles={public}
//     USING: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_members_select" (SELECT, PERMISSIVE) roles={public}
//     USING: (id = get_user_tenant_id())
// Table: transcriptions
//   Policy "sa_all_transcriptions" (ALL, PERMISSIVE) roles={authenticated}
//     USING: (get_user_role() = 'super_admin'::text)
//     WITH CHECK: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_insert_transcriptions" (INSERT, PERMISSIVE) roles={authenticated}
//     WITH CHECK: (tenant_id = get_user_tenant_id())
//   Policy "tenant_select_transcriptions" (SELECT, PERMISSIVE) roles={authenticated}
//     USING: (tenant_id = get_user_tenant_id())
//   Policy "tenant_update_transcriptions" (UPDATE, PERMISSIVE) roles={authenticated}
//     USING: (tenant_id = get_user_tenant_id())
//     WITH CHECK: (tenant_id = get_user_tenant_id())
// Table: treatment_plans
//   Policy "sa_all_treatment_plans" (ALL, PERMISSIVE) roles={authenticated}
//     USING: (get_user_role() = 'super_admin'::text)
//     WITH CHECK: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_insert_treatment_plans" (INSERT, PERMISSIVE) roles={authenticated}
//     WITH CHECK: (tenant_id = get_user_tenant_id())
//   Policy "tenant_select_treatment_plans" (SELECT, PERMISSIVE) roles={authenticated}
//     USING: (tenant_id = get_user_tenant_id())
//   Policy "tenant_update_treatment_plans" (UPDATE, PERMISSIVE) roles={authenticated}
//     USING: (tenant_id = get_user_tenant_id())
//     WITH CHECK: (tenant_id = get_user_tenant_id())
// Table: verification_codes
//   Policy "public_select_verification" (SELECT, PERMISSIVE) roles={anon,authenticated}
//     USING: true
//   Policy "sa_all_verification" (ALL, PERMISSIVE) roles={authenticated}
//     USING: (get_user_role() = 'super_admin'::text)
//     WITH CHECK: (get_user_role() = 'super_admin'::text)
//   Policy "tenant_insert_verification" (INSERT, PERMISSIVE) roles={authenticated}
//     WITH CHECK: (tenant_id = get_user_tenant_id())

// --- DATABASE FUNCTIONS ---
// FUNCTION create_default_modules()
//   CREATE OR REPLACE FUNCTION public.create_default_modules()
//    RETURNS trigger
//    LANGUAGE plpgsql
//   AS $function$ BEGIN INSERT INTO tenant_modules (tenant_id, module_key, is_enabled) VALUES (NEW.id, 'dashboard', true), (NEW.id, 'crm', true), (NEW.id, 'agenda', true), (NEW.id, 'whatsapp', false), (NEW.id, 'email', false), (NEW.id, 'templates', false), (NEW.id, 'automations', false), (NEW.id, 'ai_chatbot', false), (NEW.id, 'prontuarios', false), (NEW.id, 'reports', true); RETURN NEW; END; $function$
//   
// FUNCTION decrypt_api_key(text, text)
//   CREATE OR REPLACE FUNCTION public.decrypt_api_key(encrypted_value text, secret_key text)
//    RETURNS text
//    LANGUAGE sql
//    SECURITY DEFINER
//   AS $function$
//     SELECT pgp_sym_decrypt(dearmor(encrypted_value), secret_key);
//   $function$
//   
// FUNCTION encrypt_api_key(text, text)
//   CREATE OR REPLACE FUNCTION public.encrypt_api_key(key_value text, secret_key text)
//    RETURNS text
//    LANGUAGE sql
//    SECURITY DEFINER
//   AS $function$
//     SELECT armor(pgp_sym_encrypt(key_value, secret_key));
//   $function$
//   
// FUNCTION get_user_role()
//   CREATE OR REPLACE FUNCTION public.get_user_role()
//    RETURNS text
//    LANGUAGE plpgsql
//    STABLE SECURITY DEFINER
//    SET search_path TO 'public'
//   AS $function$
//   DECLARE
//     v_role text;
//   BEGIN
//     SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
//     RETURN v_role;
//   END;
//   $function$
//   
// FUNCTION get_user_tenant_id()
//   CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
//    RETURNS uuid
//    LANGUAGE plpgsql
//    STABLE SECURITY DEFINER
//    SET search_path TO 'public'
//   AS $function$
//   DECLARE
//     v_tenant_id uuid;
//   BEGIN
//     SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();
//     RETURN v_tenant_id;
//   END;
//   $function$
//   
// FUNCTION handle_new_user()
//   CREATE OR REPLACE FUNCTION public.handle_new_user()
//    RETURNS trigger
//    LANGUAGE plpgsql
//    SECURITY DEFINER
//    SET search_path TO 'public'
//   AS $function$
//   DECLARE
//     v_name text;
//   BEGIN
//     v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario');
//     IF v_name = '' THEN
//       v_name := 'Usuario';
//     END IF;
//   
//     INSERT INTO public.profiles (id, full_name, role)
//     VALUES (NEW.id, v_name, 'doctor')
//     ON CONFLICT (id) DO NOTHING;
//     
//     RETURN NEW;
//   END;
//   $function$
//   
// FUNCTION handle_updated_at()
//   CREATE OR REPLACE FUNCTION public.handle_updated_at()
//    RETURNS trigger
//    LANGUAGE plpgsql
//   AS $function$
//   BEGIN
//     NEW.updated_at = now();
//     RETURN NEW;
//   END;
//   $function$
//   
// FUNCTION update_updated_at()
//   CREATE OR REPLACE FUNCTION public.update_updated_at()
//    RETURNS trigger
//    LANGUAGE plpgsql
//   AS $function$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$
//   

// --- TRIGGERS ---
// Table: appointments
//   set_updated_at: CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION handle_updated_at()
// Table: automations
//   set_updated_at: CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.automations FOR EACH ROW EXECUTE FUNCTION handle_updated_at()
// Table: bot_configs
//   set_updated_at: CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.bot_configs FOR EACH ROW EXECUTE FUNCTION handle_updated_at()
// Table: conversations
//   set_updated_at: CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION handle_updated_at()
// Table: email_campaigns
//   set_updated_at: CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.email_campaigns FOR EACH ROW EXECUTE FUNCTION handle_updated_at()
// Table: email_templates
//   set_updated_at: CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION handle_updated_at()
// Table: medical_record_sections
//   set_updated_at: CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.medical_record_sections FOR EACH ROW EXECUTE FUNCTION update_updated_at()
// Table: medical_records
//   set_updated_at: CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.medical_records FOR EACH ROW EXECUTE FUNCTION update_updated_at()
// Table: patients
//   set_updated_at: CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION handle_updated_at()
// Table: profiles
//   set_updated_at: CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION handle_updated_at()
// Table: specialty_templates
//   set_updated_at: CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.specialty_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at()
// Table: tenant_api_keys
//   set_updated_at: CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tenant_api_keys FOR EACH ROW EXECUTE FUNCTION handle_updated_at()
// Table: tenant_email_usage
//   set_updated_at: CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tenant_email_usage FOR EACH ROW EXECUTE FUNCTION handle_updated_at()
// Table: tenant_modules
//   set_updated_at: CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tenant_modules FOR EACH ROW EXECUTE FUNCTION handle_updated_at()
// Table: tenant_whatsapp_usage
//   set_updated_at: CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tenant_whatsapp_usage FOR EACH ROW EXECUTE FUNCTION handle_updated_at()
// Table: tenants
//   on_tenant_created: CREATE TRIGGER on_tenant_created AFTER INSERT ON public.tenants FOR EACH ROW EXECUTE FUNCTION create_default_modules()
//   set_updated_at: CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION handle_updated_at()
// Table: treatment_plans
//   set_updated_at: CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.treatment_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at()

// --- INDEXES ---
// Table: appointments
//   CREATE INDEX appointments_datetime_start_idx ON public.appointments USING btree (datetime_start)
//   CREATE INDEX appointments_patient_id_idx ON public.appointments USING btree (patient_id)
//   CREATE INDEX appointments_status_idx ON public.appointments USING btree (status)
//   CREATE INDEX appointments_tenant_id_idx ON public.appointments USING btree (tenant_id)
// Table: audit_logs
//   CREATE INDEX audit_logs_action_idx ON public.audit_logs USING btree (action)
//   CREATE INDEX audit_logs_created_at_idx ON public.audit_logs USING btree (created_at DESC)
//   CREATE INDEX audit_logs_tenant_id_idx ON public.audit_logs USING btree (tenant_id)
// Table: automation_logs
//   CREATE INDEX automation_logs_automation_id_idx ON public.automation_logs USING btree (automation_id)
//   CREATE INDEX automation_logs_executed_at_idx ON public.automation_logs USING btree (executed_at DESC)
//   CREATE INDEX automation_logs_tenant_id_idx ON public.automation_logs USING btree (tenant_id)
// Table: automations
//   CREATE INDEX automations_is_active_idx ON public.automations USING btree (is_active)
//   CREATE INDEX automations_tenant_id_idx ON public.automations USING btree (tenant_id)
// Table: body_maps
//   CREATE INDEX idx_body_maps_record ON public.body_maps USING btree (record_id)
// Table: bot_configs
//   CREATE INDEX bot_configs_tenant_id_idx ON public.bot_configs USING btree (tenant_id)
//   CREATE UNIQUE INDEX bot_configs_tenant_id_key ON public.bot_configs USING btree (tenant_id)
// Table: bot_documents
//   CREATE INDEX bot_documents_bot_config_id_idx ON public.bot_documents USING btree (bot_config_id)
//   CREATE INDEX bot_documents_tenant_id_idx ON public.bot_documents USING btree (tenant_id)
// Table: bot_embeddings
//   CREATE INDEX bot_embeddings_embedding_idx ON public.bot_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists='100')
//   CREATE INDEX bot_embeddings_tenant_id_idx ON public.bot_embeddings USING btree (tenant_id)
// Table: conversations
//   CREATE INDEX conversations_last_message_at_idx ON public.conversations USING btree (last_message_at DESC)
//   CREATE INDEX conversations_phone_number_idx ON public.conversations USING btree (phone_number)
//   CREATE INDEX conversations_tenant_id_idx ON public.conversations USING btree (tenant_id)
// Table: document_signatures
//   CREATE INDEX idx_doc_signatures_document ON public.document_signatures USING btree (document_type, document_id)
//   CREATE INDEX idx_doc_signatures_hash ON public.document_signatures USING btree (signature_hash)
//   CREATE INDEX idx_doc_signatures_tenant ON public.document_signatures USING btree (tenant_id)
// Table: email_campaigns
//   CREATE INDEX email_campaigns_status_idx ON public.email_campaigns USING btree (status)
//   CREATE INDEX email_campaigns_tenant_id_idx ON public.email_campaigns USING btree (tenant_id)
// Table: email_templates
//   CREATE INDEX email_templates_category_idx ON public.email_templates USING btree (category)
//   CREATE INDEX email_templates_tenant_id_idx ON public.email_templates USING btree (tenant_id)
// Table: medical_record_sections
//   CREATE INDEX idx_record_sections_record ON public.medical_record_sections USING btree (record_id)
//   CREATE INDEX idx_record_sections_type ON public.medical_record_sections USING btree (section_type)
// Table: medical_records
//   CREATE INDEX idx_medical_records_created ON public.medical_records USING btree (created_at DESC)
//   CREATE INDEX idx_medical_records_doctor ON public.medical_records USING btree (doctor_id)
//   CREATE INDEX idx_medical_records_patient ON public.medical_records USING btree (patient_id)
//   CREATE INDEX idx_medical_records_status ON public.medical_records USING btree (status)
//   CREATE INDEX idx_medical_records_tenant ON public.medical_records USING btree (tenant_id)
// Table: medical_reports
//   CREATE INDEX idx_medical_reports_patient ON public.medical_reports USING btree (patient_id)
//   CREATE INDEX idx_medical_reports_record ON public.medical_reports USING btree (record_id)
//   CREATE INDEX idx_medical_reports_tenant ON public.medical_reports USING btree (tenant_id)
// Table: messages
//   CREATE INDEX messages_conversation_id_idx ON public.messages USING btree (conversation_id)
//   CREATE INDEX messages_created_at_idx ON public.messages USING btree (created_at DESC)
//   CREATE INDEX messages_tenant_id_idx ON public.messages USING btree (tenant_id)
// Table: patients
//   CREATE INDEX patients_deleted_at_idx ON public.patients USING btree (deleted_at)
//   CREATE INDEX patients_phone_idx ON public.patients USING btree (phone)
//   CREATE INDEX patients_pipeline_stage_idx ON public.patients USING btree (pipeline_stage)
//   CREATE INDEX patients_tenant_id_idx ON public.patients USING btree (tenant_id)
// Table: prescriptions
//   CREATE INDEX idx_prescriptions_doctor ON public.prescriptions USING btree (doctor_id)
//   CREATE INDEX idx_prescriptions_patient ON public.prescriptions USING btree (patient_id)
//   CREATE INDEX idx_prescriptions_record ON public.prescriptions USING btree (record_id)
//   CREATE INDEX idx_prescriptions_tenant ON public.prescriptions USING btree (tenant_id)
// Table: profiles
//   CREATE INDEX profiles_role_idx ON public.profiles USING btree (role)
//   CREATE INDEX profiles_tenant_id_idx ON public.profiles USING btree (tenant_id)
// Table: specialty_templates
//   CREATE INDEX idx_specialty_templates_specialty ON public.specialty_templates USING btree (specialty)
//   CREATE INDEX idx_specialty_templates_tenant ON public.specialty_templates USING btree (tenant_id)
// Table: tenant_api_keys
//   CREATE INDEX tenant_api_keys_provider_idx ON public.tenant_api_keys USING btree (provider)
//   CREATE INDEX tenant_api_keys_tenant_id_idx ON public.tenant_api_keys USING btree (tenant_id)
//   CREATE UNIQUE INDEX unique_tenant_provider ON public.tenant_api_keys USING btree (tenant_id, provider)
// Table: tenant_email_usage
//   CREATE UNIQUE INDEX tenant_email_usage_tenant_month_key ON public.tenant_email_usage USING btree (tenant_id, month)
// Table: tenant_modules
//   CREATE INDEX tenant_modules_tenant_id_idx ON public.tenant_modules USING btree (tenant_id)
//   CREATE UNIQUE INDEX tenant_modules_tenant_key ON public.tenant_modules USING btree (tenant_id, module_key)
// Table: tenant_whatsapp_usage
//   CREATE UNIQUE INDEX tenant_whatsapp_usage_tenant_month_key ON public.tenant_whatsapp_usage USING btree (tenant_id, month)
// Table: tenants
//   CREATE INDEX tenants_slug_idx ON public.tenants USING btree (slug)
//   CREATE UNIQUE INDEX tenants_slug_key ON public.tenants USING btree (slug)
// Table: transcriptions
//   CREATE INDEX idx_transcriptions_record ON public.transcriptions USING btree (record_id)
//   CREATE INDEX idx_transcriptions_status ON public.transcriptions USING btree (status)
//   CREATE INDEX idx_transcriptions_tenant ON public.transcriptions USING btree (tenant_id)
// Table: treatment_plans
//   CREATE INDEX idx_treatment_plans_patient ON public.treatment_plans USING btree (patient_id)
//   CREATE INDEX idx_treatment_plans_status ON public.treatment_plans USING btree (status)
//   CREATE INDEX idx_treatment_plans_tenant ON public.treatment_plans USING btree (tenant_id)
// Table: verification_codes
//   CREATE INDEX idx_verification_tenant ON public.verification_codes USING btree (tenant_id)
//   CREATE UNIQUE INDEX verification_codes_hash_code_key ON public.verification_codes USING btree (hash_code)

