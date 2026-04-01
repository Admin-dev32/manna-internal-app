import { ChatWorkspace } from '@/components/chat/chat-workspace';
import { requirePermission, requireActiveSession } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureEventConversation, ensureGlobalTeamConversation, getChatMessages, getChatSidebarConversations } from '@/services/chat/queries';

export default async function ChatPage({
  searchParams,
}: {
  searchParams?: Promise<{ scope?: string; eventId?: string }>;
}) {
  await requirePermission('chat.view');
  const session = await requireActiveSession();
  if (!session.user) return null;

  const params = (await searchParams) ?? {};
  const scope = params.scope === 'event' ? 'event' : 'global';

  const globalConversation = await ensureGlobalTeamConversation(session.user.id);
  const activeConversation = scope === 'event' && params.eventId
    ? await ensureEventConversation(params.eventId, session.user.id)
    : globalConversation;

  const [conversations, messagesData, eventMapData] = await Promise.all([
    getChatSidebarConversations(),
    activeConversation ? getChatMessages(activeConversation.id) : Promise.resolve({ messages: [], profiles: {} }),
    createSupabaseServerClient().then(async (supabase) => {
      if (!supabase) return {} as Record<string, { id: string; event_type: string | null; event_date: string }>;
      const { data } = await supabase.from('events').select('id, event_type, event_date').order('event_date', { ascending: false }).limit(120);
      return Object.fromEntries((data ?? []).map((item) => [item.id, item]));
    }),
  ]);

  const canSend = hasPermission(session.user, 'chat.send');

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[2rem] border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-panel sm:p-8">
        <h1 className="text-3xl font-semibold">Chat de equipo</h1>
        <p className="mt-2 text-sm text-slate-300 sm:text-base">
          Conversación de canal (global + evento). Los comentarios contextuales por registro siguen viviendo en su timeline operativo.
        </p>
      </section>

      <ChatWorkspace
        activeConversation={activeConversation}
        conversations={conversations}
        messages={messagesData.messages}
        profiles={messagesData.profiles}
        eventMap={eventMapData}
        canSend={canSend}
      />
    </div>
  );
}
