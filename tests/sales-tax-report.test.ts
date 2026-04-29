import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSalesTaxSupportDataset } from '../lib/finance/sales-tax-report.ts';

const invoices = [
  {
    id: 'inv-issued',
    invoice_number: 'INV-001',
    status: 'issued',
    taxable_amount: 100,
    non_taxable_amount: 0,
    tax_rate: 0.0825,
    tax_amount: 8.25,
    total_amount: 108.25,
    tax_jurisdiction: 'CA',
    tax_region: 'Los Angeles',
    tax_exemption_reason: null,
    issued_at: '2026-05-10T10:00:00Z',
    created_at: '2026-05-10T10:00:00Z',
  },
  {
    id: 'inv-draft',
    invoice_number: 'INV-002',
    status: 'draft',
    taxable_amount: 50,
    non_taxable_amount: 0,
    tax_rate: 0.0825,
    tax_amount: 4.13,
    total_amount: 54.13,
    tax_jurisdiction: 'CA',
    tax_region: 'Los Angeles',
    tax_exemption_reason: null,
    issued_at: null,
    created_at: '2026-05-11T10:00:00Z',
  },
  {
    id: 'inv-void',
    invoice_number: 'INV-003',
    status: 'void',
    taxable_amount: 40,
    non_taxable_amount: 0,
    tax_rate: 0.0825,
    tax_amount: 3.3,
    total_amount: 43.3,
    tax_jurisdiction: null,
    tax_region: null,
    tax_exemption_reason: null,
    issued_at: null,
    created_at: '2026-05-12T10:00:00Z',
  },
  {
    id: 'inv-backfill-like',
    invoice_number: 'INV-004',
    status: 'paid',
    taxable_amount: 0,
    non_taxable_amount: 200,
    tax_rate: 0,
    tax_amount: 0,
    total_amount: 200,
    tax_jurisdiction: null,
    tax_region: null,
    tax_exemption_reason: null,
    issued_at: '2026-05-13T10:00:00Z',
    created_at: '2026-05-13T10:00:00Z',
  },
] as const;

test('excludes draft and void by default', () => {
  const result = buildSalesTaxSupportDataset(invoices as never, {});
  assert.equal(result.rows.some((row) => row.status === 'draft'), false);
  assert.equal(result.rows.some((row) => row.status === 'void'), false);
  assert.equal(result.kpis.invoiceCount, 2);
});

test('calculates taxable/non-taxable/tax totals', () => {
  const result = buildSalesTaxSupportDataset(invoices as never, {});
  assert.equal(result.kpis.taxableSales, 100);
  assert.equal(result.kpis.nonTaxableSales, 200);
  assert.equal(result.kpis.taxAmount, 8.25);
  assert.equal(result.kpis.grossSales, 308.25);
});

test('groups by jurisdiction', () => {
  const result = buildSalesTaxSupportDataset(invoices as never, {});
  assert.equal(result.byJurisdiction.length >= 1, true);
  assert.equal(result.byJurisdiction.some((row) => row.key === 'CA'), true);
});

test('flags missing jurisdiction and zero tax but taxable sales', () => {
  const dataset = buildSalesTaxSupportDataset(
    [
      ...invoices,
      {
        id: 'inv-taxable-zero-tax',
        invoice_number: 'INV-005',
        status: 'issued',
        taxable_amount: 50,
        non_taxable_amount: 0,
        tax_rate: 0.0825,
        tax_amount: 0,
        total_amount: 50,
        tax_jurisdiction: null,
        tax_region: null,
        tax_exemption_reason: null,
        issued_at: '2026-05-15T10:00:00Z',
        created_at: '2026-05-15T10:00:00Z',
      },
    ] as never,
    {},
  );

  assert.equal(dataset.kpis.invoicesMissingJurisdiction >= 1, true);
  assert.equal(dataset.kpis.invoicesWithZeroTaxButTaxableSales >= 1, true);
});

test('flags historical backfill likely', () => {
  const result = buildSalesTaxSupportDataset(invoices as never, {});
  assert.equal(result.kpis.historicalBackfillLikelyCount, 1);
});

test('date range filtering supported', () => {
  const result = buildSalesTaxSupportDataset(invoices as never, { dateFrom: '2026-05-13', dateTo: '2026-05-13' });
  assert.equal(result.kpis.invoiceCount, 1);
  assert.equal(result.rows[0]!.invoiceNumber, 'INV-004');
});

test('does not use payments/payment_links as collected tax', () => {
  const result = buildSalesTaxSupportDataset(invoices as never, {});
  // Assertion focuses on invoice header tax_amount only.
  assert.equal(result.kpis.taxAmount, 8.25);
});
