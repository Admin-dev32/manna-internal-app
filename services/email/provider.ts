interface EmailProviderConfig {
  provider: 'resend';
  apiKey: string;
  from: string;
  replyTo: string | null;
}

export function getEmailProviderConfig(): EmailProviderConfig {
  const provider = (process.env.EMAIL_PROVIDER ?? 'resend').trim().toLowerCase();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM_ADDRESS?.trim();
  const fromName = process.env.EMAIL_FROM_NAME?.trim();
  const replyTo = process.env.EMAIL_REPLY_TO?.trim() ?? null;

  if (provider !== 'resend') {
    throw new Error('EMAIL_PROVIDER no soportado. Usa EMAIL_PROVIDER=resend.');
  }

  if (!apiKey || !from) {
    throw new Error('Configura RESEND_API_KEY y EMAIL_FROM_ADDRESS para enviar cotizaciones por email.');
  }

  return {
    provider: 'resend',
    apiKey,
    from: fromName ? `${fromName} <${from}>` : from,
    replyTo,
  };
}

export async function sendTransactionalEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const config = getEmailProviderConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.from,
        to: [to],
        subject,
        html,
        text,
        reply_to: config.replyTo ?? undefined,
      }),
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'El proveedor de email tardó demasiado en responder.'
      : 'No fue posible conectar con el proveedor de email.';
    throw new Error(message);
  } finally {
    clearTimeout(timeout);
  }

  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(String(payload?.message ?? payload?.error ?? `Error enviando email (status ${response.status}).`));
  }

  return {
    provider: config.provider,
    providerMessageId: typeof payload?.id === 'string' ? payload.id : null,
  };
}
