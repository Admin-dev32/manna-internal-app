# Inventory Movements / Stock Ledger — Technical-Functional Analysis

Date: 2026-04-19
Scope: análisis del estado real del repo para preparar iteración de movimientos/ledger (sin implementación en este documento).

## 1) Estado actual: stock global vs eventos

### Cómo se representa stock global hoy
- El stock global vive en `inventory_items.current_stock`.
- `current_stock` es editable de forma directa desde acciones de inventario (alta/edición de item).
- El propio esquema histórico de inventario documenta que esta iteración base no tiene movimientos avanzados.

### Quién modifica stock hoy
- Flujos que actualizan `inventory_items` requieren `inventory.manage`.
- No hay acción específica de “movimiento” (purchase/pull/return/waste) que impacte `current_stock` de forma transaccional con trazabilidad.

### Si hay historial o no
- No existe tabla ledger/movements en repo actual.
- Hay trazabilidad operativa por requirement/evento (prep, execution 2B, closeout 2C), pero no historial contable de cambios de `current_stock`.

### Si eventos impactan stock global hoy
- Eventos NO impactan automáticamente `current_stock` al marcar shopping/picking o al cerrar closeout.
- 2B y 2C persisten estado operativo del evento, pero no generan movimientos de inventario maestro.

## 2) Qué faltaría para un ledger real

Para movimientos reales y auditables, faltaría una capa explícita con registros tipo:
- `purchase_restock`
- `pulled_for_event`
- `returned_from_event`
- `waste_loss`
- `manual_adjustment`
- (opcional) `final_consumption`

Cada movimiento debería incluir al menos:
- `inventory_item_id`
- `movement_type`
- `quantity_delta` (signed)
- `occurred_at`
- `created_by`
- referencia de contexto (`event_id`, `event_inventory_requirement_id`, `source_type/source_id`)
- `note`

Y opcional recomendado:
- `approval_status`, `approved_by`, `approved_at` para flujos sensibles.

## 3) Cómo conectar 2B y 2C con stock global

### Conexión recomendada
- 2B/2C siguen siendo capa operativa del evento.
- Ledger será la capa que sí mueve stock global.

### Cuándo bajar/subir stock (recomendación sana)
- **No descontar al marcar `pulled` automáticamente** en 2B si no hay control de aprobación (evita doble descuento).
- Registrar intención operativa en 2B y ejecutar movimiento real en punto controlado.
- En 2C:
  - `returned_quantity` debe generar movimiento positivo (entrada) cuando se aprueba closeout.
  - `waste_quantity` debe generar movimiento negativo (merma) cuando se aprueba closeout.
- Para consumo final:
  - usar `quantity_used` + closeout aprobado para calcular delta final robusto.

### Automático vs aprobación
- Recomendación: **aplicación controlada por aprobación supervisor** para cambios de stock global.
- Team Leader captura datos; Supervisor confirma/aprueba; sistema publica movimientos.

## 4) Estructura recomendada para ledger/movements

### Opción más sana
**Tabla nueva `inventory_stock_movements` (ledger)** + mantener `inventory_items.current_stock` como snapshot actual.

Campos base sugeridos:
- `id`
- `inventory_item_id`
- `movement_type` (enum)
- `quantity_delta`
- `balance_after` (opcional pero útil)
- `event_id` nullable
- `event_inventory_requirement_id` nullable
- `execution_state_id` nullable
- `closeout_state_id` nullable
- `created_by`, `created_at`
- `approved_by`, `approved_at`, `approval_status` (si controlado)
- `note`

### Por qué no solo campos extra en `inventory_items`
- Se pierde historial detallado y auditabilidad.
- Riesgo alto de inconsistencias y poca trazabilidad para conciliación futura.

### Estrategia híbrida recomendada
- `inventory_stock_movements` = fuente histórica.
- `inventory_items.current_stock` = snapshot derivado actualizado transaccionalmente al crear movimiento aprobado.

## 5) Reglas operativas recomendadas

1. **Pulled (2B)**
   - Marca operativa en 2B.
   - No altera `current_stock` automáticamente en fase inicial de ledger.
2. **Closeout aprobado (2C)**
   - Genera movimientos:
     - `returned_from_event` (+)
     - `waste_loss` (-)
   - `quantity_used` participa en conciliación, pero evitar doble descuento.
3. **Compras / restock**
   - Registrar siempre como movimiento explícito `purchase_restock` (+).
4. **Ajustes manuales**
   - `manual_adjustment` con nota obligatoria y actor.
5. **Idempotencia / doble aplicación**
   - Clave de origen por requirement+fase para no duplicar movimientos por retries/reaprobaciones.

## 6) Split Team Leader / Supervisor / Owner (sin rediseño de roles)

### Team Leader
- Captura operativa:
  - 2B (shopping/picking)
  - 2C (used/leftover/returned/waste)
- No aplica movimientos globales finales de stock por su cuenta.

### Supervisor
- Revisa y aprueba closeout.
- Dispara (directa o indirectamente) publicación de movimientos al ledger.
- Puede reabrir ajustes si hay inconsistencias.

### Owner
- Visibilidad read-only de:
  - resumen de movimientos,
  - balance por item,
  - trazabilidad de aprobación y origen (evento/requirement).

## 7) Riesgos y contratos delicados

### Módulos que tocaría fase ledger
- `services/inventory/actions.ts` (publicación de movimientos + guardas)
- `services/inventory/queries.ts` (lectura ledger/resúmenes)
- `components/inventory/inventory-overview.tsx` (mostrar snapshot + señales ledger)
- `components/inventory/event-inventory-section.tsx` (estado de aplicación de movimientos)
- `services/events/actions.ts` (posible gate de `completado` con closeout/ledger)
- nuevas migraciones SQL (ledger + RLS + constraints)

### Contratos que hay que respetar sí o sí
1. `inventory_items` como catálogo maestro + snapshot de stock.
2. `event_inventory_requirements` como requirement base del evento.
3. 2B (`event_inventory_execution_state`) separado de closeout/ledger.
4. 2C (`event_inventory_closeout_state`) como reconciliación operativa.
5. permisos actuales (`inventory.view`, `inventory.prepare`, `inventory.manage`) sin rediseño destructivo.
6. compatibilidad con bar master templates.

### Riesgos críticos
- Doble descuento o doble retorno por retries/aprobaciones múltiples.
- Inconsistencia entre ledger y `current_stock` si no hay transacción atómica.
- Sobreescrituras manuales de `current_stock` sin movimiento espejo.

## 8) Archivos revisados
- `types/inventory.ts`
- `services/inventory/actions.ts`
- `services/inventory/queries.ts`
- `components/inventory/inventory-overview.tsx`
- `components/inventory/event-inventory-section.tsx`
- `services/events/actions.ts`
- `services/events/queries.ts`
- `supabase/migrations/20260323000002_inventory_materials.sql`
- `supabase/migrations/20260401000002_inventory_event_prep_hardening.sql`
- `supabase/migrations/20260419000001_inventory_execution_state.sql`
- `supabase/migrations/20260419000002_inventory_closeout_state.sql`

## 9) Estado de cambios
- No se implementó ledger/movements en esta entrega.
- Solo se añadió documento de análisis técnico/funcional.

## 10) Commit
- Ver historial git del branch para commit asociado.
