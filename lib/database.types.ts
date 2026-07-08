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
      body_metrics: {
        Row: {
          bf_method: string | null
          body_fat_pct: number | null
          client_id: string
          extras: Json
          hip_cm: number | null
          id: string
          measured_at: string
          neck_cm: number | null
          source: Database["public"]["Enums"]["metric_source"]
          updated_at: string
          user_id: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          bf_method?: string | null
          body_fat_pct?: number | null
          client_id: string
          extras?: Json
          hip_cm?: number | null
          id?: string
          measured_at?: string
          neck_cm?: number | null
          source?: Database["public"]["Enums"]["metric_source"]
          updated_at?: string
          user_id: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          bf_method?: string | null
          body_fat_pct?: number | null
          client_id?: string
          extras?: Json
          hip_cm?: number | null
          id?: string
          measured_at?: string
          neck_cm?: number | null
          source?: Database["public"]["Enums"]["metric_source"]
          updated_at?: string
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      cardio_sessions: {
        Row: {
          activity: string
          avg_hr_bpm: number | null
          client_id: string
          distance_m: number | null
          duration_s: number | null
          external_id: string | null
          id: string
          max_hr_bpm: number | null
          notes: string | null
          perceived_effort: number | null
          source: Database["public"]["Enums"]["metric_source"]
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity?: string
          avg_hr_bpm?: number | null
          client_id: string
          distance_m?: number | null
          duration_s?: number | null
          external_id?: string | null
          id?: string
          max_hr_bpm?: number | null
          notes?: string | null
          perceived_effort?: number | null
          source?: Database["public"]["Enums"]["metric_source"]
          started_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity?: string
          avg_hr_bpm?: number | null
          client_id?: string
          distance_m?: number | null
          duration_s?: number | null
          external_id?: string | null
          id?: string
          max_hr_bpm?: number | null
          notes?: string | null
          perceived_effort?: number | null
          source?: Database["public"]["Enums"]["metric_source"]
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          created_at: string
          default_rest_seconds: number | null
          equipment: string | null
          id: string
          is_unilateral: boolean
          muscle_groups: string[]
          name: string
          notes: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          default_rest_seconds?: number | null
          equipment?: string | null
          id?: string
          is_unilateral?: boolean
          muscle_groups?: string[]
          name: string
          notes?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          default_rest_seconds?: number | null
          equipment?: string | null
          id?: string
          is_unilateral?: boolean
          muscle_groups?: string[]
          name?: string
          notes?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      foods: {
        Row: {
          brand: string | null
          calories: number
          carbs_g: number
          created_at: string
          external_id: string | null
          fat_g: number
          fiber_g: number | null
          id: string
          micros: Json
          name: string
          protein_g: number
          serving_desc: string
          serving_grams: number | null
          source: Database["public"]["Enums"]["food_source"]
          user_id: string | null
        }
        Insert: {
          brand?: string | null
          calories?: number
          carbs_g?: number
          created_at?: string
          external_id?: string | null
          fat_g?: number
          fiber_g?: number | null
          id?: string
          micros?: Json
          name: string
          protein_g?: number
          serving_desc?: string
          serving_grams?: number | null
          source?: Database["public"]["Enums"]["food_source"]
          user_id?: string | null
        }
        Update: {
          brand?: string | null
          calories?: number
          carbs_g?: number
          created_at?: string
          external_id?: string | null
          fat_g?: number
          fiber_g?: number | null
          id?: string
          micros?: Json
          name?: string
          protein_g?: number
          serving_desc?: string
          serving_grams?: number | null
          source?: Database["public"]["Enums"]["food_source"]
          user_id?: string | null
        }
        Relationships: []
      }
      health_metrics: {
        Row: {
          created_at: string
          id: string
          metric_date: string
          metric_type: string
          raw: Json | null
          source: Database["public"]["Enums"]["metric_source"]
          unit: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          metric_date: string
          metric_type: string
          raw?: Json | null
          source?: Database["public"]["Enums"]["metric_source"]
          unit: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          metric_date?: string
          metric_type?: string
          raw?: Json | null
          source?: Database["public"]["Enums"]["metric_source"]
          unit?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      integration_accounts: {
        Row: {
          access_token: string | null
          created_at: string
          expires_at: string | null
          id: string
          provider: string
          provider_user_id: string | null
          refresh_token: string | null
          scopes: string[] | null
          updated_at: string
          user_id: string
          webhook_secret: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          provider: string
          provider_user_id?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          updated_at?: string
          user_id: string
          webhook_secret?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          provider?: string
          provider_user_id?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          updated_at?: string
          user_id?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      mobility_logs: {
        Row: {
          client_id: string
          completed: boolean
          duration_min: number | null
          exercises_done: Json
          hip_tightness: number | null
          id: string
          log_date: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          completed?: boolean
          duration_min?: number | null
          exercises_done?: Json
          hip_tightness?: number | null
          id?: string
          log_date: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          completed?: boolean
          duration_min?: number | null
          exercises_done?: Json
          hip_tightness?: number | null
          id?: string
          log_date?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nutrition_logs: {
        Row: {
          calories: number
          carbs_g: number
          client_id: string
          description: string
          fat_g: number
          fiber_g: number | null
          food_id: string | null
          id: string
          log_date: string
          logged_at: string
          meal: Database["public"]["Enums"]["meal_type"]
          micros: Json
          protein_g: number
          quantity: number
          recipe_id: string | null
          source: Database["public"]["Enums"]["metric_source"]
          updated_at: string
          user_id: string
        }
        Insert: {
          calories: number
          carbs_g: number
          client_id: string
          description: string
          fat_g: number
          fiber_g?: number | null
          food_id?: string | null
          id?: string
          log_date: string
          logged_at?: string
          meal?: Database["public"]["Enums"]["meal_type"]
          micros?: Json
          protein_g: number
          quantity?: number
          recipe_id?: string | null
          source?: Database["public"]["Enums"]["metric_source"]
          updated_at?: string
          user_id: string
        }
        Update: {
          calories?: number
          carbs_g?: number
          client_id?: string
          description?: string
          fat_g?: number
          fiber_g?: number | null
          food_id?: string | null
          id?: string
          log_date?: string
          logged_at?: string
          meal?: Database["public"]["Enums"]["meal_type"]
          micros?: Json
          protein_g?: number
          quantity?: number
          recipe_id?: string | null
          source?: Database["public"]["Enums"]["metric_source"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_logs_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrition_logs_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          birth_date: string | null
          created_at: string
          display_name: string | null
          goal_body_fat_pct: number | null
          goal_weight_kg: number | null
          height_cm: number | null
          sex: string | null
          target_calories: number | null
          target_carbs_g: number | null
          target_fat_g: number | null
          target_protein_g: number | null
          timezone: string
          unit_distance: string
          unit_weight: string
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          display_name?: string | null
          goal_body_fat_pct?: number | null
          goal_weight_kg?: number | null
          height_cm?: number | null
          sex?: string | null
          target_calories?: number | null
          target_carbs_g?: number | null
          target_fat_g?: number | null
          target_protein_g?: number | null
          timezone?: string
          unit_distance?: string
          unit_weight?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          display_name?: string | null
          goal_body_fat_pct?: number | null
          goal_weight_kg?: number | null
          height_cm?: number | null
          sex?: string | null
          target_calories?: number | null
          target_carbs_g?: number | null
          target_fat_g?: number | null
          target_protein_g?: number | null
          timezone?: string
          unit_distance?: string
          unit_weight?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      progress_photos: {
        Row: {
          id: string
          notes: string | null
          pose: Database["public"]["Enums"]["photo_pose"]
          storage_path: string
          taken_at: string
          user_id: string
          weight_kg_at_time: number | null
        }
        Insert: {
          id?: string
          notes?: string | null
          pose?: Database["public"]["Enums"]["photo_pose"]
          storage_path: string
          taken_at?: string
          user_id: string
          weight_kg_at_time?: number | null
        }
        Update: {
          id?: string
          notes?: string | null
          pose?: Database["public"]["Enums"]["photo_pose"]
          storage_path?: string
          taken_at?: string
          user_id?: string
          weight_kg_at_time?: number | null
        }
        Relationships: []
      }
      recipe_items: {
        Row: {
          food_id: string
          id: string
          quantity: number
          recipe_id: string
        }
        Insert: {
          food_id: string
          id?: string
          quantity?: number
          recipe_id: string
        }
        Update: {
          food_id?: string
          id?: string
          quantity?: number
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_items_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          servings: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          servings?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          servings?: number
          user_id?: string
        }
        Relationships: []
      }
      session_exercises: {
        Row: {
          client_id: string
          exercise_id: string
          id: string
          notes: string | null
          position: number
          rest_seconds: number | null
          session_id: string
          superset_group: number | null
          target_reps_max: number | null
          target_reps_min: number | null
          target_rpe: number | null
          target_sets: number | null
          target_weight_kg: number | null
          updated_at: string
        }
        Insert: {
          client_id: string
          exercise_id: string
          id?: string
          notes?: string | null
          position: number
          rest_seconds?: number | null
          session_id: string
          superset_group?: number | null
          target_reps_max?: number | null
          target_reps_min?: number | null
          target_rpe?: number | null
          target_sets?: number | null
          target_weight_kg?: number | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          exercise_id?: string
          id?: string
          notes?: string | null
          position?: number
          rest_seconds?: number | null
          session_id?: string
          superset_group?: number | null
          target_reps_max?: number | null
          target_reps_min?: number | null
          target_rpe?: number | null
          target_sets?: number | null
          target_weight_kg?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_sets: {
        Row: {
          actual_reps: number | null
          actual_rpe: number | null
          actual_weight_kg: number | null
          client_id: string
          completed_at: string
          id: string
          is_warmup: boolean
          session_exercise_id: string
          set_number: number
          updated_at: string
        }
        Insert: {
          actual_reps?: number | null
          actual_rpe?: number | null
          actual_weight_kg?: number | null
          client_id: string
          completed_at?: string
          id?: string
          is_warmup?: boolean
          session_exercise_id: string
          set_number: number
          updated_at?: string
        }
        Update: {
          actual_reps?: number | null
          actual_rpe?: number | null
          actual_weight_kg?: number | null
          client_id?: string
          completed_at?: string
          id?: string
          is_warmup?: boolean
          session_exercise_id?: string
          set_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_sets_session_exercise_id_fkey"
            columns: ["session_exercise_id"]
            isOneToOne: false
            referencedRelation: "session_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      soreness_logs: {
        Row: {
          client_id: string
          id: string
          joint: Database["public"]["Enums"]["joint_site"]
          log_date: string
          notes: string | null
          rating: number
          session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          id?: string
          joint: Database["public"]["Enums"]["joint_site"]
          log_date: string
          notes?: string | null
          rating: number
          session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          id?: string
          joint?: Database["public"]["Enums"]["joint_site"]
          log_date?: string
          notes?: string | null
          rating?: number
          session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "soreness_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      template_exercises: {
        Row: {
          exercise_id: string
          id: string
          notes: string | null
          position: number
          rest_seconds: number | null
          superset_group: number | null
          target_reps_max: number | null
          target_reps_min: number | null
          target_rpe: number | null
          target_sets: number
          target_weight_kg: number | null
          template_id: string
        }
        Insert: {
          exercise_id: string
          id?: string
          notes?: string | null
          position: number
          rest_seconds?: number | null
          superset_group?: number | null
          target_reps_max?: number | null
          target_reps_min?: number | null
          target_rpe?: number | null
          target_sets?: number
          target_weight_kg?: number | null
          template_id: string
        }
        Update: {
          exercise_id?: string
          id?: string
          notes?: string | null
          position?: number
          rest_seconds?: number | null
          superset_group?: number | null
          target_reps_max?: number | null
          target_reps_min?: number | null
          target_rpe?: number | null
          target_sets?: number
          target_weight_kg?: number | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_exercises_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          bodyweight_kg: number | null
          client_id: string
          completed_at: string | null
          id: string
          is_deload: boolean
          notes: string | null
          started_at: string
          template_id: string | null
          template_name_snapshot: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bodyweight_kg?: number | null
          client_id: string
          completed_at?: string | null
          id?: string
          is_deload?: boolean
          notes?: string | null
          started_at?: string
          template_id?: string | null
          template_name_snapshot?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bodyweight_kg?: number | null
          client_id?: string
          completed_at?: string | null
          id?: string
          is_deload?: boolean
          notes?: string | null
          started_at?: string
          template_id?: string | null
          template_name_snapshot?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_templates: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      daily_rollup: {
        Row: {
          calories: number | null
          carbs_g: number | null
          cardio_m: number | null
          day: string | null
          fat_g: number | null
          hrv_ms: number | null
          mobility_done: boolean | null
          protein_g: number | null
          resting_hr: number | null
          sleep_s: number | null
          steps: number | null
          trained: boolean | null
          user_id: string | null
          weight_kg: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      food_source: "usda" | "off" | "custom" | "health_import"
      joint_site:
        | "knee_l"
        | "knee_r"
        | "ankle_l"
        | "ankle_r"
        | "hip_l"
        | "hip_r"
        | "shoulder_l"
        | "shoulder_r"
        | "low_back"
        | "elbow_l"
        | "elbow_r"
        | "wrist_l"
        | "wrist_r"
        | "other"
      meal_type:
        | "breakfast"
        | "lunch"
        | "dinner"
        | "snack"
        | "pre_workout"
        | "post_workout"
      metric_source: "manual" | "health_export" | "strava" | "derived"
      photo_pose: "front" | "side" | "back" | "other"
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
      food_source: ["usda", "off", "custom", "health_import"],
      joint_site: [
        "knee_l",
        "knee_r",
        "ankle_l",
        "ankle_r",
        "hip_l",
        "hip_r",
        "shoulder_l",
        "shoulder_r",
        "low_back",
        "elbow_l",
        "elbow_r",
        "wrist_l",
        "wrist_r",
        "other",
      ],
      meal_type: [
        "breakfast",
        "lunch",
        "dinner",
        "snack",
        "pre_workout",
        "post_workout",
      ],
      metric_source: ["manual", "health_export", "strava", "derived"],
      photo_pose: ["front", "side", "back", "other"],
    },
  },
} as const
