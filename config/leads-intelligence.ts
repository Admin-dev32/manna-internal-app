export interface LeadAutomationRule {
  id: string;
  label: string;
  description: string;
  trigger: 'no_follow_up' | 'overdue_follow_up';
  action: 'schedule_follow_up' | 'set_status_seguimiento';
  enabledByDefault: boolean;
}

export const LEADS_INTELLIGENCE_STORAGE_KEYS = {
  viewState: 'manna.leads.view.state.v1',
  filtersCollapsed: 'manna.leads.filters.collapsed',
  suggestionFeedback: 'manna.leads.suggestion.feedback.v1',
  automationPrefs: 'manna.leads.automation.prefs.v1',
  formSmartDefaults: 'manna.leads.form.smart-defaults',
} as const;

export const leadAutomationRules: LeadAutomationRule[] = [
  {
    id: 'auto-schedule-followup',
    label: 'Auto-agendar seguimiento',
    description: 'Si el lead está abierto sin fecha de seguimiento, agenda para mañana.',
    trigger: 'no_follow_up',
    action: 'schedule_follow_up',
    enabledByDefault: true,
  },
  {
    id: 'auto-status-followup',
    label: 'Mover a seguimiento',
    description: 'Si un lead nuevo tiene seguimiento vencido/sin fecha, mover a seguimiento.',
    trigger: 'overdue_follow_up',
    action: 'set_status_seguimiento',
    enabledByDefault: true,
  },
];
