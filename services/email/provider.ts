import net from 'node:net';
import tls from 'node:tls';

import { getBusinessSettings } from '@/services/business-settings/queries';

interface ResendProviderConfig {
  provider: 'resend';
  apiKey: string;
  from: string;
  replyTo: string | null;
}

interface SmtpProviderConfig {
  provider: 'smtp';
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  replyTo: string | null;
}

type EmailProviderConfig = ResendProviderConfig | SmtpProviderConfig;

function parseBoolean(value: string | undefined, defaultValue: boolean) {
  if (!value) return defaultValue;
  const normalized = value.trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function escapeHeaderValue(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function extractAddressFromFromHeader(from: string) {
  const bracketMatch = from.match(/<([^>]+)>/);
  if (bracketMatch?.[1]) return bracketMatch[1].trim();
  return from.trim();
}

function redactSensitiveText(value: string) {
  return value
    .replace(/Authorization:\s*Bearer\s+[^\s]+/gi, 'Authorization: Bearer [REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9\-_.=]+/gi, 'Bearer [REDACTED]')
    .replace(/(password|smtp_password|api[_-]?key|token|secret)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/\b[A-Za-z0-9+/]{24,}={0,2}\b/g, '[REDACTED_BASE64]');
}

function getSafeSmtpErrorMessage(error: unknown) {
  const raw = error instanceof Error ? redactSensitiveText(error.message) : '';

  if (raw.includes('535') || /auth|autentic/i.test(raw)) {
    return 'No se pudo autenticar con el servidor SMTP. Verifica SMTP_USER y SMTP_PASSWORD.';
  }

  if (raw.includes('timeout') || /timed out|econnreset|enotfound|econnrefused|network/i.test(raw)) {
    return 'No se pudo conectar al servidor SMTP. Verifica SMTP_HOST, SMTP_PORT, red y disponibilidad del servicio.';
  }

  if (raw.includes('550') || raw.includes('553') || raw.includes('554')) {
    return 'El servidor SMTP rechazó el envío del correo. Verifica remitente, destinatario y políticas del servidor.';
  }

  return 'No fue posible enviar el correo mediante SMTP. Revisa configuración SMTP y estado del servidor.';
}

export function getSafeEmailErrorMessage(error: unknown) {
  const raw = error instanceof Error ? redactSensitiveText(error.message) : '';

  if (!raw) {
    return 'No fue posible enviar el correo por un error inesperado.';
  }

  if (raw.toLowerCase().includes('smtp')) {
    return getSafeSmtpErrorMessage(error);
  }

  return raw;
}

async function readSmtpResponse(socket: net.Socket | tls.TLSSocket) {
  return new Promise<{ code: number; message: string }>((resolve, reject) => {
    let buffer = '';
    const lines: string[] = [];

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const parts = buffer.split('\r\n');
      buffer = parts.pop() ?? '';

      for (const line of parts) {
        if (!line) continue;
        lines.push(line);
        const match = line.match(/^(\d{3})([\s-])(.*)$/);
        if (match && match[2] === ' ') {
          cleanup();
          resolve({
            code: Number(match[1]),
            message: lines.join('\n'),
          });
          return;
        }
      }
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onClose = () => {
      cleanup();
      reject(new Error('La conexión SMTP se cerró inesperadamente.'));
    };

    function cleanup() {
      socket.off('data', onData);
      socket.off('error', onError);
      socket.off('close', onClose);
    }

    socket.on('data', onData);
    socket.once('error', onError);
    socket.once('close', onClose);
  });
}

async function sendSmtpCommand(
  socket: net.Socket | tls.TLSSocket,
  command: string,
  expectedCodes: number[],
) {
  socket.write(`${command}\r\n`);
  const response = await readSmtpResponse(socket);
  if (!expectedCodes.includes(response.code)) {
    throw new Error(`SMTP rechazó la operación (${response.code}).`);
  }
  return response;
}

async function sendViaSmtp(config: SmtpProviderConfig, payload: { to: string; subject: string; html: string; text?: string }) {
  const socket = config.secure
    ? tls.connect({
      host: config.host,
      port: config.port,
      rejectUnauthorized: true,
    })
    : net.connect({
      host: config.host,
      port: config.port,
    });

  const timeout = setTimeout(() => {
    socket.destroy(new Error('Timeout conectando con SMTP.'));
  }, 12000);

  await new Promise<void>((resolve, reject) => {
    const onConnect = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off('connect', onConnect);
      socket.off('secureConnect', onConnect);
      socket.off('error', onError);
    };

    socket.once(config.secure ? 'secureConnect' : 'connect', onConnect);
    socket.once('error', onError);
  });

  try {
    const greeting = await readSmtpResponse(socket);
    if (greeting.code !== 220) {
      throw new Error(`Servidor SMTP no respondió ready (${greeting.code}).`);
    }

    await sendSmtpCommand(socket, 'EHLO manna-internal-app', [250]);
    await sendSmtpCommand(socket, 'AUTH LOGIN', [334]);
    await sendSmtpCommand(socket, Buffer.from(config.user).toString('base64'), [334]);
    await sendSmtpCommand(socket, Buffer.from(config.password).toString('base64'), [235]);

    await sendSmtpCommand(socket, `MAIL FROM:<${extractAddressFromFromHeader(config.from)}>`, [250]);
    await sendSmtpCommand(socket, `RCPT TO:<${payload.to}>`, [250, 251]);
    await sendSmtpCommand(socket, 'DATA', [354]);

    const headers = [
      `From: ${escapeHeaderValue(config.from)}`,
      `To: ${escapeHeaderValue(payload.to)}`,
      `Subject: ${escapeHeaderValue(payload.subject)}`,
      `Reply-To: ${escapeHeaderValue(config.replyTo ?? extractAddressFromFromHeader(config.from))}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
    ].join('\r\n');

    const body = payload.html || payload.text || '';
    socket.write(`${headers}\r\n\r\n${body}\r\n.\r\n`);

    const dataResponse = await readSmtpResponse(socket);
    if (dataResponse.code !== 250) {
      throw new Error(`SMTP no aceptó el contenido del correo (${dataResponse.code}).`);
    }

    await sendSmtpCommand(socket, 'QUIT', [221]);

    const providerMessageId = dataResponse.message.match(/<[^>]+>/)?.[0] ?? null;
    return {
      provider: 'smtp' as const,
      providerMessageId,
    };
  } catch (error) {
    throw new Error(getSafeSmtpErrorMessage(error));
  } finally {
    clearTimeout(timeout);
    socket.end();
  }
}

export async function getEmailProviderConfig(): Promise<EmailProviderConfig> {
  const provider = (process.env.EMAIL_PROVIDER ?? 'resend').trim().toLowerCase();
  const from = process.env.EMAIL_FROM_ADDRESS?.trim();
  const settings = await getBusinessSettings();

  if (!from) {
    throw new Error('Configura EMAIL_FROM_ADDRESS para enviar correos.');
  }

  const fromHeader = settings.email_from_name ? `${settings.email_from_name} <${from}>` : from;

  if (provider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('Configura RESEND_API_KEY para usar EMAIL_PROVIDER=resend.');
    }

    return {
      provider: 'resend',
      apiKey,
      from: fromHeader,
      replyTo: settings.email_reply_to,
    };
  }

  if (provider === 'smtp') {
    const host = process.env.SMTP_HOST?.trim();
    const portRaw = process.env.SMTP_PORT?.trim();
    const user = process.env.SMTP_USER?.trim();
    const password = process.env.SMTP_PASSWORD?.trim();
    const secure = parseBoolean(process.env.SMTP_SECURE, true);
    const port = Number(portRaw ?? (secure ? '465' : '587'));

    if (!host || !user || !password || !Number.isInteger(port) || port <= 0) {
      throw new Error('Configura SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER y SMTP_PASSWORD para usar EMAIL_PROVIDER=smtp.');
    }

    return {
      provider: 'smtp',
      host,
      port,
      secure,
      user,
      password,
      from: fromHeader,
      replyTo: settings.email_reply_to,
    };
  }

  throw new Error('EMAIL_PROVIDER no soportado. Usa EMAIL_PROVIDER=resend o EMAIL_PROVIDER=smtp.');
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
  const config = await getEmailProviderConfig();
  if (config.provider === 'smtp') {
    try {
      return await sendViaSmtp(config, { to, subject, html, text });
    } catch (error) {
      throw new Error(getSafeSmtpErrorMessage(error));
    }
  }

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
    const message = String(payload?.message ?? payload?.error ?? `Error enviando email (status ${response.status}).`);
    throw new Error(getSafeEmailErrorMessage(new Error(message)));
  }

  return {
    provider: config.provider,
    providerMessageId: typeof payload?.id === 'string' ? payload.id : null,
  };
}
