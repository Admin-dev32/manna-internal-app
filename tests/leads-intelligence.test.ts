import test from 'node:test';
import assert from 'node:assert/strict';

import { leadAutomationRules } from '../config/leads-intelligence.ts';
import { getAutomationPayloadForLead, getLeadIntelligence } from '../lib/leads/intelligence.ts';
import type { LeadRecord } from '../types/leads.ts';

const NOW_ISO = '2026-04-24T12:00:00.000Z';
const NOW_MS = new Date(NOW_ISO).getTime();

function createLead(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: 'lead-1',
    full_name: 'Lead Test',
    phone: null,
    email: null,
    language: 'es',
    source_platform: 'web',
    status: 'nuevo',
    priority: 'media',
    event_type: null,
    tentative_event_date: null,
    tentative_event_time: null,
    location: null,
    guest_count: null,
    service_interest: null,
    service_interests: null,
    quoted_total: null,
    promotion_offered: null,
    next_action: 'Llamar',
    follow_up_at: null,
    responsible_profile_id: null,
    internal_notes: null,
    last_interaction_at: '2026-04-20T12:00:00.000Z',
    created_by: 'tester',
    updated_by: 'tester',
    created_at: '2026-04-01T10:00:00.000Z',
    updated_at: '2026-04-22T10:00:00.000Z',
    ...overrides,
  };
}

test('lead nuevo sin follow-up', () => {
  const lead = createLead({ status: 'nuevo', follow_up_at: null });
  const intelligence = getLeadIntelligence(lead, { now: NOW_MS });

  assert.equal(intelligence.needsFollowUpScheduling, true);
  assert.equal(intelligence.followUpTone.label, 'Sin seguimiento');
  assert.equal(intelligence.actionSuggestion.id, 'schedule-follow-up');
});

test('follow-up vencido', () => {
  const lead = createLead({ follow_up_at: '2026-04-23T09:00:00.000Z' });
  const intelligence = getLeadIntelligence(lead, { now: NOW_MS });

  assert.equal(intelligence.isFollowUpOverdue, true);
  assert.equal(intelligence.followUpTone.label, 'Vencido');
  assert.equal(intelligence.urgencyLevel, 'critical');
});

test('lead cerrado', () => {
  const lead = createLead({ status: 'ganado', follow_up_at: null });
  const intelligence = getLeadIntelligence(lead, { now: NOW_MS });

  assert.equal(intelligence.isClosed, true);
  assert.equal(intelligence.urgencyLevel, 'low');
  assert.equal(intelligence.actionSuggestion.id, 'closed-traceability');
});

test('prioridad alta y crítica', () => {
  const highLead = createLead({ priority: 'alta', follow_up_at: '2026-04-30T12:00:00.000Z', last_interaction_at: NOW_ISO });
  const criticalLead = createLead({ priority: 'urgente', follow_up_at: '2026-04-30T12:00:00.000Z', last_interaction_at: NOW_ISO });

  const highIntelligence = getLeadIntelligence(highLead, { now: NOW_MS });
  const criticalIntelligence = getLeadIntelligence(criticalLead, { now: NOW_MS });

  assert.equal(highIntelligence.urgencyLevel, 'high');
  assert.equal(criticalIntelligence.urgencyLevel, 'critical');
});

test('automation payload esperado', () => {
  const lead = createLead({ status: 'nuevo', follow_up_at: '2026-04-23T09:00:00.000Z' });
  const intelligence = getLeadIntelligence(lead, { now: NOW_MS });
  const enabledRules = Object.fromEntries(leadAutomationRules.map((rule) => [rule.id, true])) as Record<string, boolean>;

  const payload = getAutomationPayloadForLead({
    lead,
    intelligence,
    rules: leadAutomationRules,
    enabledRules,
    followUpAt: '2026-04-25T12:00:00.000Z',
  });

  assert.deepEqual(payload, { status: 'seguimiento' });
});
