export const CHAT_CONVERSATION_TYPES = ['global_team', 'event'] as const;

export type ChatConversationType = (typeof CHAT_CONVERSATION_TYPES)[number];

export interface ChatConversationRecord {
  id: string;
  conversation_type: ChatConversationType;
  event_id: string | null;
  title: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChatConversationMemberRecord {
  id: string;
  conversation_id: string;
  profile_id: string;
  role: 'member' | 'moderator';
  joined_at: string;
  last_read_at: string | null;
  is_muted: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRecord {
  id: string;
  conversation_id: string;
  sender_profile_id: string;
  body: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
