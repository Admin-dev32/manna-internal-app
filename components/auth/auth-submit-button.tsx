'use client';

import { LoaderCircle } from 'lucide-react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';

interface AuthSubmitButtonProps {
  idleLabel: string;
  loadingLabel: string;
}

export function AuthSubmitButton({ idleLabel, loadingLabel }: AuthSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full" disabled={pending} type="submit">
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
      {pending ? loadingLabel : idleLabel}
    </Button>
  );
}
