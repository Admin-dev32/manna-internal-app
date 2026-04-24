# ADR — Contractor Payouts Architecture (Phase 6)

**Date:** 2026-04-24  
**Status:** Approved (Architecture only, no implementation yet)  
**Decision:** Option C — Hybrid

---

## 1) Business problem

Manna needs a reliable way to track contractor/staff payouts tied to event operations, including:

- who was paid
- how much
- for which event/work assignment
- payment date
- payment method
- payout status
- notes
- optional evidence/receipt in a future phase
- impact on real event profitability and finance reporting

The solution must support operational workflows (events/staff execution) while remaining financially coherent.

---

## 2) Current system state

The platform already has:

- **People identity and access:** `profiles` + role/permission model.
- **Event staffing linkage:** `event_staff_assignments` with role/status and per-event person assignment.
- **Finance real expenses:** `financial_expenses` with approval workflow and finance permissions.
- **Financial traceability:** `financial_change_logs` for finance-side change history.
- **Employee operational review/bonus artifacts:** team leader bonus recommendation/review foundations, but not a general contractor payout ledger.

This means we have a strong base for event-linked labor operations, but no dedicated payout subledger yet.

---

## 3) Why `financial_expenses` alone is not enough

`financial_expenses` is useful for accounting-level expense capture and approvals, but it is not ideal as the only source for contractor payouts because:

1. It does not provide a first-class operational identity for payout entities (contractor payout domain object).
2. It can mix staff payouts with general operating expenses and weaken payout-specific analytics.
3. It lacks explicit payout semantics and workflow granularity by assignment/person context.
4. It is weaker for future compliance/export flows (e.g., contractor-centric reporting).

Conclusion: finance-only records are necessary but not sufficient for payout operations.

---

## 4) Options evaluated

### Option A — Use `financial_expenses` only

**Description:** represent contractor payouts only as expense rows (e.g., labor category).

**Pros**
- Minimal new schema.
- Immediate inclusion in finance reporting.
- Reuses existing approval and receipt pipeline.

**Cons**
- Payout semantics become implicit.
- Weaker contractor/assignment reporting.
- Higher risk of domain ambiguity (labor payout vs general expense).

---

### Option B — New isolated `contractor_payouts` table only

**Description:** dedicated payout table with profile/event/assignment context, without structured finance integration design.

**Pros**
- Clear payout domain model.
- Better staff-centric reporting.

**Cons**
- Risk of finance duplication if not integrated with finance canonical records.
- Can diverge from expense/profit reporting.

---

### Option C — Hybrid (Approved)

**Description:** create `contractor_payouts` as an operational payout subledger and integrate it in a controlled way with finance records (short term via `financial_expenses` references; long term via `financial_transactions` when ledger exists).

**Pros**
- Operational clarity + finance integration.
- Reduces duplication when source references are enforced.
- Future-proof for ledger migration.

**Cons**
- Slightly higher design complexity.
- Requires strict anti-duplication rules.

---

## 5) Approved decision

**Approved:** **Option C — Hybrid**.

- `contractor_payouts` will be the operational payout source for person/event/assignment context.
- Finance impact must be integrated through explicit source references.
- Short term: controlled relation/posting to `financial_expenses`.
- Long term: posting to `financial_transactions` once ledger is introduced.

---

## 6) Recommended architecture

### Domain entities and relationships

- `profiles` → identity of contractor/employee
- `event_staff_assignments` → operational assignment context
- `events` → event context
- `contractor_payouts` (new, future) → payout subledger record
- `financial_expenses` (current finance actual expenses) → short-term finance integration target
- `financial_transactions` (future) → long-term canonical ledger posting target

### Conceptual flow

1. Payout is created/managed in contractor payout domain (`contractor_payouts`).
2. Approval/payment transitions occur there first.
3. Finance integration is posted once per payout via explicit source reference.
4. Profitability reads a unified finance projection/actual model with anti-duplication controls.

---

## 7) Anti-duplication rules

1. Do not create duplicate employee/contractor records outside `profiles`.
2. Do not create duplicate event records outside `events`.
3. Do not register payout and independent expense in parallel without source references.
4. Each payout posted to finance must preserve lineage using `source_expense_id` (short term) or future source refs/idempotency keys (ledger phase).
5. Reporting should aggregate by lineage, not by loosely inferred category labels.

---

## 8) Proposed data model for `contractor_payouts` (design only)

> No schema implementation in this phase.

Suggested fields:

- `id` (uuid)
- `profile_id` (fk → `profiles.id`)
- `event_id` (fk → `events.id`, nullable only for non-event jobs if policy allows)
- `assignment_id` (fk → `event_staff_assignments.id`, optional but recommended)
- `amount` (numeric > 0)
- `currency` (initially `usd` aligned with current finance scope)
- `payout_date` (date/timestamptz)
- `payment_method` (enum-like text)
- `status` (enum-like text)
- `notes` (text)
- `source_expense_id` (fk → `financial_expenses.id`, nullable for staged posting)
- `created_by`, `updated_by`, `created_at`, `updated_at`

Suggested constraints (future):

- `amount > 0`
- cross-check: if `assignment_id` present, it must belong to `event_id`
- idempotency/unique posting reference for finance linkage

---

## 9) Recommended payout statuses

- `draft`
- `approved`
- `paid`
- `cancelled`
- `reversed`

Status intent:
- `draft`: captured but pending financial/ops confirmation
- `approved`: authorized for payment
- `paid`: disbursed
- `cancelled`: voided before disbursement
- `reversed`: payment reversed/corrected after disbursement

---

## 10) Recommended payment methods

- `cash`
- `zelle`
- `bank_transfer`
- `card`
- `other`

---

## 11) Recommended permissions (future additions)

- `finance.payouts.view`
- `finance.payouts.manage`
- `finance.payouts.approve`
- `finance.payouts.mark_paid`
- `employees.payouts.view`

Notes:
- These are additive recommendations; no current permission changes are part of this ADR.
- Existing finance permissions remain unchanged until implementation phase.

---

## 12) Implementation roadmap (post-ADR)

### 6B — Read model / read-only UI (if data exists)
- establish payout read contracts and reporting joins without mutating behavior

### 6C — Minimal schema
- introduce minimal `contractor_payouts` + constraints + references

### 6D — Register payout from Event context
- staff-assignment-driven payout capture workflow

### 6E — Finance integration
- include payouts in finance views/profitability with anti-duplication lineage

### 6F — Employee/contractor history
- payout history by contractor + date-range summaries

### 6G — Export/reporting
- prepare exports and operational/finance analytics for future compliance/reporting

---

## 13) Main risks

1. **Domain duplication risk:** payout records and finance expenses can diverge without strict source references.
2. **Permission boundary risk:** event ops and finance actions may overlap without explicit payout permission model.
3. **State drift risk:** payout status and finance posting status can desynchronize if transitions are not state-machine aligned.
4. **Reporting ambiguity:** labor payouts may be over/under-counted if lineage is category-only instead of reference-driven.

---

## 14) Pending decisions before implementation

1. Final policy for required `assignment_id` (mandatory vs optional by scenario).
2. Posting timing to finance (`approved` vs `paid`).
3. Reversal policy (`reversed`) and impact on profitability snapshots.
4. Currency strategy beyond current USD-first approach.
5. Idempotency standard for payout→finance posting.
6. Whether short-term integration writes to `financial_expenses` synchronously or via controlled posting job.

---

## Scope confirmation for this ADR

- No schema implementation done.
- No migrations created.
- No UI changes made.
- No functional logic changes made.
- Documentation-only deliverable.
