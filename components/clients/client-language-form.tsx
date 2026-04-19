'use client';

import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { updateClientPreferredLanguageAction, type ClientLanguageFormState } from '@/services/clients/actions';
import type { ClientRecord } from '@/types/clients';

const initialState: ClientLanguageFormState = { status: 'idle' };

export function ClientLanguageForm({ client }: { client: ClientRecord }) {
  const [state, action] = useActionState(updateClientPreferredLanguageAction.bind(null, client.id), initialState);

  return (
    <form action={action} className="space-y-3 rounded-2xl border border-border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Idioma de comunicación</p>
      <select
        id="preferred_language"
        name="preferred_language"
        defaultValue={client.preferred_language ?? 'es'}
        className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm"
      >
        <option value="es">Español</option>
        <option value="en">Inglés</option>
      </select>
      {state.status !== 'idle' ? (
        <div className={`rounded-xl border px-3 py-2 text-xs ${state.status === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {state.message}
        </div>
      ) : null}
      <Button size="sm" type="submit">Guardar idioma</Button>
    </form>
  );
}
