import type { Route } from 'next';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createChatMessageAction } from '@/services/chat/actions';
import type { ChatConversationRecord, ChatMessageRecord } from '@/types/chat';
import type { EventRecord } from '@/types/events';
import type { LeadProfileOption } from '@/types/leads';

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function resolveConversationLabel(conversation: ChatConversationRecord, eventMap: Record<string, Pick<EventRecord, 'id' | 'event_type' | 'event_date'>>) {
  if (conversation.conversation_type === 'global_team') return 'Global · Equipo';
  if (!conversation.event_id) return conversation.title ?? 'Evento';

  const event = eventMap[conversation.event_id];
  if (!event) return conversation.title ?? `Evento #${conversation.event_id.slice(0, 8)}`;
  return `${event.event_type ?? 'Evento'} · ${event.event_date}`;
}

export function ChatWorkspace({
  activeConversation,
  conversations,
  messages,
  profiles,
  eventMap,
  canSend,
}: {
  activeConversation: ChatConversationRecord | null;
  conversations: ChatConversationRecord[];
  messages: ChatMessageRecord[];
  profiles: Record<string, LeadProfileOption>;
  eventMap: Record<string, Pick<EventRecord, 'id' | 'event_type' | 'event_date'>>;
  canSend: boolean;
}) {
  const returnPath = activeConversation?.conversation_type === 'event' && activeConversation.event_id
    ? (`/chat?scope=event&eventId=${activeConversation.event_id}` as Route)
    : ('/chat?scope=global' as Route);

  return (
    <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Canales</CardTitle>
          <CardDescription>Chat híbrido V1: global + contexto evento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild variant={activeConversation?.conversation_type === 'global_team' ? 'default' : 'outline'} className="w-full justify-start">
            <Link href={'/chat?scope=global' as Route}>Global · Equipo</Link>
          </Button>

          {conversations
            .filter((item) => item.conversation_type === 'event' && item.event_id)
            .map((conversation) => (
              <Button
                key={conversation.id}
                asChild
                variant={activeConversation?.id === conversation.id ? 'default' : 'outline'}
                className="w-full justify-start"
              >
                <Link href={`/chat?scope=event&eventId=${conversation.event_id}` as Route}>
                  {resolveConversationLabel(conversation, eventMap)}
                </Link>
              </Button>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {activeConversation ? resolveConversationLabel(activeConversation, eventMap) : 'Sin conversación seleccionada'}
          </CardTitle>
          <CardDescription>
            Este chat es de canal/equipo. Los comentarios contextuales por registro siguen en su timeline operativo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {messages.length > 0 ? (
            <div className="space-y-3">
              {messages.map((message) => {
                const profile = profiles[message.sender_profile_id];
                return (
                  <div key={message.id} className="rounded-2xl border border-border bg-background px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{profile?.full_name ?? 'Usuario interno'}</p>
                      <Badge variant="outline">{formatDateTime(message.created_at)}</Badge>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{message.body}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
              Todavía no hay mensajes en este canal.
            </div>
          )}

          {activeConversation ? (
            canSend ? (
              <form action={createChatMessageAction} className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4">
                <input type="hidden" name="conversation_id" value={activeConversation.id} />
                <input type="hidden" name="return_path" value={returnPath} />
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nuevo mensaje</label>
                <textarea
                  name="body"
                  required
                  rows={3}
                  className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm"
                  placeholder="Escribe un mensaje para coordinar al equipo."
                />
                <Button type="submit">Enviar</Button>
              </form>
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                No tienes permiso para enviar mensajes en chat.
              </div>
            )
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
