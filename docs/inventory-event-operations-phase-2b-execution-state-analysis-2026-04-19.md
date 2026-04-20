# Inventory Event Operations — Phase 2B (Execution State) Analysis

Date: 2026-04-19
Scope: análisis técnico/funcional del repo actual (sin implementación de Phase 2B)

## 1) Estado operativo que ya existe hoy

### Inventario por evento (persistente)
En `event_inventory_requirements` ya existe estado operativo persistente para preparación de material:
- `prep_status` (`pendiente | contado | faltante | listo`)
- `quantity_counted`
- `quantity_used`
- `checked_by`
- `checked_at`
- `updated_by`
- `prep_notes`

Además, en acciones de inventario el estado se normaliza/deriva en cada update para mantener consistencia entre `required` y `counted`.

### Checklist persistente por evento
En `event_checklist_items` ya existe:
- `is_completed`
- `completed_at`
- `updated_by`
- `updated_at`

Y la acción `toggleEventChecklistItemAction` persiste responsable/fecha al marcar o reabrir.

### Lo que NO existe aún como estado persistente explícito
No existe un estado de ejecución separado para:
- shopping item `pending/bought`
- stock item `pending/pulled`
- empaquetado/verificado por línea de inventario

Hoy eso se infiere indirectamente de `prep_status`, `quantity_counted`, `quantity_used`, y notas.

## 2) Qué faltaría para persistir progreso real (2B)

Para cubrir Phase 2B sin romper contratos, faltaría persistir explícitamente **dos tracks de ejecución** por requirement:

1. **Track compras** (derivado de shopping list)
   - estado mínimo: `pending | bought`
   - actor y timestamp de cambio
2. **Track surtido de bodega** (derivado de picking list)
   - estado mínimo: `pending | pulled`
   - actor y timestamp de cambio

Checklist general ya tiene persistencia suficiente (`is_completed/completed_at/updated_by`), por lo que no necesita rediseño para 2B.

## 3) Cómo hacerlo sin romper `event_inventory_requirements`

Principio clave: **`event_inventory_requirements` sigue siendo la fuente madre operativa del evento** (qué se requiere y cuánto).

La capa de ejecución 2B debería ir “encima” como metadatos de progreso, sin reemplazar:
- `quantity_required`
- `quantity_counted`
- `quantity_used`
- `prep_status`

Es decir, compras/surtido deben representar “avance de ejecución” y no redefinir requirement base.

## 4) SQL: opciones para 2B

### Opción A — Solo campos nuevos en `event_inventory_requirements`
Agregar campos de ejecución en la misma tabla (ej. `shopping_state`, `shopping_updated_by`, `shopping_updated_at`, `pull_state`, `pull_updated_by`, `pull_updated_at`).

**Pros**
- Menos joins y menos complejidad inmediata.
- Encaja con el flujo actual de edición de requirements.

**Contras**
- Mezcla semántica de “definición del requirement” con “historial/ejecución”.
- Escala peor si luego se necesita trazabilidad más fina por múltiples cambios.

### Opción B — Tabla ligera nueva de estado de ejecución (recomendada)
Crear tabla nueva 1:1 por requirement para ejecución, por ejemplo:
- `event_inventory_execution_state`
  - `event_inventory_requirement_id` (unique)
  - `shopping_state`
  - `shopping_updated_by`, `shopping_updated_at`
  - `pull_state`
  - `pull_updated_by`, `pull_updated_at`
  - `pack_state`/`verified_state` opcionales para fase posterior

**Pros**
- Mantiene limpio el contrato de `event_inventory_requirements`.
- Permite crecer ejecución sin contaminar campos base.
- Reduce riesgo de romper lógica actual de prep/status.

**Contras**
- Requiere SQL adicional y joins en queries.

### Opción C — Híbrida
Campos mínimos en requirement + tabla de log/auditoría de transiciones.

**Pros**
- Lectura rápida + trazabilidad completa.

**Contras**
- Más compleja que B para esta fase.

### Recomendación
Para 2B: **Opción B (tabla ligera adicional 1:1)**. Es la forma más sana para no romper arquitectura ni confundir fuente de verdad.

## 5) Supervisor vs Team Leader (sin rediseño de roles)

### Supervisor (mutación principal)
Debe poder marcar/ajustar:
- `shopping_state` (pending/bought)
- `pull_state` (pending/pulled)
- cierre de preparación global (apoyado en `prep_status` existente)

### Team Leader (ejecución operativa guiada)
Debe poder marcar:
- avances de surtido/pull durante setup
- checklist operativa (`event_checklist_items`) que ya existe

### Lectura vs mutación recomendada (sin tocar roles destructivamente)
- Mantener permisos actuales de inventario para mutaciones de capa execution (reusar `inventory.prepare|inventory.manage`).
- Mantener visibilidad con `inventory.view` para seguimiento.
- Evitar introducir nuevos permisos en 2B salvo necesidad real.

## 6) Riesgos y contratos delicados

### Contratos que no conviene romper
1. `inventory_items` como fuente de verdad global de stock/ubicación.
2. `event_inventory_requirements` como requirement base por evento.
3. Derivación de shopping/picking desde requirement + disponibilidad.
4. `prep_status` y su lógica de consistencia en server actions.
5. Compatibilidad con bar master templates que siembran requirements.
6. Checklist existente (`event_checklist_items`) como track de tareas operativas.

### Módulos delicados para una futura implementación 2B
- `services/inventory/actions.ts` (derivación de prep y permisos)
- `services/inventory/queries.ts` (join con posible tabla execution)
- `components/inventory/event-inventory-section.tsx` (Supervisor/Team Leader UX actual)
- `services/events/actions.ts` (`toggleEventChecklistItemAction`)
- `services/events/queries.ts` (armado de data para detalle de evento)
- migraciones RLS/permisos de inventario

### Riesgos técnicos
- Duplicar semántica entre `prep_status` y nuevos estados execution.
- Permitir estados incongruentes (ej. `bought` cuando no hay faltante) sin reglas de validación.
- Aumentar complejidad de UI si no se define una jerarquía clara de estados.

## 7) Archivos revisados
- `components/inventory/event-inventory-section.tsx`
- `components/events/event-detail.tsx`
- `services/inventory/actions.ts`
- `services/inventory/queries.ts`
- `services/events/actions.ts`
- `services/events/queries.ts`
- `types/inventory.ts`
- `types/events.ts`
- `supabase/migrations/20260322000001_event_operations_core.sql`
- `supabase/migrations/20260323000002_inventory_materials.sql`
- `supabase/migrations/20260401000002_inventory_event_prep_hardening.sql`
- `services/bar-master-templates/actions.ts`
- `services/operational-templates/actions.ts`

## 8) Cambios realizados
- No se implementó funcionalidad de 2B.
- Se agregó únicamente este documento de análisis técnico/funcional.

## 9) Commit
- Ver historial git del branch para el commit asociado a este análisis.
