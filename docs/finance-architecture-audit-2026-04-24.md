# Arquitectura Integrada Quotes → Reservas → Eventos → Finanzas (Diseño, sin implementación)

Fecha: 2026-04-24  
Estado: Propuesta arquitectónica (read-only / no cambios funcionales)

---

## 0) Objetivo y principio rector

Diseñar una arquitectura integrada para **Reservas + Eventos + Finanzas** donde:
- Reservas opere como **invoice-like booking control**.
- Eventos muestre señales financieras derivadas (badges), sin convertirse en módulo financiero.
- Finanzas consolide projected vs actual desde módulos existentes.

Principio no negociable: **no duplicar captura ni lógica en módulos paralelos**.

---

## 1) Auditoría de Reservas como invoice-like system

## 1.1 Qué tiene hoy Reservas (`pre_events`)

Reservas hoy es un puente operativo con:
- vínculo canónico a quote (`source_quote_id`, único)
- vínculo a cliente (`client_id`)
- datos confirmados básicos (fecha/hora/location/servicio/invitados)
- estado operativo de reserva (`pendiente`, `confirmado`, `en_preparacion`)
- payment links asociados por source `pre_event`
- contexto financiero read-only heredado desde quote sheet

## 1.2 Qué datos financieros puede derivar hoy (sin schema nuevo)

Desde quote:
- `total del evento` = `quotes.total_amount`
- `depósito requerido` = `quotes.expected_deposit`
- `balance esperado` = `quotes.estimated_balance`

Desde payment_links de reserva:
- links generados por modo (`deposit`/`full`)
- monto a cobrar por intento de cobro (`amount_to_charge`)
- balance teórico del link (`balance_due`)

Desde invoices:
- resumen invoice-like documental (si existe invoice por quote)
- snapshot económico asociado a quote/pre_event/event

## 1.3 Qué falta para que Reservas sea invoice-like control real

Faltan (a nivel producto/canonical logic) sin tocar schema todavía:
1. helper único de `payment_status` para reserva.
2. criterio oficial de `deposit_paid` y `paid_in_full` (hoy payment_links no equivale a cobro confirmado).
3. resumen de booking financial state en una sola card de Reserva.
4. timeline financiero de la reserva (quote accepted → links → invoice → pagos confirmados).

## 1.4 Componentes recomendados para Reservas (sin implementar)

- `PaymentSummaryCard`
- `BalanceStatusBadge`
- `PaymentLinksPanel`
- `InvoiceLikeSummary`
- `BookingStatusTimeline`

Todos read-only inicialmente y derivados de tablas existentes.

---

## 2) Payment status canonical source (recomendado)

## Recomendación de source-of-truth por madurez

### Fase actual (sin ledger, sin webhook-paid canonical local)
Orden de precedencia recomendado:
1. **Evento de pago confirmado** (cuando exista señal confiable; hoy puede faltar en este repo).
2. **Invoice state** (`paid`, `partially_paid`, `issued`) como señal documental de negocio.
3. **Quote math fields** (`total_amount`, `expected_deposit`, `estimated_balance`) para expected values.
4. **Payment links** como señal de intención/canal de cobro, no de cobro definitivo.

### Fase futura (con ledger)
- `financial_transactions` (tipo `income_collected`) pasa a ser canonical para dinero cobrado.
- invoice y payment_links quedan como supporting documents/channels.

## Estados recomendados y semántica
- `paid_in_full`: total cobrado confirmado >= total esperado.
- `deposit_paid_balance_pending`: depósito confirmado, saldo pendiente > 0.
- `reserved_not_paid_in_full`: reserva activa con cobro parcial no suficiente.
- `payment_pending`: sin cobro confirmado.
- `cancelled_or_inactive`: reserva/evento cancelado o inactivo.

---

## 3) Propuesta para calendario de Eventos (pagado vs reservado)

## 3.1 Situación actual

Eventos ya tiene vista lista/calendario, filtros por estado/fecha y badges operativos.
Aún no existe un badge financiero canónico de payment status.

## 3.2 Sistema visual recomendado (badge financiero derivado)

Nuevo badge `PaymentStatusBadge` en cards y celdas calendario:
- `Paid in Full` → verde sólido
- `Deposit Paid / Balance Pending` → ámbar
- `Reserved / Not Paid in Full` → azul
- `Payment Pending` → gris/outline
- `Cancelled/Inactive` → gris oscuro o rojo muted

## 3.3 Filtros recomendados

En `CalendarFilterBar`:
- filtro por `payment_status`
- filtro por `booking_status` (pre_event/event status)
- filtro compuesto rápido: “upcoming + payment pending”

## 3.4 Reglas UX

- Mostrar `balance pending` como dato breve (no tabla financiera completa) en card/cal cell.
- Mantener Eventos como módulo operativo: solo señales resumidas + link a Reserva/Finanzas para detalle.
- No duplicar formularios de cobro dentro de Eventos.

---

## 4) Integración propuesta con Finanzas

Finanzas consolida por lectura (fases iniciales):

### Ingresos
- `income_expected`: desde quote (`total_amount`) y/o invoice emitida
- `income_paid`: desde estado de pago confirmado (hoy inferido; futuro ledger)
- `pending_balance`: total esperado - total cobrado confirmado

### Gastos
- `projected_expenses`: `quote_financial_expenses`
- `actual_expenses`: `financial_expenses` (preferible approved)

### Rentabilidad
- `projected_profit`: summary de quote financial sheet
- `actual_profit`: income_paid - actual_expenses - payouts
- `variance`: actual_profit - projected_profit

### Por evento
- unir por cadena:
  `event.source_pre_event_id` → `pre_events.source_quote_id` → quote + invoice + payment links + expenses

---

## 5) Reglas anti-duplicación estrictas

1. **Reservas no duplica Quotes**
   - `pre_events.source_quote_id` como origen económico comercial.

2. **Eventos no duplica Reservas**
   - `events.source_pre_event_id` único como continuidad operativa.

3. **Finanzas no duplica Reservas/Eventos**
   - preferir agregación read-only por joins y helpers.

4. **Payment status centralizado**
   - un helper/shared selector único usado por Reservas, Eventos y Finanzas.

5. **Si se crea ledger futuro**
   - source fingerprint: `source_table + source_id + transaction_kind`
   - unique constraint e idempotency key determinística.

6. **No re-captura manual de campos ya derivados**
   - total/deposit/balance vienen de quote/invoice/payment status canonical, no inputs duplicados.

---

## 6) Componentes recomendados por módulo (sin implementación)

## Reservas
- `PaymentSummaryCard`
- `BalanceStatusBadge`
- `PaymentLinksPanel`
- `InvoiceLikeSummary`
- `BookingStatusTimeline`

## Eventos
- `EventCalendarCard`
- `PaymentStatusBadge`
- `BookingStatusLegend`
- `CalendarFilterBar`

## Finanzas
- `FinanceOverviewCards`
- `RevenuePipeline`
- `ProjectedVsActualPanel`
- `EventProfitTable`

---

## 7) Roadmap seguro por fases

### Fase 1 — Canonical helper + badges read-only
- definir helper único `resolvePaymentStatus(...)`
- mostrar badges en Reservas/Eventos/Finanzas sin mutar datos

### Fase 2 — Reservas invoice-like summary
- agregar resumen financiero de booking usando datos existentes
- sin crear nuevo invoice/payment module

### Fase 3 — Calendario Eventos mejorado
- badges financieros + filtros payment/booking
- mantener foco operativo

### Fase 4 — Finanzas read-only integrado
- pipeline expected/paid/pending
- projected vs actual por evento/cliente/mes

### Fase 5 — Receipts y gastos reales
- upload real de receipts sobre `financial_expenses`
- reutilizar patrón de Supabase Storage existente

### Fase 6 — Ledger con idempotencia
- introducir `financial_transactions` referencial
- posting por eventos de negocio, anti-duplicación estricta

---

## 8) Riesgos y decisiones pendientes

1. Definir señal definitiva de “paid confirmed” (hoy `payment_links` no lo garantiza).
2. Elegir criterio de gasto actual: `submitted` vs `approved` en reportes.
3. Política de retro-edición de gastos/invoices y su efecto en métricas históricas.
4. Manejo de cancelaciones y reversas en payment status.
5. Multi-currency futura (actualmente predomina `usd`).

---

## 9) Archivos y tablas que probablemente se tocarán después

### Archivos (fase implementación futura)
- `services/pre-events/queries.ts`
- `services/pre-events/actions.ts`
- `components/pre-events/pre-event-detail.tsx`
- `components/pre-events/pre-events-operations-board.tsx`
- `components/events/events-list.tsx`
- `services/events/queries.ts`
- `app/(app)/eventos/page.tsx`
- `services/finance/queries.ts`
- `app/(app)/finanzas/page.tsx`
- `components/finance/expenses-module.tsx`

### Tablas (reuso actual)
- `quotes`
- `quote_financial_sheets`
- `quote_financial_expenses`
- `pre_events`
- `events`
- `payment_links`
- `invoices`
- `financial_expenses`
- `financial_change_logs`

### Tablas futuras (si se aprueba)
- `financial_transactions`
- `financial_receipt_attachments`

---

## Confirmación explícita

✅ No se hicieron cambios funcionales de negocio, schema, rutas, auth ni payment flow en esta fase.

Documento de arquitectura únicamente.
