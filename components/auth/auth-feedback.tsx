import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { AuthActionState } from '@/services/auth/actions';

interface AuthFeedbackProps {
  state: AuthActionState;
}

export function AuthFeedback({ state }: AuthFeedbackProps) {
  if (state.status === 'idle' || !state.message) {
    return null;
  }

  const isSuccess = state.status === 'success';
  const Icon = isSuccess ? CheckCircle2 : AlertTriangle;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm',
        isSuccess ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700',
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <p>{state.message}</p>
    </div>
  );
}
