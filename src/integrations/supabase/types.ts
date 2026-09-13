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
      meeting_board_strokes: {
        Row: {
          author_id: string
          created_at: string
          id: string
          meeting_id: string
          stroke: Json
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          meeting_id: string
          stroke: Json
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          meeting_id?: string
          stroke?: Json
        }
        Relationships: [
          {
            foreignKeyName: "meeting_board_strokes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_breakouts: {
        Row: {
          closed: boolean
          created_at: string
          created_by: string
          id: string
          meeting_id: string
          name: string
        }
        Insert: {
          closed?: boolean
          created_at?: string
          created_by: string
          id?: string
          meeting_id: string
          name: string
        }
        Update: {
          closed?: boolean
          created_at?: string
          created_by?: string
          id?: string
          meeting_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_breakouts_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          meeting_id: string
          sender_id: string
          sender_name: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          meeting_id: string
          sender_id: string
          sender_name?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          meeting_id?: string
          sender_id?: string
          sender_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_messages_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_notes: {
        Row: {
          body: string
          meeting_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string
          meeting_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          meeting_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_notes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_poll_votes: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          option_index: number
          poll_id: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          option_index: number
          poll_id: string
          voter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          option_index?: number
          poll_id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_poll_votes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "meeting_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_polls: {
        Row: {
          closed: boolean
          created_at: string
          created_by: string
          id: string
          meeting_id: string
          options: string[]
          question: string
        }
        Insert: {
          closed?: boolean
          created_at?: string
          created_by: string
          id?: string
          meeting_id: string
          options: string[]
          question: string
        }
        Update: {
          closed?: boolean
          created_at?: string
          created_by?: string
          id?: string
          meeting_id?: string
          options?: string[]
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_polls_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_question_votes: {
        Row: {
          created_at: string
          meeting_id: string
          question_id: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          meeting_id: string
          question_id: string
          voter_id: string
        }
        Update: {
          created_at?: string
          meeting_id?: string
          question_id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_question_votes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_question_votes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "meeting_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_questions: {
        Row: {
          answered: boolean
          author_id: string
          author_name: string
          body: string
          created_at: string
          id: string
          meeting_id: string
        }
        Insert: {
          answered?: boolean
          author_id: string
          author_name?: string
          body: string
          created_at?: string
          id?: string
          meeting_id: string
        }
        Update: {
          answered?: boolean
          author_id?: string
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          meeting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_questions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          created_by: string
          duration_minutes: number
          id: string
          notes: string | null
          room_slug: string
          starts_at: string
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          room_slug: string
          starts_at?: string
          team_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          room_slug?: string
          starts_at?: string
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          last_seen_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          last_seen_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_seen_at?: string | null
        }
        Relationships: []
      }
      recording_chapters: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string
          offset_seconds: number
          recording_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          offset_seconds: number
          recording_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          offset_seconds?: number
          recording_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recording_chapters_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      recordings: {
        Row: {
          created_at: string
          duration_seconds: number
          id: string
          is_public: boolean
          meeting_id: string | null
          mime_type: string
          parts_count: number
          size_bytes: number
          storage_path: string
          team_id: string | null
          title: string
          updated_at: string
          upload_status: string
          user_id: string
          view_count: number
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          id?: string
          is_public?: boolean
          meeting_id?: string | null
          mime_type?: string
          parts_count?: number
          size_bytes?: number
          storage_path: string
          team_id?: string | null
          title?: string
          updated_at?: string
          upload_status?: string
          user_id: string
          view_count?: number
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          id?: string
          is_public?: boolean
          meeting_id?: string | null
          mime_type?: string
          parts_count?: number
          size_bytes?: number
          storage_path?: string
          team_id?: string | null
          title?: string
          updated_at?: string
          upload_status?: string
          user_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "recordings_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recordings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string
          status: string
          team_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by: string
          status?: string
          team_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          status?: string
          team_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          joined_at: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_meeting: {
        Args: { _meeting_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_owner: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      my_team_ids: { Args: { _user_id: string }; Returns: string[] }
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
