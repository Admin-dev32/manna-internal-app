import type { InvoiceStatus } from '@/types/invoices';

function asNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeKey(value: string | null | undefined, fallback: string) {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : fallback;
}

export interface SalesTaxReportFilters {
  dateFrom?: string | null;
  dateTo?: string | null;
  status?: InvoiceStatus | 'all' | null;
  jurisdiction?: string | null;
  region?: string | null;
}

export interface SalesTaxInvoiceRow {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  reportDate: string;
  taxableSales: number;
  nonTaxableSales: number;
  taxRate: number;
  taxAmount: number;
  grossSales: number;
  jurisdiction: string | null;
  region: string | null;
  exemptionReason: string | null;
}

export interface SalesTaxKpis {
  invoiceCount: number;
  taxableSales: number;
  nonTaxableSales: number;
  taxAmount: number;
  grossSales: number;
  averageTaxRate: number;
  invoicesMissingJurisdiction: number;
  invoicesWithZeroTaxButTaxableSales: number;
  invoicesWithTaxAmountButNoJurisdiction: number;
  historicalBackfillLikelyCount: number;
}

export interface SalesTaxBreakdownRow {
  key: string;
  invoiceCount: number;
  taxableSales: number;
  nonTaxableSales: number;
  taxAmount: number;
  grossSales: number;
}

export interface SalesTaxReportDataset {
  rows: SalesTaxInvoiceRow[];
  kpis: SalesTaxKpis;
  byJurisdiction: SalesTaxBreakdownRow[];
  byRegion: SalesTaxBreakdownRow[];
  byTaxRate: SalesTaxBreakdownRow[];
  byStatus: SalesTaxBreakdownRow[];
}

export interface SalesTaxSourceInvoice {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  taxable_amount: number | string;
  non_taxable_amount: number | string;
  tax_rate: number | string;
  tax_amount: number | string;
  total_amount: number | string;
  tax_jurisdiction: string | null;
  tax_region: string | null;
  tax_exemption_reason: string | null;
  issued_at: string | null;
  created_at: string;
}

function makeBreakdown(rows: SalesTaxInvoiceRow[], keySelector: (row: SalesTaxInvoiceRow) => string) {
  const grouped = new Map<string, SalesTaxBreakdownRow>();
  for (const row of rows) {
    const key = keySelector(row);
    const current = grouped.get(key) ?? {
      key,
      invoiceCount: 0,
      taxableSales: 0,
      nonTaxableSales: 0,
      taxAmount: 0,
      grossSales: 0,
    };

    current.invoiceCount += 1;
    current.taxableSales = Math.round((current.taxableSales + row.taxableSales) * 100) / 100;
    current.nonTaxableSales = Math.round((current.nonTaxableSales + row.nonTaxableSales) * 100) / 100;
    current.taxAmount = Math.round((current.taxAmount + row.taxAmount) * 100) / 100;
    current.grossSales = Math.round((current.grossSales + row.grossSales) * 100) / 100;

    grouped.set(key, current);
  }

  return [...grouped.values()].sort((a, b) => b.grossSales - a.grossSales);
}

export function buildSalesTaxSupportDataset(sourceInvoices: SalesTaxSourceInvoice[], filters: SalesTaxReportFilters = {}): SalesTaxReportDataset {
  const effectiveStatusFilter = filters.status && filters.status !== 'all' ? filters.status : null;

  const rows = sourceInvoices
    .filter((invoice) => (effectiveStatusFilter ? invoice.status === effectiveStatusFilter : invoice.status !== 'draft' && invoice.status !== 'void'))
    .map((invoice) => {
      const reportDate = String(invoice.issued_at ?? invoice.created_at).slice(0, 10);
      return {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        status: invoice.status,
        reportDate,
        taxableSales: asNumber(invoice.taxable_amount),
        nonTaxableSales: asNumber(invoice.non_taxable_amount),
        taxRate: asNumber(invoice.tax_rate),
        taxAmount: asNumber(invoice.tax_amount),
        grossSales: asNumber(invoice.total_amount),
        jurisdiction: invoice.tax_jurisdiction,
        region: invoice.tax_region,
        exemptionReason: invoice.tax_exemption_reason,
      } satisfies SalesTaxInvoiceRow;
    })
    .filter((row) => !filters.dateFrom || row.reportDate >= filters.dateFrom)
    .filter((row) => !filters.dateTo || row.reportDate <= filters.dateTo)
    .filter((row) => !filters.jurisdiction || safeKey(row.jurisdiction, '') === safeKey(filters.jurisdiction, ''))
    .filter((row) => !filters.region || safeKey(row.region, '') === safeKey(filters.region, ''));

  const invoiceCount = rows.length;
  const taxableSales = Math.round(rows.reduce((sum, row) => sum + row.taxableSales, 0) * 100) / 100;
  const nonTaxableSales = Math.round(rows.reduce((sum, row) => sum + row.nonTaxableSales, 0) * 100) / 100;
  const taxAmount = Math.round(rows.reduce((sum, row) => sum + row.taxAmount, 0) * 100) / 100;
  const grossSales = Math.round(rows.reduce((sum, row) => sum + row.grossSales, 0) * 100) / 100;

  const invoicesMissingJurisdiction = rows.filter((row) => !safeKey(row.jurisdiction, '')).length;
  const invoicesWithZeroTaxButTaxableSales = rows.filter((row) => row.taxableSales > 0 && row.taxAmount === 0).length;
  const invoicesWithTaxAmountButNoJurisdiction = rows.filter((row) => row.taxAmount > 0 && !safeKey(row.jurisdiction, '')).length;
  const historicalBackfillLikelyCount = rows.filter((row) => row.taxableSales === 0 && row.taxAmount === 0 && row.nonTaxableSales === row.grossSales).length;

  const averageTaxRate = taxableSales > 0 ? Math.round((taxAmount / taxableSales) * 1000000) / 1000000 : 0;

  return {
    rows,
    kpis: {
      invoiceCount,
      taxableSales,
      nonTaxableSales,
      taxAmount,
      grossSales,
      averageTaxRate,
      invoicesMissingJurisdiction,
      invoicesWithZeroTaxButTaxableSales,
      invoicesWithTaxAmountButNoJurisdiction,
      historicalBackfillLikelyCount,
    },
    byJurisdiction: makeBreakdown(rows, (row) => safeKey(row.jurisdiction, 'Unknown jurisdiction')),
    byRegion: makeBreakdown(rows, (row) => safeKey(row.region, 'Unknown region')),
    byTaxRate: makeBreakdown(rows, (row) => `${(row.taxRate * 100).toFixed(2)}%`),
    byStatus: makeBreakdown(rows, (row) => row.status),
  };
}
