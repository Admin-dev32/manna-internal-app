export const INTERNAL_COMMENT_ENTITY_TYPES = ['lead', 'quote', 'client', 'pre_event', 'event', 'event_task'] as const;

export type InternalCommentEntityType = (typeof INTERNAL_COMMENT_ENTITY_TYPES)[number];

export interface InternalRecordComment {
  id: string;
  entity_type: InternalCommentEntityType;
  entity_id: string;
  body: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface InternalCommentMention {
  id: string;
  comment_id: string;
  mentioned_profile_id: string;
  mention_key: string;
  created_at: string;
}

export interface InternalMentionNotification {
  id: string;
  mention_id: string;
  profile_id: string;
  entity_type: InternalCommentEntityType;
  entity_id: string;
  is_read: boolean;
  created_at: string;
}

export interface RecordTimelineItem {
  id: string;
  kind: 'comment' | 'activity';
  title: string;
  body: string | null;
  created_by: string;
  created_at: string;
}
