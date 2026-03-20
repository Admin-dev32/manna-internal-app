export interface NotificationDraft {
  title: string;
  body: string;
  audience: 'general' | 'owner' | 'manager' | 'empleado';
}

export async function queueNotification(_notification: NotificationDraft) {
  return {
    accepted: false,
    reason: 'Las notificaciones aún no están implementadas en este bloque.',
  };
}
