import type { LeadRecord } from '@/types/leads';
import type { LeadAutomationRule } from '@/config/leads-intelligence';

export type LeadUrgencyLevel = 'critical' | 'high' | 'medium' | 'low';

export interface LeadActionSuggestion {
  id: string;
  title: string;
  description: string;
  reasons: string[];
  urgency: LeadUrgencyLevel;
  suggestedStatus?: LeadRecord['status'];
}

export interface LeadScoreBreakdown {
  score: number;
  factors: string[];
}

export interface LeadUrgencyBadgeMeta {
  label: string;
  variant: 'warning' | 'secondary' | 'outline';
  className?: string;
}

export interface LeadToneMeta {
  label: string;
  variant: 'default' | 'secondary' | 'outline' | 'success' | 'warning';
  className?: string;
}

export interface LeadAutomationPayload {
  status?: LeadRecord['status'];
  followUpAt?: string;
}

export interface LeadIntelligence {
  urgencyLevel: LeadUrgencyLevel;
  urgencyBadge: LeadUrgencyBadgeMeta;
  actionSuggestion: LeadActionSuggestion;
  scoreBreakdown: LeadScoreBreakdown;
  followUpTone: LeadToneMeta;
  tentativeDateTone: LeadToneMeta | null;
  signals: LeadToneMeta[];
  isClosed: boolean;
  needsFollowUpScheduling: boolean;
  isFollowUpOverdue: boolean;
}

export interface LeadIntelligenceOptions {
  now?: number | Date;
}

const DAY_MS = 1000 * 60 * 60 * 24;

function toNowMs(now?: number | Date) {
  if (typeof now === 'number') return now;
  if (now instanceof Date) return now.getTime();
  return Date.now();
}

function getDaysSince(date: string, nowMs: number) {
  return Math.floor((nowMs - new Date(date).getTime()) / DAY_MS);
}

function isLeadClosed(lead: LeadRecord) {
  return lead.status === 'ganado' || lead.status === 'perdido';
}

function needsFollowUpScheduling(lead: LeadRecord) {
  return !lead.follow_up_at && !isLeadClosed(lead);
}

function isFollowUpOverdue(lead: LeadRecord, nowMs: number) {
  return Boolean(lead.follow_up_at && new Date(lead.follow_up_at).getTime() < nowMs);
}

export function getNextFollowUpIsoDate(daysAhead = 1) {
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + daysAhead);
  return nextDate.toISOString();
}

function getLeadUrgencyLevel(lead: LeadRecord, nowMs: number): LeadUrgencyLevel {
  if (lead.status === 'ganado' || lead.status === 'perdido') return 'low';
  if (lead.priority === 'urgente') return 'critical';
  if (lead.follow_up_at && new Date(lead.follow_up_at).getTime() < nowMs) return 'critical';
  if (!lead.follow_up_at && getDaysSince(lead.last_interaction_at, nowMs) >= 3) return 'high';
  if (lead.priority === 'alta') return 'high';
  if (lead.follow_up_at && new Date(lead.follow_up_at).getTime() - nowMs <= DAY_MS) return 'medium';
  return 'low';
}

function getLeadScoreBreakdown(lead: LeadRecord, nowMs: number): LeadScoreBreakdown {
  let score = 50;
  const factors: string[] = [];
  const daysSinceLastInteraction = getDaysSince(lead.last_interaction_at, nowMs);

  if (lead.status === 'calificado') {
    score += 18;
    factors.push('Lead calificado (+18)');
  }
  if (lead.status === 'seguimiento' || lead.status === 'contactado') {
    score += 10;
    factors.push('Lead en proceso activo (+10)');
  }
  if (lead.status === 'ganado') {
    score = 100;
    factors.push('Lead ganado (100)');
  }
  if (lead.status === 'perdido') {
    score = 5;
    factors.push('Lead perdido (5)');
  }

  if (lead.priority === 'urgente') {
    score += 15;
    factors.push('Prioridad urgente (+15)');
  } else if (lead.priority === 'alta') {
    score += 10;
    factors.push('Prioridad alta (+10)');
  }

  if (!lead.follow_up_at) {
    score -= 12;
    factors.push('Sin seguimiento agendado (-12)');
  } else if (new Date(lead.follow_up_at).getTime() < nowMs) {
    score -= 18;
    factors.push('Seguimiento vencido (-18)');
  } else {
    score += 6;
    factors.push('Seguimiento programado (+6)');
  }

  if (daysSinceLastInteraction >= 7) {
    score -= 12;
    factors.push('Sin interacción en 7+ días (-12)');
  } else if (daysSinceLastInteraction <= 1) {
    score += 8;
    factors.push('Interacción reciente (+8)');
  }

  if (lead.quoted_total && Number(lead.quoted_total) > 0) {
    score += 6;
    factors.push('Monto cotizado disponible (+6)');
  }

  score = Math.max(0, Math.min(100, score));
  return { score, factors };
}

function getLeadActionSuggestion(lead: LeadRecord, nowMs: number): LeadActionSuggestion {
  const urgency = getLeadUrgencyLevel(lead, nowMs);

  if (lead.status === 'ganado' || lead.status === 'perdido') {
    return {
      id: 'closed-traceability',
      title: 'Lead cerrado',
      description: 'Solo requiere seguimiento administrativo o trazabilidad.',
      reasons: ['Estatus final alcanzado', 'No requiere empuje comercial activo'],
      urgency: 'low',
    };
  }

  if (!lead.follow_up_at) {
    return {
      id: 'schedule-follow-up',
      title: 'Programar seguimiento',
      description: 'No hay fecha de seguimiento. Agenda una para no perder oportunidad.',
      reasons: ['No existe fecha de seguimiento', 'El lead sigue abierto en pipeline'],
      urgency: urgency === 'critical' ? 'critical' : 'high',
      suggestedStatus: 'seguimiento',
    };
  }

  if (new Date(lead.follow_up_at).getTime() < nowMs) {
    return {
      id: 'follow-up-overdue',
      title: 'Seguimiento vencido',
      description: 'Contacta hoy y actualiza próxima acción para recuperar momentum.',
      reasons: ['La fecha de seguimiento ya expiró', 'Riesgo alto de enfriamiento comercial'],
      urgency: 'critical',
      suggestedStatus: 'seguimiento',
    };
  }

  if (lead.status === 'calificado') {
    return {
      id: 'push-to-quote',
      title: 'Empujar a cotización',
      description: 'Lead calificado. Siguiente paso sugerido: preparar cotización.',
      reasons: ['Lead ya calificado', 'Señal de avance comercial lista para propuesta'],
      urgency,
    };
  }

  return {
    id: 'maintain-cadence',
    title: 'Mantener cadencia',
    description: 'Confirma avance y ajusta próxima acción para conservar ritmo comercial.',
    reasons: ['Lead abierto en etapa activa', 'Se requiere continuidad de seguimiento'],
    urgency,
    suggestedStatus: lead.status === 'nuevo' ? 'contactado' : undefined,
  };
}

function getLeadUrgencyBadgeMeta(lead: LeadRecord, nowMs: number): LeadUrgencyBadgeMeta {
  const urgency = getLeadUrgencyLevel(lead, nowMs);
  if (urgency === 'critical') return { label: 'Prioridad crítica', variant: 'warning', className: 'bg-rose-100 text-rose-700' };
  if (urgency === 'high') return { label: 'Alta prioridad', variant: 'warning' };
  if (urgency === 'medium') return { label: 'Prioridad media', variant: 'secondary' };
  return { label: 'Baja urgencia', variant: 'outline' };
}

function getFollowUpTone(lead: LeadRecord, nowMs: number): LeadToneMeta {
  if (!lead.follow_up_at) return { label: 'Sin seguimiento', variant: 'outline' };

  const diff = new Date(lead.follow_up_at).getTime() - nowMs;
  if (diff < 0) return { label: 'Vencido', variant: 'warning' };
  if (diff <= DAY_MS) return { label: 'Hoy', variant: 'warning' };
  if (diff <= DAY_MS * 3) return { label: 'Próximo', variant: 'secondary' };
  return { label: 'Programado', variant: 'outline' };
}

function getTentativeDateTone(lead: LeadRecord, nowMs: number): LeadToneMeta | null {
  if (!lead.tentative_event_date) return null;

  const eventDate = new Date(lead.tentative_event_date);
  if (Number.isNaN(eventDate.getTime())) return null;

  const diff = eventDate.getTime() - nowMs;
  if (diff < 0) return null;
  if (diff <= DAY_MS * 7) return { label: 'Evento cercano', variant: 'secondary' };
  return null;
}

function getLeadSignals(lead: LeadRecord, followUpTone: LeadToneMeta, noFollowUp: boolean, tentativeDateTone: LeadToneMeta | null): LeadToneMeta[] {
  const signals: LeadToneMeta[] = [];

  if (lead.priority === 'urgente') {
    signals.push({ label: 'Urgente', variant: 'warning', className: 'bg-rose-100 text-rose-700' });
  }

  if (followUpTone.label === 'Vencido') {
    signals.push({ label: 'Seguimiento vencido', variant: 'warning' });
  } else if (followUpTone.label === 'Hoy') {
    signals.push({ label: 'Seguimiento hoy', variant: 'warning' });
  } else if (noFollowUp) {
    signals.push({ label: 'Sin seguimiento', variant: 'outline' });
  }

  if (tentativeDateTone) {
    signals.push({ label: tentativeDateTone.label, variant: tentativeDateTone.variant });
  }

  return signals;
}

export function getLeadIntelligence(lead: LeadRecord, options: LeadIntelligenceOptions = {}): LeadIntelligence {
  const nowMs = toNowMs(options.now);
  const isClosed = isLeadClosed(lead);
  const noFollowUp = needsFollowUpScheduling(lead);
  const overdueFollowUp = isFollowUpOverdue(lead, nowMs);
  const urgencyLevel = getLeadUrgencyLevel(lead, nowMs);
  const urgencyBadge = getLeadUrgencyBadgeMeta(lead, nowMs);
  const actionSuggestion = getLeadActionSuggestion(lead, nowMs);
  const scoreBreakdown = getLeadScoreBreakdown(lead, nowMs);
  const followUpTone = getFollowUpTone(lead, nowMs);
  const tentativeDateTone = getTentativeDateTone(lead, nowMs);
  const signals = getLeadSignals(lead, followUpTone, noFollowUp, tentativeDateTone);

  return {
    urgencyLevel,
    urgencyBadge,
    actionSuggestion,
    scoreBreakdown,
    followUpTone,
    tentativeDateTone,
    signals,
    isClosed,
    needsFollowUpScheduling: noFollowUp,
    isFollowUpOverdue: overdueFollowUp,
  };
}

export function getAutomationPayloadForLead({
  lead,
  intelligence,
  rules,
  enabledRules,
  followUpAt,
}: {
  lead: LeadRecord;
  intelligence: LeadIntelligence;
  rules: LeadAutomationRule[];
  enabledRules: Record<string, boolean>;
  followUpAt: string;
}): LeadAutomationPayload {
  const payload: LeadAutomationPayload = {};

  for (const rule of rules) {
    if (!enabledRules[rule.id]) continue;
    const triggerMatches =
      (rule.trigger === 'no_follow_up' && intelligence.needsFollowUpScheduling) ||
      (rule.trigger === 'overdue_follow_up' && intelligence.isFollowUpOverdue);
    if (!triggerMatches) continue;

    if (rule.action === 'schedule_follow_up') payload.followUpAt = followUpAt;
    if (rule.action === 'set_status_seguimiento' && lead.status === 'nuevo') payload.status = 'seguimiento';
  }

  return payload;
}
