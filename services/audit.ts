export interface AuditEventDraft {
  action: string;
  entity: string;
  summary: string;
}

export async function queueAuditEvent(_event: AuditEventDraft) {
  return {
    accepted: false,
    reason: 'La auditoría aún no está implementada en este bloque.',
  };
}
