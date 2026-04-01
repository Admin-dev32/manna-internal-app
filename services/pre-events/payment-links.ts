import type { ClientRecord } from '@/types/clients';
import type { LeadRecord } from '@/types/leads';
import type { InternalPaymentLinkApiPayload, PaymentMode } from '@/types/payments';
import type { PreEventRecord } from '@/types/pre-events';
import type { QuoteRecord } from '@/types/quotes';

export interface PaymentLinkPayloadSource {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  eventDate: string;
  eventStartTime: string;
  eventAddress: string;
  barName: string;
  servings: string;
  totalEventAmount: number;
  expectedDepositAmount: number;
}

interface BuildPayloadContext {
  mode: PaymentMode;
  source: string;
  system: string;
  timezone: string;
  payloadSource: PaymentLinkPayloadSource;
}

interface QuotePayloadContext {
  quote: QuoteRecord;
  lead: LeadRecord;
  client: ClientRecord | null;
  preEvent: PreEventRecord | null;
}

function normalizeMoney(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
}

function toMoneyString(value: number) {
  return value.toFixed(2);
}

function normalizeName(value: string | null | undefined) {
  return String(value ?? '').trim();
}

function cleanPhone(phone: string) {
  return phone.trim();
}

function normalizeTimeValue(value: string | null | undefined) {
  return String(value ?? '').slice(0, 5);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  return /^\+?[0-9()\-\s]{8,20}$/.test(value);
}

function isValidTimeRange(startTime: string) {
  if (!/^\d{2}:\d{2}$/.test(startTime)) return false;
  const [hour, minute] = startTime.split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return false;
  if (minute < 0 || minute > 59) return false;
  return hour >= 9 && (hour < 21 || (hour === 21 && minute === 0));
}

export function validatePaymentLinkPayloadSource(payloadSource: PaymentLinkPayloadSource) {
  const missing: string[] = [];

  if (!payloadSource.customerEmail) missing.push('Email del cliente');
  if (!payloadSource.customerPhone) missing.push('Teléfono del cliente');
  if (!payloadSource.eventDate) missing.push('Fecha confirmada del evento');
  if (!payloadSource.eventStartTime) missing.push('Hora confirmada del evento');
  if (!payloadSource.eventAddress) missing.push('Dirección del evento');
  if (!payloadSource.barName) missing.push('Bar/servicio contratado (barName)');

  const servingsNumber = Number(payloadSource.servings);
  if (!payloadSource.servings || !Number.isFinite(servingsNumber) || servingsNumber <= 0) {
    missing.push('Número de servings/invitados');
  }

  if (payloadSource.totalEventAmount <= 0) missing.push('Monto total del evento válido (> 0)');
  if (payloadSource.expectedDepositAmount <= 0) {
    missing.push('Depósito esperado válido (> 0) en cotización');
  }
  if (payloadSource.expectedDepositAmount > payloadSource.totalEventAmount && payloadSource.totalEventAmount > 0) {
    missing.push('Depósito esperado no puede ser mayor al total del evento');
  }

  if (payloadSource.customerEmail && !isValidEmail(payloadSource.customerEmail)) missing.push('Formato de email válido');
  if (payloadSource.customerPhone && !isValidPhone(cleanPhone(payloadSource.customerPhone))) missing.push('Formato de teléfono válido');
  if (payloadSource.eventStartTime && !isValidTimeRange(payloadSource.eventStartTime)) {
    missing.push('Hora del evento entre 09:00 y 21:00');
  }

  return missing;
}

export function buildPaymentLinkPayload({ mode, source, system, timezone, payloadSource }: BuildPayloadContext): InternalPaymentLinkApiPayload {
  const amountToCharge = mode === 'deposit' ? payloadSource.expectedDepositAmount : payloadSource.totalEventAmount;
  const balanceDue = Math.max(payloadSource.totalEventAmount - amountToCharge, 0);

  return {
    mode,
    currency: 'usd',
    amountToCharge: toMoneyString(amountToCharge),
    totalEventAmount: toMoneyString(payloadSource.totalEventAmount),
    customer: {
      name: payloadSource.customerName,
      email: payloadSource.customerEmail,
      phone: payloadSource.customerPhone,
    },
    event: {
      date: payloadSource.eventDate,
      startTime: payloadSource.eventStartTime,
      address: payloadSource.eventAddress,
      barName: payloadSource.barName,
      servings: payloadSource.servings,
    },
    metadata: {
      source: String(source),
      system: String(system),
      timezone: String(timezone),
      mode: String(mode),
      totalEventAmount: toMoneyString(payloadSource.totalEventAmount),
      amountToCharge: toMoneyString(amountToCharge),
      balanceDue: toMoneyString(balanceDue),
      customerName: payloadSource.customerName,
      customerEmail: payloadSource.customerEmail,
      customerPhone: payloadSource.customerPhone,
      eventDate: payloadSource.eventDate,
      eventStartTime: payloadSource.eventStartTime,
      eventAddress: payloadSource.eventAddress,
      barName: payloadSource.barName,
      servings: payloadSource.servings,
    },
  };
}

export function getPreEventPaymentLinkPayloadSource(preEvent: PreEventRecord, client: ClientRecord, quote: QuoteRecord): PaymentLinkPayloadSource {
  return {
    customerName: normalizeName(client.full_name),
    customerEmail: normalizeName(client.email),
    customerPhone: cleanPhone(normalizeName(client.phone)),
    eventDate: normalizeName(preEvent.confirmed_date),
    eventStartTime: normalizeTimeValue(preEvent.confirmed_time),
    eventAddress: normalizeName(preEvent.location),
    barName: normalizeName(preEvent.booked_service),
    servings: String(preEvent.confirmed_guests ?? ''),
    totalEventAmount: normalizeMoney(quote.total_amount),
    expectedDepositAmount: normalizeMoney(quote.expected_deposit),
  };
}

export function getQuotePaymentLinkPayloadSource({ quote, lead, client, preEvent }: QuotePayloadContext): PaymentLinkPayloadSource {
  const customerName = normalizeName(client?.full_name) || normalizeName(lead.full_name);
  const customerEmail = normalizeName(client?.email) || normalizeName(lead.email);
  const customerPhone = cleanPhone(normalizeName(client?.phone) || normalizeName(lead.phone));

  const eventDate = normalizeName(preEvent?.confirmed_date) || normalizeName(lead.tentative_event_date);
  const eventStartTime = normalizeTimeValue(preEvent?.confirmed_time) || normalizeTimeValue(lead.tentative_event_time);
  const eventAddress = normalizeName(preEvent?.location) || normalizeName(lead.location) || normalizeName(client?.location);
  const barName = normalizeName(preEvent?.booked_service) || normalizeName(lead.service_interest);
  const servings = String(preEvent?.confirmed_guests ?? lead.guest_count ?? '');

  return {
    customerName,
    customerEmail,
    customerPhone,
    eventDate,
    eventStartTime,
    eventAddress,
    barName,
    servings,
    totalEventAmount: normalizeMoney(quote.total_amount),
    expectedDepositAmount: normalizeMoney(quote.expected_deposit),
  };
}

export function getResponsePaymentLinkData(response: Record<string, unknown>) {
  const externalUrl =
    (typeof response.url === 'string' && response.url) ||
    (typeof response.paymentLinkUrl === 'string' && response.paymentLinkUrl) ||
    (typeof response.checkoutUrl === 'string' && response.checkoutUrl) ||
    null;

  const externalId =
    (typeof response.paymentLinkId === 'string' && response.paymentLinkId) ||
    (typeof response.id === 'string' && response.id) ||
    (typeof response.linkId === 'string' && response.linkId) ||
    null;

  return { externalUrl, externalId };
}
