'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EVENT_ASSIGNMENT_ROLE_LABELS, EVENT_ASSIGNMENT_STATUS_LABELS } from '@/config/events';
import { canCancelContractorPayout } from '@/lib/finance/contractor-payouts';
import {
  approveContractorPayoutAction,
  cancelContractorPayoutAction,
  createContractorPayoutDraftAction,
  markContractorPayoutPaidAction,
  updateContractorPayoutDraftAction,
} from '@/services/finance/actions';
import type { ContractorPayoutReadModel } from '@/services/finance/queries';
import type { EventStaffAssignmentRecord } from '@/types/events';
import type { ContractorPayoutPaymentMethod } from '@/types/finance';
import type { LeadProfileOption } from '@/types/leads';

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
}

type ActionFeedback = { kind: 'success' | 'error'; message: string } | null;

export function EventContractorPayoutsPanel({
  eventId,
  assignments,
  profiles,
  payouts,
  canManagePayouts,
  canApprovePayouts,
}: {
  eventId: string;
  assignments: EventStaffAssignmentRecord[];
  profiles: Record<string, LeadProfileOption>;
  payouts: ContractorPayoutReadModel[];
  canManagePayouts: boolean;
  canApprovePayouts: boolean;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<ActionFeedback>(null);
  const [expandedCreateId, setExpandedCreateId] = useState<string | null>(null);
  const [expandedEditId, setExpandedEditId] = useState<string | null>(null);
  const [expandedPaidId, setExpandedPaidId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const payoutByAssignmentId = useMemo(() => {
    const result: Record<string, ContractorPayoutReadModel> = {};
    for (const payout of payouts) {
      if (payout.assignment_id && !result[payout.assignment_id]) {
        result[payout.assignment_id] = payout;
      }
    }
    return result;
  }, [payouts]);

  function payoutForAssignment(assignment: EventStaffAssignmentRecord) {
    return payoutByAssignmentId[assignment.id] ?? payouts.find((payout) => payout.profile_id === assignment.profile_id) ?? null;
  }

  function withAction(action: () => Promise<{ status: 'success' | 'error'; message: string }>) {
    setFeedback(null);
    startTransition(async () => {
      const result = await action();
      setFeedback({
        kind: result.status,
        message: result.message,
      });
      if (result.status === 'success') {
        setExpandedCreateId(null);
        setExpandedEditId(null);
        setExpandedPaidId(null);
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contractor payouts</CardTitle>
        <CardDescription>Contractor payouts are operational records and are not posted to expenses or ledger yet.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-2xl border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          Paid payouts are tracked here but not automatically posted to financial_expenses in this phase.
        </p>

        {feedback ? (
          <div
            className={`rounded-xl border px-3 py-2 text-sm ${
              feedback.kind === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {feedback.message}
          </div>
        ) : null}

        {assignments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
            No hay staff assignments para este evento todavía.
          </div>
        ) : (
          assignments.map((assignment) => {
            const payout = payoutForAssignment(assignment);
            const assignedProfile = profiles[assignment.profile_id];
            const canManageOrApprove = canManagePayouts || canApprovePayouts;

            return (
              <div key={assignment.id} className="rounded-2xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{assignedProfile?.full_name ?? 'Staff interno'}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge variant="outline">{EVENT_ASSIGNMENT_ROLE_LABELS[assignment.assignment_role]}</Badge>
                      <Badge variant="secondary">{EVENT_ASSIGNMENT_STATUS_LABELS[assignment.assignment_status]}</Badge>
                    </div>
                  </div>
                  {payout ? <Badge>{payout.status}</Badge> : <Badge variant="outline">No payout yet</Badge>}
                </div>

                {payout ? (
                  <div className="mt-3 grid gap-2 rounded-2xl border border-border bg-muted/20 p-3 text-xs text-muted-foreground sm:grid-cols-2">
                    <p>Amount: <strong className="text-foreground">{formatCurrency(payout.amount)}</strong></p>
                    <p>Method: <strong className="text-foreground">{payout.payment_method}</strong></p>
                    <p>Date: <strong className="text-foreground">{payout.payout_date ?? 'N/D'}</strong></p>
                    <p>External ref: <strong className="text-foreground">{payout.external_reference ?? 'N/D'}</strong></p>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  {!payout && canManagePayouts ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => setExpandedCreateId((prev) => (prev === assignment.id ? null : assignment.id))}>
                      Create draft payout
                    </Button>
                  ) : null}

                  {payout && payout.status === 'draft' && canManagePayouts ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => setExpandedEditId((prev) => (prev === payout.id ? null : payout.id))}>
                      Edit draft
                    </Button>
                  ) : null}

                  {payout && payout.status === 'draft' && canApprovePayouts ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        withAction(async () => {
                          const result = await approveContractorPayoutAction(payout.id);
                          return { status: result.status, message: result.message };
                        })
                      }
                      disabled={isPending}
                    >
                      Approve
                    </Button>
                  ) : null}

                  {payout && payout.status === 'approved' && canManageOrApprove ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => setExpandedPaidId((prev) => (prev === payout.id ? null : payout.id))}>
                      Mark paid
                    </Button>
                  ) : null}

                  {payout && canManageOrApprove && canCancelContractorPayout(payout.status) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        withAction(async () => {
                          const result = await cancelContractorPayoutAction(payout.id);
                          return { status: result.status, message: result.message };
                        })
                      }
                      disabled={isPending}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>

                {expandedCreateId === assignment.id && canManagePayouts ? (
                  <form
                    className="mt-3 grid gap-3 rounded-2xl border border-border bg-muted/20 p-3 md:grid-cols-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = event.currentTarget;
                      const amount = Number(new FormData(form).get('amount'));
                      const paymentMethod = String(new FormData(form).get('payment_method') ?? 'other') as ContractorPayoutPaymentMethod;
                      const notes = String(new FormData(form).get('notes') ?? '').trim() || null;
                      withAction(async () => {
                        const result = await createContractorPayoutDraftAction({
                          profile_id: assignment.profile_id,
                          event_id: eventId,
                          assignment_id: assignment.id,
                          amount,
                          payment_method: paymentMethod,
                          notes,
                        });
                        return { status: result.status, message: result.message };
                      });
                    }}
                  >
                    <Input name="amount" type="number" min="0" step="0.01" required placeholder="Amount" disabled={isPending} />
                    <select name="payment_method" className="h-11 rounded-2xl border border-input bg-background px-4 text-sm" defaultValue="other" disabled={isPending}>
                      <option value="other">Other</option>
                      <option value="cash">Cash</option>
                      <option value="zelle">Zelle</option>
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="card">Card</option>
                    </select>
                    <Textarea name="notes" className="md:col-span-2" rows={2} placeholder="Optional notes" disabled={isPending} />
                    <div className="md:col-span-2 flex justify-end">
                      <Button type="submit" disabled={isPending}>Create draft</Button>
                    </div>
                  </form>
                ) : null}

                {payout && expandedEditId === payout.id && payout.status === 'draft' && canManagePayouts ? (
                  <form
                    className="mt-3 grid gap-3 rounded-2xl border border-border bg-muted/20 p-3 md:grid-cols-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const formData = new FormData(event.currentTarget);
                      const amount = Number(formData.get('amount'));
                      const paymentMethod = String(formData.get('payment_method') ?? payout.payment_method) as ContractorPayoutPaymentMethod;
                      const notes = String(formData.get('notes') ?? '').trim() || null;
                      withAction(async () => {
                        const result = await updateContractorPayoutDraftAction(payout.id, {
                          profile_id: assignment.profile_id,
                          event_id: eventId,
                          assignment_id: assignment.id,
                          amount,
                          payment_method: paymentMethod,
                          notes,
                          payout_date: payout.payout_date,
                          external_reference: payout.external_reference,
                        });
                        return { status: result.status, message: result.message };
                      });
                    }}
                  >
                    <Input name="amount" type="number" min="0" step="0.01" required defaultValue={String(payout.amount)} disabled={isPending} />
                    <select name="payment_method" className="h-11 rounded-2xl border border-input bg-background px-4 text-sm" defaultValue={payout.payment_method} disabled={isPending}>
                      <option value="other">Other</option>
                      <option value="cash">Cash</option>
                      <option value="zelle">Zelle</option>
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="card">Card</option>
                    </select>
                    <Textarea name="notes" className="md:col-span-2" rows={2} defaultValue={payout.notes ?? ''} disabled={isPending} />
                    <div className="md:col-span-2 flex justify-end">
                      <Button type="submit" disabled={isPending}>Save draft</Button>
                    </div>
                  </form>
                ) : null}

                {payout && expandedPaidId === payout.id && payout.status === 'approved' && canManageOrApprove ? (
                  <form
                    className="mt-3 grid gap-3 rounded-2xl border border-border bg-muted/20 p-3 md:grid-cols-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const formData = new FormData(event.currentTarget);
                      const payoutDate = String(formData.get('payout_date') ?? '').trim() || null;
                      const paymentMethod = String(formData.get('payment_method') ?? '').trim() || null;
                      const externalReference = String(formData.get('external_reference') ?? '').trim() || null;
                      withAction(async () => {
                        const result = await markContractorPayoutPaidAction(payout.id, {
                          payout_date: payoutDate,
                          payment_method: paymentMethod,
                          external_reference: externalReference,
                        });
                        return { status: result.status, message: result.message };
                      });
                    }}
                  >
                    <Input name="payout_date" type="date" defaultValue={payout.payout_date ?? ''} disabled={isPending} />
                    <select name="payment_method" className="h-11 rounded-2xl border border-input bg-background px-4 text-sm" defaultValue={payout.payment_method} disabled={isPending}>
                      <option value="other">Other</option>
                      <option value="cash">Cash</option>
                      <option value="zelle">Zelle</option>
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="card">Card</option>
                    </select>
                    <Input name="external_reference" placeholder="External reference" defaultValue={payout.external_reference ?? ''} disabled={isPending} />
                    <div className="md:col-span-3 flex justify-end">
                      <Button type="submit" disabled={isPending}>Confirm paid</Button>
                    </div>
                  </form>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
