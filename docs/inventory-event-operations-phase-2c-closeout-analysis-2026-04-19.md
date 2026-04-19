# Inventory Event Operations — Phase 2C (Leftover Return / Post-Event Closeout) Analysis

Date: 2026-04-19
Scope: análisis técnico/funcional del repo actual (sin implementación de 2C)

## 1) Estado actual para post-event / leftovers

### Qué sí existe hoy (persistencia parcial)
- En `event_inventory_requirements` ya existen campos para el cierre operativo parcial:
  - `quantity_required`
  - `quantity_counted`
  - `quantity_used`
  - `prep_status`
  - `checked_by` / `checked_at`
  - `prep_notes`
- Existe capa persistente de ejecución 2B para compras/surtido:
  - `shopping_status` (`pending|bought`)
  - `picking_status` (`pending|pulled`)
  - actor + timestamp por track

### Qué NO existe hoy (gap real)
No existe entidad persistente explícita para:
- `leftover_quantity` (sobrante)
- `returned_to_stock_quantity` (devolución efectiva a inventario)
- `waste_quantity` / merma
- `closeout_status` de requirement post-event
- `closed_by` / `closed_at` del requirement
- revisión/aprobación de cierre por supervisor

## 2) Qué ya existe hoy que se puede reutilizar

1. **Requirement base**: `event_inventory_requirements` sigue siendo buen ancla por requirement.
2. **Track execution pre-event**: tabla `event_inventory_execution_state` ya modela progreso sin contaminar requirement base.
3. **UI operativa**: `EventInventorySection` ya tiene módulos Supervisor/Team Leader y acciones server para mutar estado.
4. **Checklist persistente**: `event_checklist_items` existe y puede alojar checks post-event mínimos sin duplicar flujo.
5. **Estados de evento**: transición `en_preparacion -> completado` ya existe, pero hoy no exige closeout de inventario.

## 3) Qué faltaría para Leftover Return / Closeout real

Para cerrar el evento de forma auditable por requirement, falta persistir al menos:
- `leftover_quantity`
- `returned_quantity`
- `waste_quantity`
- `closeout_notes`
- `closed_by`, `closed_at`
- `closeout_status` (ej. `pending|submitted|approved`)
- opcional para supervisor: `approved_by`, `approved_at`

Y reglas de consistencia mínimas:
- `quantity_used + leftover_quantity = quantity_counted` (cuando `quantity_counted` existe)
- `returned_quantity + waste_quantity = leftover_quantity`
- no permitir negativos

## 4) Cómo hacerlo sin romper `event_inventory_requirements`

Principio recomendado para 2C:
- `event_inventory_requirements` sigue representando la base del material del evento.
- `quantity_used` permanece como dato operativo principal de consumo real.
- El closeout post-event vive **encima** como capa de reconciliación, no como reemplazo del requirement.

Esto evita:
- duplicar requirements,
- mezclar semántica de planeación/prep con reconciliación post-event,
- romper la UX/acciones existentes de Supervisor Prep + Team Leader.

## 5) Campos nuevos vs tabla ligera adicional (evaluación)

### Opción A — Agregar campos directos a `event_inventory_requirements`
**Pros**: simple, menos joins.  
**Contras**: la tabla requirement quedaría sobrecargada (prep + execution + closeout + revisión).

### Opción B — Extender `event_inventory_execution_state`
**Pros**: una sola tabla satélite.  
**Contras**: mezcla semántica pre-event (shopping/picking) con post-event (leftover/return/waste), reduciendo claridad.

### Opción C — Nueva tabla ligera de closeout 1:1 por requirement (recomendada)
Propuesta:
- `event_inventory_closeout_state`
  - `event_inventory_requirement_id` (unique FK)
  - `leftover_quantity`
  - `returned_quantity`
  - `waste_quantity`
  - `closeout_status` (`pending|submitted|approved`)
  - `closed_by`, `closed_at`
  - `approved_by`, `approved_at` (opcional supervisor)
  - `note`
  - `created_at`, `updated_at`

**Recomendación**: Opción C, por separación limpia de etapas y menor riesgo de romper contratos actuales.

## 6) Team Leader vs Supervisor (sin rediseño de roles)

### Team Leader (captura de retorno post-event)
Debe registrar por requirement:
- `quantity_used` (si faltaba)
- `leftover_quantity`
- distribución de sobrante entre `returned_quantity` y `waste_quantity`
- nota corta de incidencias
- enviar a `submitted`

### Supervisor (revisión/cierre)
Debe revisar:
- coherencia de cantidades
- desviaciones relevantes
- aprobar (`approved`) o devolver a ajuste
- confirmar cierre operativo de materiales antes de mover evento a cierre final administrativo

### Owner (visibilidad)
Read-only de:
- resumen de consumos/retornos/mermas
- quién cerró y quién aprobó
- trazabilidad post-event

## 7) Módulos delicados y contratos a respetar

### Módulos que tocaría 2C
- `components/inventory/event-inventory-section.tsx` (nuevos módulos post-event)
- `services/inventory/actions.ts` (acciones de closeout)
- `services/inventory/queries.ts` (join de closeout state)
- `services/events/actions.ts` (`updateEventStatusAction` con guardas opcionales)
- `services/events/queries.ts` (resumen/actores de closeout)
- nueva migración SQL + RLS

### Contratos que no conviene romper
1. `inventory_items` como fuente madre global.
2. `event_inventory_requirements` como requirement base del evento.
3. tabla 2B (`event_inventory_execution_state`) para shopping/picking.
4. checklist persistente existente (`event_checklist_items`) sin duplicación.
5. bar master templates y siembra de requirements.
6. permisos actuales (`inventory.view`, `inventory.prepare`, `inventory.manage`).

## 8) Riesgos técnicos principales
- Ajustar `current_stock` sin un ledger de movimientos puede generar inconsistencias históricas.
- Si no hay validaciones de ecuación de cantidades, habrá cierres incoherentes.
- Mezclar post-event con prep en una misma UI sin separación visual puede confundir operación.

## 9) Recomendación estructural para la iteración 2C

Implementar una capa de closeout ligera y secuencial:
1. Captura Team Leader (submitted)
2. Revisión/Aprobación Supervisor (approved)
3. Resumen consolidado visible en EventInventorySection y para Owner

Sin implementar todavía:
- motor completo de movimientos de inventario,
- packed/verified enterprise workflow,
- devolución automática a `current_stock` sin regla de ajuste controlado.

## 10) Archivos revisados
- `types/inventory.ts`
- `services/inventory/actions.ts`
- `services/inventory/queries.ts`
- `components/inventory/event-inventory-section.tsx`
- `services/events/actions.ts`
- `services/events/queries.ts`
- `components/events/event-detail.tsx`
- `app/(app)/eventos/[eventId]/page.tsx`
- `supabase/migrations/20260323000002_inventory_materials.sql`
- `supabase/migrations/20260401000002_inventory_event_prep_hardening.sql`
- `supabase/migrations/20260419000001_inventory_execution_state.sql`
- `supabase/migrations/20260322000001_event_operations_core.sql`
- `config/events.ts`

## 11) Estado de cambios
- No se implementó funcionalidad de 2C.
- Solo se agregó este documento de análisis técnico/funcional.

## 12) Commit
- Ver historial git del branch para commit de este análisis.
