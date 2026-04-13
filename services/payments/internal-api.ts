import type { InternalPaymentLinkApiPayload } from '@/types/payments';
import { getBusinessSettings } from '@/services/business-settings/queries';

interface InternalPaymentsConfig {
  baseUrl: string;
  apiKey: string;
  source: string;
  system: string;
  timezone: string;
}

export type InternalPaymentsErrorCode =
  | 'missing_base_url'
  | 'missing_api_key'
  | 'missing_source_or_system'
  | 'timeout'
  | 'network'
  | 'invalid_json'
  | 'api_error';

export class InternalPaymentsError extends Error {
  code: InternalPaymentsErrorCode;

  constructor(code: InternalPaymentsErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'InternalPaymentsError';
  }
}

export function getInternalPaymentsErrorMessage(error: unknown) {
  if (error instanceof InternalPaymentsError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'No fue posible crear el payment link por un error inesperado.';
}

export async function getInternalPaymentsConfig(): Promise<InternalPaymentsConfig> {
  const baseUrl = process.env.INTERNAL_PAYMENTS_API_BASE_URL?.trim();
  const apiKey = process.env.INTERNAL_API_KEY?.trim();
  const settings = await getBusinessSettings();
  const source = settings.internal_payments_source;
  const system = settings.internal_payments_system;
  const timezone = settings.operational_timezone;

  if (!baseUrl) {
    throw new InternalPaymentsError(
      'missing_base_url',
      'Falta INTERNAL_PAYMENTS_API_BASE_URL en el entorno. Define la URL base de la API interna de pagos para poder generar links.',
    );
  }

  if (!apiKey) {
    throw new InternalPaymentsError(
      'missing_api_key',
      'Falta INTERNAL_API_KEY en el entorno. Define la API key de la API interna de pagos para poder generar links.',
    );
  }

  if (!source || !system) {
    throw new InternalPaymentsError(
      'missing_source_or_system',
      'Falta configuración operativa de pagos (source/system). Revísala en Configuración > Negocio y pagos.',
    );
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
    if (error instanceof Error && error.name === 'AbortError') {
      throw new InternalPaymentsError(
        'timeout',
        'La API interna de pagos tardó demasiado en responder (timeout). Verifica conectividad o estado del servicio.',
      );
    }

    throw new InternalPaymentsError(
      'network',
      'No fue posible conectar con la API interna de pagos. Verifica URL, red y credenciales.',
    );
  } finally {
    clearTimeout(timeout);
  }

  let data: Record<string, unknown> | null = null;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    if (response.ok) {
      throw new InternalPaymentsError(
        'invalid_json',
        'La API interna respondió, pero devolvió un JSON inválido. Revisa el contrato del endpoint /api/internal/payment-link.',
      );
    }
  }

  if (!response.ok) {
    throw new InternalPaymentsError(
      'api_error',
      String(
        data?.message ?? data?.error ?? `La API interna de pagos respondió con estado ${response.status}.`,
      ),
    );
  }

  return data ?? {};
}
