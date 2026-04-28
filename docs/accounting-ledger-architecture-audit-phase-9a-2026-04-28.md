# Fase 9A — Accounting / Ledger Architecture Audit (Análisis)

Fecha: 2026-04-28  
Estado: Propuesta de arquitectura (solo análisis; sin implementación)

---

## Alcance y guardrails de esta fase

Esta fase define arquitectura contable para acercar el sistema a un modelo tipo Wave/QuickBooks, sin ejecutar cambios funcionales.

**No incluido en 9A:**
- sin migraciones
- sin cambios de schema
- sin cambios UI
- sin cambios de payment flow
- sin reportes nuevos productivos

---

## 1) Auditoría del estado actual

### 1.1 Módulos y datos actuales que SÍ pueden alimentar un ledger (como fuentes de negocio)

1. **Invoices (`public.invoices`)**
   - Identidad transaccional clara (`id`, `invoice_number`, `source_type`, `source_id`).
   - Estados útiles para eventos de posting (`draft`, `issued`, `partially_paid`, `paid`, `void`).
   - Montos base (`subtotal`, `discount_amount`, `total_amount`, `balance_due`).
   - Fechas clave (`issued_at`, `due_at`).
   - Relación con cliente/evento/reserva (`client_id`, `pre_event_id`, `event_id`).
   - Esto permite construir posting de AR/Revenue en base accrual y referencias de integridad.

2. **Financial expenses (`public.financial_expenses`)**
   - Monto y fecha (`amount`, `expense_date`) con estado de flujo (`draft`, `submitted`, `approved`, `rejected`).
   - Contexto por scope (`event`/`general`) y vínculo opcional a `event_id`/`quote_id`.
   - Apto para posting de gastos/COGS condicionado por estado.

3. **Expense categories (`public.financial_expense_categories` + `financial_expenses.category_id`)**
   - Taxonomía controlada (slug, report_group, tax_sensitive, deductible_default).
   - Excelente base para mapping categoría -> account_id contable.

4. **Contractor payouts (`public.contractor_payouts`)**
   - Registro operativo de pagos a contratistas con `status` (`draft`, `approved`, `paid`, `cancelled`, `reversed`) y `payment_method`.
   - `idempotency_key` existente reduce riesgo de duplicados.
   - Útil para posting de salida de caja al pagar.

5. **Contexto de negocio para segmentación contable**
   - `clients`, `events`, `pre_events`, `quotes` ya conectan los flujos de ingresos/costos.
   - Sirven para dimensión analítica (entity_type/entity_id en líneas de journal) sin duplicar captura.

### 1.2 Datos que hoy son señal operativa y NO deben postearse directo a ledger

1. **`payment_links`**
   - Son canal/intención de cobro (`external_url`, `amount_to_charge`), no confirmación canónica de dinero recibido.
   - No deben crear asientos de Cash ni limpiar AR por sí solos.

2. **`payment_status` helper (fallbacks)**
   - Usa inferencias y fallback temporal (ej. expected deposit como proxy con `partially_paid`).
   - Es útil para UX operacional, no para contabilidad oficial.

3. **Finance overview/reports actuales**
   - Mezclan señales operativas (revenue signal, known paid, approved expenses) y no son posting-grade ni filing-grade.
   - Deben seguir siendo “management reporting” hasta que exista ledger + canonical payments + tax model.

4. **`financial_settings` y quote financial sheets**
   - Son planeación/proyección (tax reserve %, comisión, projected expenses), no hechos contables.
   - No deben registrar revenue/expense real en GL.

### 1.3 Gaps para contabilidad real (hoy faltante)

1. **No existe Chart of Accounts canónico.**
2. **No existe subledger canónico de cobros (`invoice_payments`).**
3. **No existe General Ledger (journal_entries / journal_entry_lines).**
4. **No existe tax model real por invoice/line** (faltan taxable_amount, tax_rate, tax_amount, jurisdicción).
5. **No existe separación formal de basis** (cash vs accrual en motor/reporting).
6. **No existe Accounts Payable formal** para gastos devengados no pagados.
7. **No existe reconciliación bancaria** (depósitos, fees, matching).
8. **No existe política de inmutabilidad contable** (posted lock + reversing entries).

### 1.4 Source of truth recomendado por flujo

- **Revenue recognition (accrual):** `invoices` en transición a estado posted mediante motor contable.
- **Cash collection:** futura tabla `invoice_payments` (no `payment_links`).
- **Expense recognition:** `financial_expenses` con status trigger de posting (recomendado: `approved` con metadatos de pago).
- **Contractor disbursement:** `contractor_payouts` al pasar a `paid` (con control anti doble conteo vs expenses).
- **Tax liability:** campos fiscales explícitos en invoice/lines + cuenta `Sales Tax Payable` en CoA.

---

## 2) Recomendación de arquitectura contable (visión objetivo)

Arquitectura en capas, sin reemplazar módulos actuales:

1. **Operational layer (ya existe):** invoices, expenses, payouts, payment_links, quotes/events/pre_events.
2. **Accounting master data:** `chart_of_accounts` + tablas de mapping.
3. **Subledgers canónicos:** `invoice_payments` (cobros reales) y futuros auxiliares de AP/reconciliation.
4. **GL engine:** `journal_entries` + `journal_entry_lines` con reglas de doble partida.
5. **Posting engine:** traduce eventos de negocio -> asientos idempotentes.
6. **Reporting layer:** reportes cash/accrual/tax basados en GL, no en señales operativas directas.

Principio rector: **módulos operativos generan eventos; ledger consolida efectos contables oficiales**.

---

## 3) Modelo propuesto — Chart of Accounts

### 3.1 Tabla `chart_of_accounts`

Campos recomendados:
- `id` uuid pk
- `code` text unique (ej. 1000, 1100, 4000)
- `name` text
- `account_type` text check in:
  - `asset`
  - `liability`
  - `equity`
  - `income`
  - `cost_of_goods_sold`
  - `expense`
  - `other_income`
  - `other_expense`
- `normal_balance` text check in (`debit`, `credit`)
- `parent_account_id` uuid nullable fk self
- `description` text
- `active` boolean default true
- `system_account` boolean default false
- `created_at` timestamptz
- `updated_at` timestamptz

### 3.2 Reglas de diseño CoA

- `code` jerárquico y estable (nunca reutilizar códigos desactivados).
- `system_account=true` para cuentas críticas (AR, Cash, Sales Tax Payable, Revenue).
- Permitir subcuentas por método/cuenta bancaria (ej. 1010 Checking, 1020 Stripe Clearing).
- `parent_account_id` para reporting consolidado.

### 3.3 Cuentas iniciales sugeridas (starter pack)

**Assets**
- 1000 Cash / Bank
- 1010 Undeposited Funds (opcional recomendado)
- 1100 Accounts Receivable

**Liabilities**
- 2100 Sales Tax Payable
- 2200 Accounts Payable (si se habilita accrual completo de gastos)

**Equity**
- 3000 Owner Equity

**Income**
- 4000 Sales Revenue
- 4090 Discounts/Allowances (contra-income)

**COGS**
- 5000 Cost of Goods Sold
- 5010 Food & Ingredients
- 5020 Event Supplies

**Expenses**
- 6100 Contractor Labor
- 6200 Marketing
- 6300 Vehicle & Fuel
- 6400 Office & Software
- 6500 Fees

**Other / Fixed assets**
- 1500 Equipment (si capitalizable) o 6600 Equipment Expense (si política simplificada)

---

## 4) Modelo propuesto — Sales Tax real

### 4.1 Campos necesarios (invoice header + line-level recomendado)

**A nivel invoice (mínimo):**
- `taxable_amount`
- `non_taxable_amount`
- `tax_rate` (header effective, si aplica)
- `tax_amount`
- `tax_jurisdiction`
- `tax_region`
- `tax_exemption_reason`
- `tax_collected` (derivado de pagos o bandera de cobro efectivo)
- `sales_tax_payable_account_id`

**A nivel invoice line item (recomendado para filing confiable):**
- line `taxable` bool
- line `tax_rate`
- line `tax_amount`
- line `jurisdiction_code`

### 4.2 Qué se puede calcular hoy

- Total invoice (`total_amount`) y descuentos (`discount_amount`).
- Estimaciones de expected deposit/balance desde quote.
- Métricas operativas de estado (paid/issued/partially_paid) no estrictamente contables.

### 4.3 Qué NO se puede calcular hoy con confianza

- Base gravable real por jurisdicción.
- Tax exacto por invoice/line y su prorrateo por descuentos.
- Tax collected real basado en cobros verdaderos (no intenciones).
- Tax payable periodizado y reconciliable con pagos/fees.

### 4.4 Qué falta para soporte más confiable tipo CDTFA

1. Tax fields estructurados en invoice/line.
2. Reglas de taxability por item/categoría.
3. Jurisdicción normalizada por dirección/service location.
4. Registro canónico de cobros (`invoice_payments`) para “collected”.
5. Ledger de liability (`Sales Tax Payable`) con reversas y ajustes.
6. Reporte tax auditable con trazabilidad invoice -> payment -> journal.

### 4.5 Guardrail de comunicación

Hasta completar 4.4, etiquetar salidas como:
- “tax prep support / preliminary”
- “not filing-ready”

Nunca exponer como “filing-ready” o “CDTFA-ready” aún.

---

## 5) Modelo propuesto — `invoice_payments`

### 5.1 Tabla `invoice_payments`

Campos recomendados:
- `id` uuid pk
- `invoice_id` uuid fk invoices
- `amount` numeric(12,2)
- `payment_date` date/timestamptz
- `payment_method` text check (`stripe`, `zelle`, `cash`, `card`, `bank_transfer`, `manual_adjustment`, `other`)
- `provider` text nullable (ej. stripe)
- `provider_payment_id` text nullable unique parcial por provider
- `reference` text nullable
- `source_type` text (`webhook`, `manual`, `import`, `internal_api`)
- `status` text (`pending`, `succeeded`, `failed`, `reversed`, `refunded`)
- `fee_amount` numeric(12,2) default 0
- `net_amount` numeric(12,2) generated/validated (`amount - fee_amount`)
- `deposited_to_account_id` uuid fk chart_of_accounts
- `created_by` uuid
- `created_at` timestamptz

Índices clave:
- (`invoice_id`, `payment_date`)
- (`provider`, `provider_payment_id`) unique where not null
- (`status`, `payment_date`)

### 5.2 Distinción requerida por método/canal

- Stripe (provider-managed, con fee explícita)
- Zelle (manual confirmation/reference)
- Cash (on-site manual record)
- Card (si no Stripe, gateway manual)
- Bank transfer (ACH/wire con reference)
- Manual adjustment (write-off/reclass, fuertemente auditado)

### 5.3 Migración gradual desde “known payment signal”

1. Fase inicial: coexistencia; payment_status sigue operando para UX.
2. Introducir `invoice_payments` como fuente preferida de amount paid cuando exista.
3. Backfill opcional/manual para pagos históricos conocidos.
4. Cambiar helper para priorizar pagos canónicos > invoice status > fallback operativo.
5. Retirar fallback de expected_deposit como proxy contable en fases posteriores.

---

## 6) Modelo propuesto — Ledger / Journal

### 6.1 Tabla `journal_entries`

Campos:
- `id` uuid pk
- `entry_date` date
- `source_type` text (invoice_issue, invoice_payment, expense_approved, payout_paid, reversal, adjustment)
- `source_id` uuid/text
- `description` text
- `status` text (`draft`, `posted`, `reversed`)
- `created_by` uuid
- `posted_at` timestamptz nullable
- `reversed_entry_id` uuid nullable fk self
- `created_at` timestamptz

Constraint/índice recomendado:
- unique (`source_type`, `source_id`, `status`) para evitar doble posting activo.

### 6.2 Tabla `journal_entry_lines`

Campos:
- `id` uuid pk
- `journal_entry_id` uuid fk journal_entries
- `account_id` uuid fk chart_of_accounts
- `debit` numeric(12,2) default 0
- `credit` numeric(12,2) default 0
- `memo` text
- `entity_type` text nullable (`client`, `invoice`, `event`, `expense`, `payout`, `tax_jurisdiction`)
- `entity_id` uuid/text nullable
- `created_at` timestamptz

Constraints:
- `(debit = 0 and credit > 0) or (credit = 0 and debit > 0)`
- por entry: `sum(debit) = sum(credit)`

### 6.3 Reglas contables duras

1. **Double-entry obligatorio** (debits == credits).
2. **Posted immutable** (sin update/delete económico).
3. **Reversa por asiento espejo**, nunca delete.
4. **Idempotencia por source reference** para prevenir posting duplicado.

---

## 7) Diseño Accrual vs Cash basis

## 7.1 Accrual basis

### Invoice issued
- Dr Accounts Receivable
- Cr Sales Revenue
- Cr Sales Tax Payable (si aplica)

Necesita:
- invoice issue event confiable
- campos revenue/tax detallados
- AR account mapping

### Expense approved/incurred
- Dr Expense/COGS
- Cr Accounts Payable (si no pagado) **o** Cr Cash/Bank (si pagado al momento)

Necesita:
- estado de gasto + indicador paid/unpaid
- cuenta contable por categoría
- opcional AP subledger

## 7.2 Cash basis

### Payment received
Modelo recomendado con puente AR:
- si ya se registró invoice en accrual: Dr Cash / Cr AR
- para cash-basis report: reconocer ingreso en fecha de pago (query/reporting sobre cash receipts)

### Expense paid
- Dr Expense
- Cr Cash/Bank

Necesita:
- `invoice_payments` canónico
- fecha real de pago
- cuenta destino banco/caja
- en gastos: paid_date/payment_status o evento payout paid

## 7.3 Convivencia de ambos basis

- **No duplicar tablas**: mismo GL + flags de source/evento + lógica de report.
- Accrual report: usa postings de devengo.
- Cash report: usa postings de caja o filtros sobre movimientos que tocan cuentas de cash.

---

## 8) Reglas de integración

## 8.1 Invoices

- **Post revenue/tax** al pasar a `issued` (o al `posted` contable derivado de issued).
- `draft` no postea.
- `void` postea reversing entry del asiento de emisión.
- Cambios de monto después de posted: solo vía nota de crédito/adjusting entry (no editar asiento original).

## 8.2 Payments

- Post cash al `invoice_payments.status = succeeded`.
- Fee handling:
  - Dr Cash neto
  - Dr Fees (processing)
  - Cr AR (monto bruto aplicado a invoice)
- Reconciliación con payment_links:
  - `payment_links` queda como evidencia de canal/origen.
  - matching por metadata/reference/provider ids cuando sea posible.

## 8.3 Expenses (`financial_expenses`)

- Recomendación inicial: posting al estado `approved`.
- Si se introduce paid flag/date:
  - approved unpaid -> AP
  - approved paid -> Cash
- Mapping category/account:
  - usar `category_id` -> `expense_account_id` (nueva tabla de mapping en 9B)
  - fallback temporal: `category` legacy -> cuenta default

## 8.4 Contractor payouts

- Posting al estado `paid`.
- Modelo recomendado para evitar doble conteo:
  - Opción A (preferida): payout crea solo asiento (Dr Contractor Labor, Cr Cash) y **no** duplica expense adicional.
  - Opción B: si existe `financial_expense` vinculado, payout solo liquida AP/cash según relación, no vuelve a reconocer gasto.
- Regla anti-duplicado: usar `source_expense_id`/idempotency/linking policy obligatoria antes de automatizar ambos flujos.

---

## 9) Roadmap 9B–9H (schema phases)

## 9B — Chart of Accounts + mappings

**Nuevas tablas**
- `chart_of_accounts`
- `finance_account_mappings` (por ejemplo: invoice revenue account, tax payable account, category->expense account)

**Cambios existentes**
- opcional: `financial_expense_categories.default_account_id`

**Riesgos**
- mapping incompleto produce postings erróneos

**Dependencias**
- catálogo de cuentas acordado por negocio/contabilidad

## 9C — Invoice Payments + Sales Tax fields

**Nuevas tablas**
- `invoice_payments`

**Cambios existentes**
- `invoices` (campos tax header)
- opcional `invoice_line_items` si no existe aún (para tax granular)

**Riesgos**
- reconciliar pagos históricos incompletos
- ambigüedad de métodos manuales

**Dependencias**
- definiciones de source_type/status/provider

## 9D — Ledger tables

**Nuevas tablas**
- `journal_entries`
- `journal_entry_lines`

**Cambios existentes**
- none obligatorios (preferible desacoplado)

**Riesgos**
- performance/locking si constraints de balance no se diseñan bien

**Dependencias**
- 9B (accounts) y 9C (payments/tax mínimos)

## 9E — Posting engine

**Nuevas piezas**
- funciones/acciones idempotentes de posting por evento

**Cambios existentes**
- hooks en transitions (invoice issued/void, payment succeeded, expense approved, payout paid)

**Riesgos**
- doble posting por retries/concurrencia

**Dependencias**
- 9D completo + policy de inmutabilidad/reversa

## 9F — Accrual/Cash reports

**Nuevas vistas/queries**
- reportes basados en GL con filtros basis

**Cambios existentes**
- adaptar finance reports para consumir GL gradualmente

**Riesgos**
- discrepancias con reportes operativos legacy durante transición

**Dependencias**
- 9E estable y reconciliado

## 9G — Sales Tax report

**Nuevas vistas/queries**
- tax liability/collected por periodo/jurisdicción

**Cambios existentes**
- etiquetado explícito de “filing-ready” solo cuando criterios completos se cumplan

**Riesgos**
- exposición prematura de tax report como oficial

**Dependencias**
- 9C + 9E + 9F

## 9H — Reconciliation support

**Nuevas tablas opcionales**
- `bank_accounts`
- `bank_statement_lines`
- `reconciliation_sessions`

**Cambios existentes**
- links entre invoice_payments/journal entries y depósitos bancarios

**Riesgos**
- tiempos operativos y calidad de import bancario

**Dependencias**
- 9C, 9D, 9E maduros

---

## 10) Permisos recomendados

### 10.1 Nuevos permisos target

- `finance.accounts.view`
- `finance.accounts.manage`
- `finance.ledger.view`
- `finance.ledger.post`
- `finance.ledger.reverse`
- `finance.payments.view`
- `finance.payments.manage`
- `finance.tax.view`
- `finance.tax.manage`

### 10.2 Estrategia de transición

Fase inicial puede reutilizar permisos existentes:
- `finance.view`
- `finance.invoices.view/manage`
- `finance.expenses.view/manage/approve`

Luego migrar gradualmente a permisos específicos contables para SoD (segregation of duties), especialmente:
- separar quien **postea** vs quien **reversa**.

---

## 11) Riesgos principales y mitigaciones

1. **Double counting revenue**
   - Mitigar con idempotency por (`source_type`,`source_id`) y reglas de transición únicas.

2. **Double counting contractor payouts + expenses**
   - Definir política única (payout reconoce gasto vs payout liquida gasto ya reconocido).

3. **Tratar payment_links como pago**
   - Bloquear posting cash desde payment_links; usar solo `invoice_payments succeeded`.

4. **Inexactitud de tax report**
   - No filing-ready hasta tax fields completos + cash evidence + ledger trace.

5. **Modificar asientos posteados**
   - Inmutabilidad y reversa obligatoria.

6. **Migración histórica invoices/expenses**
   - estrategia de opening balances + backfill controlado + periodo de corte.

7. **Confusión cash vs accrual**
   - reportes etiquetados por basis y definiciones visibles en UI/report metadata.

8. **Falta de reconciliación bancaria**
   - priorizar 9H para cerrar circuito de confiabilidad.

---

## 12) Confirmación de cumplimiento de la fase 9A

✅ Esta entrega es **solo análisis y arquitectura**.

✅ **No** se implementó código funcional de negocio.

✅ **No** se crearon migraciones.

✅ **No** se alteró schema.

✅ **No** se cambió UI.

✅ **No** se cambió payment flow.

✅ **No** se agregaron reportes productivos.
