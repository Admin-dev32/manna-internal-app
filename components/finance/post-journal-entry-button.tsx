'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { postDraftJournalEntryAction } from '@/services/finance/actions';

export function PostJournalEntryButton({ journalEntryId }: { journalEntryId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<{ status: 'idle' | 'success' | 'error'; message?: string }>({ status: 'idle' });

  function onPost() {
    setState({ status: 'idle' });

    const confirmed = window.confirm('Posting will lock this journal entry. Future corrections must use a reversal.');
    if (!confirmed) return;

    startTransition(async () => {
      const response = await postDraftJournalEntryAction(journalEntryId);
      setState(response.status === 'success' ? { status: 'success', message: response.message } : { status: 'error', message: response.message });
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Post Journal Entry confirms this draft into posted GL activity and locks the entry for immutability.</p>
      <p className="text-xs text-muted-foreground">Future corrections must use a reversal workflow.</p>
      {state.status !== 'idle' ? (
        <div className={`rounded-xl border px-3 py-2 text-sm ${state.status === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {state.message}
        </div>
      ) : null}
      <Button type="button" onClick={onPost} disabled={isPending}>
        {isPending ? 'Posting journal entry...' : 'Post Journal Entry'}
      </Button>
    </div>
  );
}
