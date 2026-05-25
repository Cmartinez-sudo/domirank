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
      friend_requests: {
        Row: {
          created_at: string
          from_user: string
          id: string
          message: string | null
          responded_at: string | null
          status: string
          to_user: string
        }
        Insert: {
          created_at?: string
          from_user: string
          id?: string
          message?: string | null
          responded_at?: string | null
          status?: string
          to_user: string
        }
        Update: {
          created_at?: string
          from_user?: string
          id?: string
          message?: string | null
          responded_at?: string | null
          status?: string
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_requests_from_user_profiles_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "profile_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_from_user_profiles_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_to_user_profiles_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "profile_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_to_user_profiles_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_friend_id_profiles_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "profile_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_friend_id_profiles_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_attestations: {
        Row: {
          action: string
          comment: string | null
          created_at: string
          match_id: string
          user_id: string
        }
        Insert: {
          action: string
          comment?: string | null
          created_at?: string
          match_id: string
          user_id: string
        }
        Update: {
          action?: string
          comment?: string | null
          created_at?: string
          match_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_attestations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "match_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_attestations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "match_live_state"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "match_attestations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_players: {
        Row: {
          created_at: string
          elo_after: number | null
          elo_before: number | null
          id: number
          k_used: number | null
          match_id: string
          mu_after: number | null
          mu_before: number | null
          rank: number | null
          score: number
          sigma_after: number | null
          sigma_before: number | null
          team: number
          user_id: string
        }
        Insert: {
          created_at?: string
          elo_after?: number | null
          elo_before?: number | null
          id?: number
          k_used?: number | null
          match_id: string
          mu_after?: number | null
          mu_before?: number | null
          rank?: number | null
          score?: number
          sigma_after?: number | null
          sigma_before?: number | null
          team: number
          user_id: string
        }
        Update: {
          created_at?: string
          elo_after?: number | null
          elo_before?: number | null
          id?: number
          k_used?: number | null
          match_id?: string
          mu_after?: number | null
          mu_before?: number | null
          rank?: number | null
          score?: number
          sigma_after?: number | null
          sigma_before?: number | null
          team?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_players_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "match_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_players_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "match_live_state"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "match_players_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_rounds: {
        Row: {
          created_at: string
          created_by: string | null
          id: number
          kind: string
          match_id: string
          points: number
          round_number: number
          team: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: number
          kind?: string
          match_id: string
          points: number
          round_number: number
          team: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: number
          kind?: string
          match_id?: string
          points?: number
          round_number?: number
          team?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_rounds_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "match_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_rounds_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "match_live_state"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "match_rounds_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          capicua_bonus: number
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          finalized_at: string | null
          finished_at: string | null
          format: string
          id: string
          modality: string | null
          notes: string | null
          rated: boolean
          rated_at: string | null
          scorekeeper_id: string | null
          set_size: string
          status: string
          target_points: number
          time_limit_minutes: number | null
          timer_started_at: string | null
          tournament_id: string | null
        }
        Insert: {
          capicua_bonus?: number
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          finalized_at?: string | null
          finished_at?: string | null
          format: string
          id?: string
          modality?: string | null
          notes?: string | null
          rated?: boolean
          rated_at?: string | null
          scorekeeper_id?: string | null
          set_size?: string
          status?: string
          target_points?: number
          time_limit_minutes?: number | null
          timer_started_at?: string | null
          tournament_id?: string | null
        }
        Update: {
          capicua_bonus?: number
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          finalized_at?: string | null
          finished_at?: string | null
          format?: string
          id?: string
          modality?: string | null
          notes?: string | null
          rated?: boolean
          rated_at?: string | null
          scorekeeper_id?: string | null
          set_size?: string
          status?: string
          target_points?: number
          time_limit_minutes?: number | null
          timer_started_at?: string | null
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournament_standings"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          ref_match_id: string | null
          ref_tournament_id: string | null
          ref_user_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          ref_match_id?: string | null
          ref_tournament_id?: string | null
          ref_user_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          ref_match_id?: string | null
          ref_tournament_id?: string | null
          ref_user_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_ref_match_id_fkey"
            columns: ["ref_match_id"]
            isOneToOne: false
            referencedRelation: "match_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_ref_match_id_fkey"
            columns: ["ref_match_id"]
            isOneToOne: false
            referencedRelation: "match_live_state"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "notifications_ref_match_id_fkey"
            columns: ["ref_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_ref_tournament_id_fkey"
            columns: ["ref_tournament_id"]
            isOneToOne: false
            referencedRelation: "tournament_standings"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "notifications_ref_tournament_id_fkey"
            columns: ["ref_tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      pair_invites: {
        Row: {
          created_at: string
          id: string
          invitee_id: string
          inviter_id: string
          responded_at: string | null
          status: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invitee_id: string
          inviter_id: string
          responded_at?: string | null
          status?: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
          responded_at?: string | null
          status?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pair_invites_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournament_standings"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "pair_invites_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country: string | null
          created_at: string
          d9_doubles_elo: number
          d9_doubles_games: number
          d9_doubles_losses: number
          d9_doubles_mu: number
          d9_doubles_points_lost: number
          d9_doubles_points_won: number
          d9_doubles_sigma: number
          d9_doubles_wins: number
          d9_singles_elo: number
          d9_singles_games: number
          d9_singles_losses: number
          d9_singles_mu: number
          d9_singles_points_lost: number
          d9_singles_points_won: number
          d9_singles_sigma: number
          d9_singles_wins: number
          date_of_birth: string | null
          default_modality: string | null
          display_name: string | null
          doubles_elo: number
          doubles_games: number
          doubles_losses: number
          doubles_mu: number
          doubles_points_lost: number
          doubles_points_won: number
          doubles_sigma: number
          doubles_wins: number
          email_notifications: boolean
          full_name: string | null
          global_elo: number
          id: string
          initial_skill_points: number | null
          onboarded: boolean
          privacy_accepted_at: string | null
          role: string
          signup_method: string | null
          singles_elo: number
          singles_games: number
          singles_losses: number
          singles_mu: number
          singles_points_lost: number
          singles_points_won: number
          singles_sigma: number
          singles_wins: number
          terms_accepted_at: string | null
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          d9_doubles_elo?: number
          d9_doubles_games?: number
          d9_doubles_losses?: number
          d9_doubles_mu?: number
          d9_doubles_points_lost?: number
          d9_doubles_points_won?: number
          d9_doubles_sigma?: number
          d9_doubles_wins?: number
          d9_singles_elo?: number
          d9_singles_games?: number
          d9_singles_losses?: number
          d9_singles_mu?: number
          d9_singles_points_lost?: number
          d9_singles_points_won?: number
          d9_singles_sigma?: number
          d9_singles_wins?: number
          date_of_birth?: string | null
          default_modality?: string | null
          display_name?: string | null
          doubles_elo?: number
          doubles_games?: number
          doubles_losses?: number
          doubles_mu?: number
          doubles_points_lost?: number
          doubles_points_won?: number
          doubles_sigma?: number
          doubles_wins?: number
          email_notifications?: boolean
          full_name?: string | null
          global_elo?: number
          id: string
          initial_skill_points?: number | null
          onboarded?: boolean
          privacy_accepted_at?: string | null
          role?: string
          signup_method?: string | null
          singles_elo?: number
          singles_games?: number
          singles_losses?: number
          singles_mu?: number
          singles_points_lost?: number
          singles_points_won?: number
          singles_sigma?: number
          singles_wins?: number
          terms_accepted_at?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          d9_doubles_elo?: number
          d9_doubles_games?: number
          d9_doubles_losses?: number
          d9_doubles_mu?: number
          d9_doubles_points_lost?: number
          d9_doubles_points_won?: number
          d9_doubles_sigma?: number
          d9_doubles_wins?: number
          d9_singles_elo?: number
          d9_singles_games?: number
          d9_singles_losses?: number
          d9_singles_mu?: number
          d9_singles_points_lost?: number
          d9_singles_points_won?: number
          d9_singles_sigma?: number
          d9_singles_wins?: number
          date_of_birth?: string | null
          default_modality?: string | null
          display_name?: string | null
          doubles_elo?: number
          doubles_games?: number
          doubles_losses?: number
          doubles_mu?: number
          doubles_points_lost?: number
          doubles_points_won?: number
          doubles_sigma?: number
          doubles_wins?: number
          email_notifications?: boolean
          full_name?: string | null
          global_elo?: number
          id?: string
          initial_skill_points?: number | null
          onboarded?: boolean
          privacy_accepted_at?: string | null
          role?: string
          signup_method?: string | null
          singles_elo?: number
          singles_games?: number
          singles_losses?: number
          singles_mu?: number
          singles_points_lost?: number
          singles_points_won?: number
          singles_sigma?: number
          singles_wins?: number
          terms_accepted_at?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tournament_pairings: {
        Row: {
          board: number
          created_at: string
          id: number
          match_id: string | null
          round: number
          team_a_user_ids: string[]
          team_b_user_ids: string[]
          tournament_id: string
          winner_side: string | null
        }
        Insert: {
          board: number
          created_at?: string
          id?: number
          match_id?: string | null
          round: number
          team_a_user_ids: string[]
          team_b_user_ids: string[]
          tournament_id: string
          winner_side?: string | null
        }
        Update: {
          board?: number
          created_at?: string
          id?: number
          match_id?: string | null
          round?: number
          team_a_user_ids?: string[]
          team_b_user_ids?: string[]
          tournament_id?: string
          winner_side?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_pairings_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "match_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_pairings_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "match_live_state"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "tournament_pairings_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_pairings_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournament_standings"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "tournament_pairings_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_pairs: {
        Row: {
          created_at: string
          id: number
          tournament_id: string
          user_a_id: string
          user_b_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          tournament_id: string
          user_a_id: string
          user_b_id: string
        }
        Update: {
          created_at?: string
          id?: number
          tournament_id?: string
          user_a_id?: string
          user_b_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_pairs_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournament_standings"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "tournament_pairs_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_players: {
        Row: {
          joined_at: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          tournament_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournament_standings"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "tournament_players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_rank_snapshots: {
        Row: {
          rank: number
          snapshot_at: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          rank: number
          snapshot_at?: string
          tournament_id: string
          user_id: string
        }
        Update: {
          rank?: number
          snapshot_at?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_rank_snapshots_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournament_standings"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "tournament_rank_snapshots_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          continuous: boolean
          created_at: string
          created_by: string | null
          current_round: number
          description: string | null
          finished_at: string | null
          format: string
          id: string
          inscription_mode: string
          join_code: string | null
          modality: string | null
          name: string
          points_to_win: number
          rated: boolean
          rounds: number
          session_started_at: string | null
          status: string
          time_limit_minutes: number | null
          total_rounds: number | null
          visibility: string
        }
        Insert: {
          continuous?: boolean
          created_at?: string
          created_by?: string | null
          current_round?: number
          description?: string | null
          finished_at?: string | null
          format?: string
          id?: string
          inscription_mode?: string
          join_code?: string | null
          modality?: string | null
          name: string
          points_to_win?: number
          rated?: boolean
          rounds?: number
          session_started_at?: string | null
          status?: string
          time_limit_minutes?: number | null
          total_rounds?: number | null
          visibility?: string
        }
        Update: {
          continuous?: boolean
          created_at?: string
          created_by?: string | null
          current_round?: number
          description?: string | null
          finished_at?: string | null
          format?: string
          id?: string
          inscription_mode?: string
          join_code?: string | null
          modality?: string | null
          name?: string
          points_to_win?: number
          rated?: boolean
          rounds?: number
          session_started_at?: string | null
          status?: string
          time_limit_minutes?: number | null
          total_rounds?: number | null
          visibility?: string
        }
        Relationships: []
      }
    }
    Views: {
      match_feed: {
        Row: {
          created_at: string | null
          created_by: string | null
          finished_at: string | null
          format: string | null
          id: string | null
          players: Json | null
          status: string | null
          target_points: number | null
        }
        Relationships: []
      }
      match_live_state: {
        Row: {
          match_id: string | null
          rounds_played: number | null
          score_team_1: number | null
          score_team_2: number | null
          status: string | null
          target_points: number | null
        }
        Relationships: []
      }
      profile_ratings: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string | null
          d6_doubles_display: number | null
          d6_doubles_display_legacy: number | null
          d6_doubles_elo: number | null
          d6_doubles_games: number | null
          d6_doubles_losses: number | null
          d6_doubles_mu: number | null
          d6_doubles_ordinal: number | null
          d6_doubles_points_lost: number | null
          d6_doubles_points_won: number | null
          d6_doubles_sigma: number | null
          d6_doubles_wins: number | null
          d6_singles_display: number | null
          d6_singles_display_legacy: number | null
          d6_singles_elo: number | null
          d6_singles_games: number | null
          d6_singles_losses: number | null
          d6_singles_mu: number | null
          d6_singles_ordinal: number | null
          d6_singles_points_lost: number | null
          d6_singles_points_won: number | null
          d6_singles_sigma: number | null
          d6_singles_wins: number | null
          d9_doubles_display: number | null
          d9_doubles_elo: number | null
          d9_doubles_games: number | null
          d9_doubles_losses: number | null
          d9_doubles_mu: number | null
          d9_doubles_ordinal: number | null
          d9_doubles_points_lost: number | null
          d9_doubles_points_won: number | null
          d9_doubles_sigma: number | null
          d9_doubles_wins: number | null
          d9_singles_display: number | null
          d9_singles_elo: number | null
          d9_singles_games: number | null
          d9_singles_losses: number | null
          d9_singles_mu: number | null
          d9_singles_ordinal: number | null
          d9_singles_points_lost: number | null
          d9_singles_points_won: number | null
          d9_singles_sigma: number | null
          d9_singles_wins: number | null
          default_modality: string | null
          display_name: string | null
          global_display: number | null
          global_elo: number | null
          global_mu: number | null
          global_ordinal: number | null
          global_sigma: number | null
          id: string | null
          onboarded: boolean | null
          total_games: number | null
          total_losses: number | null
          total_points_lost: number | null
          total_points_won: number | null
          total_wins: number | null
          updated_at: string | null
          username: string | null
        }
        Relationships: []
      }
      tournament_standings: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          games: number | null
          losses: number | null
          points_against: number | null
          points_for: number | null
          tournament_id: string | null
          user_id: string | null
          username: string | null
          win_pct: number | null
          wins: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_friend_request: { Args: { req_id: string }; Returns: undefined }
      admin_resolve_match: {
        Args: { p_match_id: string; p_resolution: string }
        Returns: string
      }
      apply_match_rating: {
        Args: { p_match_id: string; p_updates: Json }
        Returns: undefined
      }
      are_friends: { Args: { a: string; b: string }; Returns: boolean }
      attest_match: {
        Args: { p_action: string; p_comment?: string; p_match_id: string }
        Returns: string
      }
      auto_confirm_stale_matches: { Args: never; Returns: string[] }
      calc_global_ordinal: {
        Args: { d_mu: number; d_sigma: number; s_mu: number; s_sigma: number }
        Returns: number
      }
      calc_global_ordinal_v2: {
        Args: {
          d6_games: number
          d6_mu: number
          d6_sigma: number
          d9_games: number
          d9_mu: number
          d9_sigma: number
          s6_games: number
          s6_mu: number
          s6_sigma: number
          s9_games: number
          s9_mu: number
          s9_sigma: number
        }
        Returns: number
      }
      evaluate_match_quorum: { Args: { p_match_id: string }; Returns: string }
      finalize_match: { Args: { p_match_id: string }; Returns: string }
      generate_next_round_rpc: {
        Args: {
          p_next_round: number
          p_pairings: Json
          p_tournament_id: string
        }
        Returns: Json
      }
      get_match_player_emails: {
        Args: { p_match_id: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_tournament_standings: {
        Args: { p_tournament_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          last5: string[]
          losses: number
          pc: number
          pf: number
          plus_minus: number
          prev_rank: number
          rank: number
          streak: string
          user_id: string
          username: string
          win_pct: number
          wins: number
        }[]
      }
      get_user_email: { Args: { p_user_id: string }; Returns: string }
      get_user_pending_tournaments: {
        Args: { p_user_id: string }
        Returns: {
          has_pending_match: boolean
          id: string
          name: string
          next_match_id: string
          status: string
        }[]
      }
      reset_all_elo: { Args: never; Returns: undefined }
      search_friends: {
        Args: { lim?: number; q: string }
        Returns: {
          avatar_url: string
          country: string
          display_name: string
          global_display: number
          id: string
          total_games: number
          username: string
        }[]
      }
      search_users: {
        Args: { exclude_self?: boolean; lim?: number; q: string }
        Returns: {
          avatar_url: string
          country: string
          display_name: string
          global_display: number
          id: string
          is_friend: boolean
          total_games: number
          username: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      snapshot_tournament_ranks: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      to_display_rating: { Args: { ordinal: number }; Returns: number }
      to_display_rating_elo: { Args: { p_elo: number }; Returns: number }
      unfriend: { Args: { other_user: string }; Returns: undefined }
      void_match: { Args: { p_match_id: string }; Returns: undefined }
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
