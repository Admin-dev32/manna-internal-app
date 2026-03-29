import { MessageSquare, Zap } from 'lucide-react';

import { CommentComposer } from '@/components/communication/comment-composer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createInternalRecordCommentAction } from '@/services/internal-communication/actions';
import { getMentionableProfiles, getProfilesMap, getRecordTimeline } from '@/services/internal-communication/queries';
import type { InternalCommentEntityType } from '@/types/internal-communication';

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export async function RecordTimelineSection({
  entityType,
  entityId,
  returnPath,
  title = 'Comunicación interna',
}: {
  entityType: InternalCommentEntityType;
  entityId: string;
  returnPath: string;
  title?: string;
}) {
  const timeline = await getRecordTimeline(entityType, entityId);
  const profiles = await getProfilesMap(timeline.map((item) => item.created_by));
  const mentionableProfiles = await getMentionableProfiles();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Comentarios contextuales y actividades recientes del registro. Usa @usuario para mencionar.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={createInternalRecordCommentAction.bind(null, entityType, entityId)} className="space-y-3">
          <input type="hidden" name="return_path" value={returnPath} />
          <CommentComposer mentionableProfiles={mentionableProfiles} />
          <Button type="submit">
            <MessageSquare className="size-4" />
            Publicar comentario
          </Button>
        </form>

        <div className="space-y-3">
          {timeline.length > 0 ? (
            timeline.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border bg-background px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {item.kind === 'comment' ? <MessageSquare className="size-4 text-primary" /> : <Zap className="size-4 text-amber-600" />}
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDateTime(item.created_at)}</p>
                </div>
                {item.body ? <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.body}</p> : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  Por <strong className="text-foreground">{profiles[item.created_by]?.full_name ?? 'Usuario interno'}</strong>
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
              Aún no hay comentarios ni actividades en este registro.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
