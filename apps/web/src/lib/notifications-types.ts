export type NotificationCounts = {
  /** Total de notificaciones no leídas — alimenta el bell badge */
  unread: number;
};

export type NotificationType =
  | "friend_request_received"
  | "friend_request_accepted"
  | "attest_requested"
  | "attest_action"
  | "match_confirmed"
  | "match_disputed"
  | "match_auto_confirmed"
  | "tournament_added"
  | "tournament_started"
  | "tournament_round_ready"
  | "tournament_match_ready"
  | "tournament_finished"
  | "pair_invite_received"
  | "pair_invite_accepted"
  | string;

export type AppNotification = {
  id: string;
  type: NotificationType;
  payload: Record<string, string | number | boolean | null>;
  ref_match_id: string | null;
  ref_tournament_id: string | null;
  ref_user_id: string | null;
  read_at: string | null;
  created_at: string;
  /** Perfil del usuario relevante (sender, actor, scorekeeper) si aplica */
  actor: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  /**
   * Para friend_request_received: si la request sigue pendiente, request_id
   * apunta a ella. Si ya fue respondida, es null.
   */
  pending_request_id: string | null;
};
