import { INTERNAL_TICKET_CATEGORY_LABELS, INTERNAL_TICKET_PRIORITY_LABELS, INTERNAL_TICKET_STATUS_LABELS } from '@/config/internal-tickets';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { updateInternalTicketStatusAction } from '@/services/internal-tickets/actions';
import type { InternalTicketStatus, InternalTicketView } from '@/types/internal-tickets';

export function MainOfficeInbox({
  tickets,
  statusFilter,
  assignableProfiles,
}: {
  tickets: InternalTicketView[];
  statusFilter: 'all' | InternalTicketStatus;
  assignableProfiles: Array<{ id: string; full_name: string | null }>;
}) {
  const openCount = tickets.filter((item) => item.status === 'open').length;
  const inProgressCount = tickets.filter((item) => item.status === 'in_progress').length;
  const closedCount = tickets.filter((item) => item.status === 'closed').length;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle>Main office inbox · Tickets internos</CardTitle>
          <CardDescription>Inbox central de Owner para responder, gestionar y cerrar solicitudes del equipo.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <Stat label="Total" value={tickets.length.toString()} />
          <Stat label="Abiertos" value={openCount.toString()} />
          <Stat label="En progreso" value={inProgressCount.toString()} />
          <Stat label="Cerrados" value={closedCount.toString()} />
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle>Filtro rápido</CardTitle>
          <CardDescription>Estado actual: {statusFilter === 'all' ? 'Todos' : INTERNAL_TICKET_STATUS_LABELS[statusFilter]}.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap gap-2" method="get">
            <button name="status" value="all" className="rounded-xl border px-3 py-2 text-sm">Todos</button>
            <button name="status" value="open" className="rounded-xl border px-3 py-2 text-sm">Abiertos</button>
            <button name="status" value="in_progress" className="rounded-xl border px-3 py-2 text-sm">En progreso</button>
            <button name="status" value="closed" className="rounded-xl border px-3 py-2 text-sm">Cerrados</button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {tickets.length === 0 ? (
          <Card className="rounded-3xl">
            <CardContent className="p-4 text-sm text-muted-foreground">No hay tickets para este filtro.</CardContent>
          </Card>
        ) : (
          tickets.map((ticket) => (
            <Card key={ticket.id} className="rounded-3xl">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-lg">{ticket.subject}</CardTitle>
                  <Badge variant={ticket.status === 'closed' ? 'success' : ticket.status === 'in_progress' ? 'secondary' : 'outline'}>
                    {INTERNAL_TICKET_STATUS_LABELS[ticket.status]}
                  </Badge>
                  <Badge variant="outline">{INTERNAL_TICKET_PRIORITY_LABELS[ticket.priority]}</Badge>
                  <Badge variant="outline">{INTERNAL_TICKET_CATEGORY_LABELS[ticket.category]}</Badge>
                </div>
                <CardDescription>
                  Enviado por: {ticket.created_by_name ?? 'Usuario interno'} · {ticket.event_label ?? 'Ticket general'} · {new Date(ticket.created_at).toLocaleString('es-MX')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{ticket.description}</p>
                {ticket.office_response ? (
                  <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Respuesta actual: {ticket.office_response}</p>
                ) : null}

                <form action={updateInternalTicketStatusAction.bind(null, ticket.id)} className="grid gap-3 md:grid-cols-3">
                  <select name="status" defaultValue={ticket.status} className="rounded-xl border bg-background px-3 py-2 text-sm">
                    <option value="open">Abierto</option>
                    <option value="in_progress">En progreso</option>
                    <option value="closed">Cerrado</option>
                  </select>
                  <select name="assigned_to" defaultValue={ticket.assigned_to ?? ''} className="rounded-xl border bg-background px-3 py-2 text-sm">
                    <option value="">Sin asignar</option>
                    {assignableProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>{profile.full_name ?? profile.id}</option>
                    ))}
                  </select>
                  <Input name="office_response" defaultValue={ticket.office_response ?? ''} placeholder="Respuesta / instrucción main office" />
                  <div className="md:col-span-3 flex justify-end">
                    <Button type="submit">Guardar gestión</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-background p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
