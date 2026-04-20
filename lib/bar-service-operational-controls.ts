import type { EventChecklistProgress } from '@/types/events';
import type {
  BarMasterTemplateApplicationRecord,
  BarMasterTemplateRecord,
  EventInventoryExecutionStateRecord,
  EventInventoryRequirementRecord,
  InventoryAvailabilitySummary,
} from '@/types/inventory';

export type BarOperationalReadiness = 'incompleta' | 'en_riesgo' | 'lista_para_ejecucion';

export interface BarOperationalControlSnapshot {
  readiness: BarOperationalReadiness;
  readinessLabel: string;
  missingGuides: string[];
  omittedItemsCount: number;
  shortageCount: number;
  shoppingPendingCount: number;
  pickingPendingCount: number;
  checklistPendingCount: number;
  linkedRequirementsCount: number;
  checks: Array<{
    key: string;
    label: string;
    status: 'ok' | 'warning' | 'risk';
    detail: string;
  }>;
}

function toSafeNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildBarOperationalControls(params: {
  selectedTemplate: BarMasterTemplateRecord | null;
  latestApplication: BarMasterTemplateApplicationRecord | null;
  requirements: EventInventoryRequirementRecord[];
  availabilityByItem: Record<string, InventoryAvailabilitySummary>;
  executionStateByRequirement: Record<string, EventInventoryExecutionStateRecord>;
  checklistProgress: EventChecklistProgress;
}): BarOperationalControlSnapshot | null {
  const { selectedTemplate, latestApplication, requirements, availabilityByItem, executionStateByRequirement, checklistProgress } = params;
  if (!selectedTemplate) return null;

  const linkedRequirements = requirements.filter((requirement) => requirement.source_template_id === selectedTemplate.id);
  const linkedRequirementsCount = linkedRequirements.length;
  const resultSummary = latestApplication?.result_summary ?? {};
  const omittedItemsCount = toSafeNumber(resultSummary.skipped_without_inventory_link);

  const missingGuides = [
    !selectedTemplate.prep_guide?.trim() ? 'Falta prep guide' : null,
    !selectedTemplate.execution_guide?.trim() ? 'Falta execution guide' : null,
    !selectedTemplate.checklist_guidance?.trim() ? 'Falta checklist guidance' : null,
  ].filter((value): value is string => Boolean(value));

  let shortageCount = 0;
  let shoppingPendingCount = 0;
  let pickingPendingCount = 0;

  for (const requirement of linkedRequirements) {
    const required = toSafeNumber(requirement.quantity_required);
    const available = toSafeNumber(availabilityByItem[requirement.inventory_item_id]?.availableStock);
    const quantityToBuy = Math.max(required - available, 0);
    const quantityToPull = Math.max(Math.min(required, available), 0);
    const execution = executionStateByRequirement[requirement.id];

    if (available < required) shortageCount += 1;
    if (quantityToBuy > 0 && execution?.shopping_status !== 'bought') shoppingPendingCount += 1;
    if (quantityToPull > 0 && execution?.picking_status !== 'pulled') pickingPendingCount += 1;
  }

  const checklistPendingCount = checklistProgress.pending;

  const hasRisk = omittedItemsCount > 0 || shortageCount > 0;
  const hasPending = linkedRequirementsCount === 0 || shoppingPendingCount > 0 || pickingPendingCount > 0 || missingGuides.length > 0 || checklistPendingCount > 0;
  const readiness: BarOperationalReadiness = hasRisk ? 'en_riesgo' : hasPending ? 'incompleta' : 'lista_para_ejecucion';
  const readinessLabel =
    readiness === 'lista_para_ejecucion'
      ? 'Lista para ejecución'
      : readiness === 'en_riesgo'
        ? 'En riesgo'
        : 'Incompleta';

  return {
    readiness,
    readinessLabel,
    missingGuides,
    omittedItemsCount,
    shortageCount,
    shoppingPendingCount,
    pickingPendingCount,
    checklistPendingCount,
    linkedRequirementsCount,
    checks: [
      {
        key: 'omitted',
        label: 'Ítems omitidos por vínculo inventario',
        status: omittedItemsCount > 0 ? 'risk' : 'ok',
        detail: omittedItemsCount > 0 ? `${omittedItemsCount} omitido(s)` : 'Sin omitidos',
      },
      {
        key: 'shortage',
        label: 'Requirements con faltante de stock',
        status: shortageCount > 0 ? 'risk' : 'ok',
        detail: shortageCount > 0 ? `${shortageCount} con faltante` : 'Stock suficiente',
      },
      {
        key: 'shopping',
        label: 'Compras pendientes',
        status: shoppingPendingCount > 0 ? 'warning' : 'ok',
        detail: shoppingPendingCount > 0 ? `${shoppingPendingCount} pendiente(s)` : 'Compras cubiertas',
      },
      {
        key: 'picking',
        label: 'Surtido pendiente',
        status: pickingPendingCount > 0 ? 'warning' : 'ok',
        detail: pickingPendingCount > 0 ? `${pickingPendingCount} pendiente(s)` : 'Surtido cubierto',
      },
      {
        key: 'guides',
        label: 'Guías operativas',
        status: missingGuides.length > 0 ? 'warning' : 'ok',
        detail: missingGuides.length > 0 ? missingGuides.join(' · ') : 'Guías completas',
      },
      {
        key: 'checklist',
        label: 'Checklist operativo',
        status: checklistPendingCount > 0 ? 'warning' : 'ok',
        detail: checklistPendingCount > 0 ? `${checklistPendingCount} pendiente(s)` : 'Checklist al día',
      },
    ],
  };
}

export function buildBarOperationalHandoffSummary(params: {
  templateName: string;
  controls: BarOperationalControlSnapshot | null;
  approvalStatus?: 'not_approved' | 'approved' | null;
  approvedAt?: string | null;
}) {
  const { templateName, controls, approvalStatus, approvedAt } = params;
  if (!controls) return `Barra/servicio: ${templateName}\nSin snapshot operativo disponible todavía.`;

  return [
    `Barra/servicio aprobado: ${templateName}`,
    `Aprobación operativa: ${approvalStatus === 'approved' ? `Aprobada${approvedAt ? ` (${new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(approvedAt))})` : ''}` : 'No aprobada'}`,
    `Readiness: ${controls.readinessLabel}`,
    `Riesgos visibles: omitidos ${controls.omittedItemsCount}, faltantes stock ${controls.shortageCount}`,
    `Pendientes: compras ${controls.shoppingPendingCount}, surtido ${controls.pickingPendingCount}, checklist ${controls.checklistPendingCount}`,
    `Requirements ligados desde barra: ${controls.linkedRequirementsCount}`,
  ].join('\n');
}

export function buildMultiBarOperationalHandoffSummary(params: {
  bars: Array<{
    templateName: string;
    approvalStatus: 'not_approved' | 'approved';
    readinessLabel: string;
    checks: Array<{ status: 'ok' | 'warning' | 'risk' }>;
    summary?: {
      skippedCount?: number;
      scaledItemsCount?: number;
      insertedCount?: number;
      updatedCount?: number;
    };
  }>;
}) {
  const { bars } = params;
  const aggregate = {
    total: bars.length,
    approved: bars.filter((bar) => bar.approvalStatus === 'approved').length,
    risk: bars.filter((bar) => bar.checks.some((check) => check.status === 'risk')).length,
    incomplete: bars.filter((bar) => bar.readinessLabel.toLowerCase().includes('incompleta')).length,
    ready: bars.filter((bar) => bar.readinessLabel.toLowerCase().includes('lista')).length,
  };

  const lines = bars.map((bar) => {
    const riskCount = bar.checks.filter((check) => check.status === 'risk').length;
    const warningCount = bar.checks.filter((check) => check.status === 'warning').length;
    return [
      `${bar.templateName}`,
      `aprobación=${bar.approvalStatus === 'approved' ? 'aprobada' : 'no aprobada'}`,
      `readiness=${bar.readinessLabel}`,
      `riesgos=${riskCount}`,
      `pendientes=${warningCount}`,
      `omitidos=${Number(bar.summary?.skippedCount ?? 0)}`,
      `escalados=${Number(bar.summary?.scaledItemsCount ?? 0)}`,
      `insertados=${Number(bar.summary?.insertedCount ?? 0)}`,
      `consolidados=${Number(bar.summary?.updatedCount ?? 0)}`,
    ].join(' · ');
  });

  const text = [
    `Resumen multi-bar: total=${aggregate.total}, aprobadas=${aggregate.approved}, listas=${aggregate.ready}, en_riesgo=${aggregate.risk}, incompletas=${aggregate.incomplete}`,
    ...lines.map((line, index) => `${index + 1}. ${line}`),
  ].join('\n');

  return {
    aggregate,
    lines,
    text,
  };
}
