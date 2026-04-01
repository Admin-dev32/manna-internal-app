import { NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { runDueRecurringTaskRules } from '@/services/tasks/recurring';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
  const expectedToken = process.env.RECURRING_TASKS_CRON_SECRET ?? '';

  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ ok: false, message: 'No autorizado para ejecutar recurrencias.' }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: 'Faltan credenciales de Supabase para cron.' }, { status: 500 });
  }

  const summary = await runDueRecurringTaskRules({
    supabase,
    limit: 120,
  });

  return NextResponse.json({ ok: true, summary });
}
