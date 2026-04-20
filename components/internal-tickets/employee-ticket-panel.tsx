'use client';

import { useActionState } from 'react';
import { LifeBuoy, Send } from 'lucide-react';

import { INTERNAL_TICKET_CATEGORY_LABELS, INTERNAL_TICKET_PRIORITY_LABELS, INTERNAL_TICKET_STATUS_LABELS } from '@/config/internal-tickets';
import { AuthFeedback } from '@/components/auth/auth-feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { initialEmployeeActionFormState } from '@/services/employees/form-state';
import type { EmployeeActionFormState } from '@/services/employees/form-state';
import type { EmployeeAssignedEvent } from '@/types/employees';
import type { InternalTicketView } from '@/types/internal-tickets';

export function EmployeeTicketPanel({
  myTickets,
  availableAssignments,
  createTicketAction,
}: {
  myTickets: InternalTicketView[];
  availableAssignments: EmployeeAssignedEvent[];
  createTicketAction: (state: EmployeeActionFormState, formData: FormData) => Promise<EmployeeActionFormState>;
}) {
  const [formState, formAction] = useActionState(createTicketAction, initialEmployeeActionFormState);

  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2"><LifeBuoy className="size-5" />Tickets internos · Main office</CardTitle>
        <CardDescription>Canal simple para solicitudes operativas hacia Owner/main office.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={formAction} className="grid gap-3 rounded-2xl border bg-muted/20 p-4 md:grid-cols-2">
          <Input name="subject" placeholder="Asunto corto del ticket" required className="md:col-span-2" />
          <textarea
            name="description"
            rows={4}
            required
            className="md:col-span-2 w-full rounded-xl border bg-background px-3 py-2 text-sm"
            placeholder="Describe el problema o solicitud para main office."
          />
          <select name="category" defaultValue="general_request" className="rounded-xl border bg-background px-3 py-2 text-sm">
            {Object.entries(INTERNAL_TICKET_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select name="priority" defaultValue="normal" className="rounded-xl border bg-background px-3 py-2 text-sm">
            {Object.entries(INTERNAL_TICKET_PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select name="event_id" defaultValue="" className="rounded-xl border bg-background px-3 py-2 text-sm md:col-span-2">
            <option value="">Ticket general (sin evento)</option>
            {availableAssignments.map((assignment) => (
              <option key={assignment.assignmentId} value={assignment.event.id}>
                {assignment.event.event_type ?? 'Evento'} · {assignment.event.event_date} · #{assignment.event.id.slice(0, 8)}
              </option>
            ))}
          </select>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit"><Send className="size-4" />Enviar ticket</Button>
          </div>
          <div className="md:col-span-2"><AuthFeedback state={formState} /></div>
        </form>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Mis tickets recientes</p>
          {myTickets.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">Aún no has enviado tickets internos.</p>
          ) : (
            myTickets.slice(0, 8).map((ticket) => (
              <div key={ticket.id} className="rounded-2xl border bg-background p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{ticket.subject}</p>
                  <Badge variant={ticket.status === 'closed' ? 'success' : ticket.status === 'in_progress' ? 'secondary' : 'outline'}>
                    {INTERNAL_TICKET_STATUS_LABELS[ticket.status]}
                  </Badge>
                  <Badge variant="outline">{INTERNAL_TICKET_PRIORITY_LABELS[ticket.priority]}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">{ticket.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">{INTERNAL_TICKET_CATEGORY_LABELS[ticket.category]} {ticket.event_label ? `· ${ticket.event_label}` : '· General'}</p>
                {ticket.office_response ? <p className="mt-2 text-xs text-emerald-700">Respuesta main office: {ticket.office_response}</p> : null}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
