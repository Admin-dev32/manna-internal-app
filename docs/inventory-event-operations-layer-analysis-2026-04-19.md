# Inventory Event Operations Layer — Deep Analysis (as-is)

Date: 2026-04-19  
Scope: current repo behavior only (no implementation changes to flow/contracts)

## 1) Current state: event inventory operations

### Data model currently used
- `inventory_items` is the general/master catalog (Inventory V2), with stock and storage metadata (`current_stock`, `minimum_stock`, `ideal_stock`, `storage_location`, `storage_box`, `usage_bars`, `code`).
- `event_inventory_requirements` is the per-event operational requirement layer linked to the master catalog through `inventory_item_id`.
- Core event requirement fields currently active in app logic:
  - `quantity_required` (planned demand)
  - `quantity_counted` (operationally counted/confirmed for that event)
  - `quantity_used` (consumed/used, optional)
  - `prep_status` (`pendiente | contado | faltante | listo`)
  - `prep_notes`, `note`, `checked_by`, `checked_at`
  - provenance fields: `source_type` (`manual|template`) and `source_template_id`.

### Current operational flow in UI/service
- Event detail includes a single inventory section where users with `inventory.view` can see requirements and users with `inventory.prepare`/`inventory.manage` can mutate requirements.
- In that section users can:
  - add manual requirements,
  - edit requirement quantities and prep metadata,
  - remove requirements,
  - apply bar master templates to seed/consolidate requirements.
- Requirement `prep_status` is not fully free-form: action logic derives/corrects status from `quantity_required` and `quantity_counted` even if user selects a status.

### Pre-event prep / post-event
- Pre-event as a module (`reservas`) is currently a commercial/ops bridge and does not execute inventory material operations directly; it defers real material creation to linked event context.
- Post-event leftovers are not a dedicated entity/table today. Existing capture channel is `quantity_used` + notes in `event_inventory_requirements`; there is no explicit leftover ledger model in this layer.

## 2) Relationship with general inventory (sync quality today)

### What is already solved
- Event requirements always reference real master catalog items (`inventory_item_id` FK), so event material lines are anchored to the same inventory universe.
- Availability used by event panel is computed from:
  - `current_stock` from `inventory_items`
  - reserved stock inferred as sum of `quantity_required` across active events (`pendiente|confirmado|en_preparacion`), excluding current event for contextual calculation
  - resulting `availableStock = currentStock - reservedStock`
- Storage/location dimensions are already in catalog and surfaced in event UI badges/options (`storage_location`, `storage_box`).
- Usage context by service/bar exists as catalog metadata (`usage_bars`) and is visible in event requirements card.

### What is only partially solved
- Reservations are demand-based (`quantity_required`) and not stateful allocation records. There is no explicit reservation entity with lifecycle (reserved/released/consumed).
- No movement ledger yet: stock is editable directly in catalog and not decremented automatically from event execution.
- “Shopping need” exists strongly in master inventory view via `ideal_stock/minimum_stock` gap, but event-specific shopping output is not a first-class module yet.
- No explicit source split field per requirement for “from stock vs to buy” decision; today this is inferred ad hoc from availability and counted deltas.

### Viability for derived event shopping list
- Viability is **good** for a derived view (without creating separate inventory):
  - demand = `event_inventory_requirements.quantity_required`
  - available/reserved = `calculateAvailabilityMaps`
  - physical retrieval hints = `storage_location/storage_box`
  - shortage signal = `availableStock < quantity_required` and/or `required - counted`
- Main gap is orchestration fields (decision/status for procurement vs picklist), not base data.

## 3) Bar master templates relationship

### What exists
- Dedicated template system (`bar_master_templates`, `bar_master_template_items`, application log table).
- Template items can optionally map to catalog items; unmapped textual items are allowed in templates.
- When applying template to event:
  - only template items with `inventory_item_id` are materialized in `event_inventory_requirements`;
  - existing event requirement for same item is consolidated (quantity sum) instead of duplicated;
  - source is marked as template and application is logged in `event_bar_master_template_applications`.

### Quality of foundation for event operations view
- Good foundation for seeding baseline requirements by service/bar.
- Important nuance: `source_template_id` is currently inserted as `null` in bar-master application path, so provenance is mostly via note + application log rather than direct FK in requirement row.

## 4) What is missing for a dedicated Supervisor Prep layer

A future Supervisor Prep view can be added without rearchitecting if it layers on current contracts. Missing pieces are mostly **view-model and state semantics**:

1. **Operational split fields** (new derived/metadata semantics, not replacing current fields):
   - quantity to pull from stock
   - quantity to purchase
   - optional procurement status/owner/ETA
2. **Kit readiness summary** at event level:
   - ready lines, lines with shortage, lines pending supervisor decision
3. **Pick/pack perspective** built from existing location data:
   - grouped by `storage_location` and `storage_box`
4. **Decision traceability**:
   - explicit supervisor decisions instead of only free-text `prep_notes`
5. **Guardrails**:
   - preserve requirement uniqueness (`event_id + inventory_item_id`) and current `prep_status` derivation rules.

## 5) What is missing for a Team Leader View (simple visual modules)

Given current backbone, Team Leader view should be a **read/execute projection** over event requirements, not a new inventory model.

Recommended missing modules (UI composition, not backend rewrite):

1. **Evento actual (hero card)**
   - operational date/time/status + prep completion counters
2. **Qué comprar (shopping cards)**
   - derived shortage list with quick quantities and urgency
3. **Qué sacar de inventario (pick cards)**
   - grouped by storage/caja using catalog location metadata
4. **Checklist de barra**
   - reuse existing event checklist + operational template artifacts
5. **Inventario pre-evento / leftovers post-evento**
   - pre-evento: `quantity_counted` confirmation workflow
   - post-evento: `quantity_used` capture + structured notes until dedicated leftovers model exists

Current blocker is mostly UX structure (cards/modules) and explicit derived grouping logic; base data exists.

## 6) Risks and delicate contracts to preserve

### Modules that next phase would touch
- Event inventory presentation (`components/inventory/event-inventory-section.tsx` or sibling layer)
- Inventory queries/availability calculators (`services/inventory/queries.ts`)
- Inventory actions if adding supervisor decision metadata (`services/inventory/actions.ts`)
- Event detail composition (`services/events/queries.ts`, event page wiring)
- Possibly reminder derivations (`services/reminders/queries.ts`) if new statuses are introduced

### Contracts that should not break
1. **Inventory master catalog as source-of-truth** (`inventory_items`).
2. **`event_inventory_requirements` as event requirement instance** with unique `(event_id, inventory_item_id)`.
3. **Existing prep status semantics** (`pendiente/contado/faltante/listo`) and derivation from counted vs required.
4. **Current pre-event flow**: template/event material creation occurs only once linked to event.
5. **Bar master behavior**: consolidate quantities and keep application log.
6. **Current role/permission gates**:
   - view via `inventory.view`
   - mutate prep via `inventory.prepare|inventory.manage`
   - template management via `inventory.templates.*`

### Delicate points
- If introducing “shopping list” persistence, avoid duplicating inventory rows or replacing requirement table as source.
- Avoid forcing stock deductions at requirement update time (no movement ledger today).
- Keep RLS + app permissions aligned; DB policies already encode inventory permission checks.

## 7) Suggested structure for next iteration (analysis recommendation)

Without redoing architecture, a safe Phase 2 shape is:

1. **Supervisor Prep Surface (new projection + minimal metadata)**
   - Tabs/cards: `Requerimientos`, `Tomar de stock`, `Comprar`, `Kit listo`
   - Derived calculations from current requirement + availability maps
   - Optional lightweight decision fields for procurement/picking owner/status

2. **Team Leader View Surface (execution UI only)**
   - Card-first layout, no heavy table
   - Modules:
     - Hoy / Evento asignado
     - Compras pendientes
     - Retiro de bodega (storage/caja)
     - Checklist barra
     - Antes/Después (counted vs used)

3. **No model split**
   - Keep single general inventory catalog and event requirements.
   - Keep shopping list as derived operational view, optionally persisted only as decisions/flags.

4. **Compatibility first**
   - Keep existing event detail section functional while new view matures.
   - Reuse availability calculator + permissions unchanged.

## 8) Files reviewed (core)

- `types/inventory.ts`
- `services/inventory/queries.ts`
- `services/inventory/actions.ts`
- `components/inventory/event-inventory-section.tsx`
- `components/inventory/inventory-overview.tsx`
- `services/bar-master-templates/actions.ts`
- `services/bar-master-templates/queries.ts`
- `components/inventory/bar-master-templates-manager.tsx`
- `services/operational-templates/actions.ts`
- `components/templates/event-template-section.tsx`
- `services/events/queries.ts`
- `app/(app)/eventos/[eventId]/page.tsx`
- `components/pre-events/pre-event-detail.tsx`
- `services/reminders/queries.ts`
- `config/roles.ts`
- `types/auth.ts`
- `supabase/migrations/20260323000002_inventory_materials.sql`
- `supabase/migrations/20260401000002_inventory_event_prep_hardening.sql`
- `supabase/migrations/20260401000001_bar_master_templates_v1.sql`
- `supabase/migrations/20260418000003_inventory_v2_storage_structure.sql`

## 9) Implementation status
- No implementation of new functionality was done.
- Only analysis documentation was added.

## 10) Commit status
- See git history for this branch after this analysis commit.
