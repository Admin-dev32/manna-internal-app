import type { InternalPaymentLinkApiPayload } from '@/types/payments';
import { getBusinessSettings } from '@/services/business-settings/queries';

interface InternalPaymentsConfig {
  baseUrl: string;
  apiKey: string;
  source: string;
  system: string;
  timezone: string;
}

export async function getInternalPaymentsConfig(): Promise<InternalPaymentsConfig> {
  const baseUrl = process.env.INTERNAL_PAYMENTS_API_BASE_URL?.trim();
  const apiKey = process.env.INTERNAL_API_KEY?.trim();
  const settings = await getBusinessSettings();
  const source = settings.internal_payments_source;
  const system = settings.internal_payments_system;
  const timezone = settings.operational_timezone;

  if (!baseUrl || !apiKey || !source || !system) {
    throw new Error('Configura INTERNAL_PAYMENTS_API_BASE_URL e INTERNAL_API_KEY en env, y completa source/system operativos en Configuración > Negocio y pagos.');
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    apiKey,
    source,
    system,
    timezone,
  };
}

export async function createCentralPaymentLink(payload: InternalPaymentLinkApiPayload) {
  const config = await getInternalPaymentsConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/api/internal/payment-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'La API central de pagos no respondió a tiempo. Intenta nuevamente.'
      : 'No fue posible conectar con la API central de pagos. Verifica endpoint, red y API key.';
    throw new Error(message);
  } finally {
    clearTimeout(timeout);
  }

  let data: Record<string, unknown> | null = null;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      String(
        data?.message ?? data?.error ?? `La API central de pagos respondió con estado ${response.status}.`,
      ),
    );
  }

  return data ?? {};
}
