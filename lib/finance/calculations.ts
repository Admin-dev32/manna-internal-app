import type {
  EditableFinancialExpense,
  FinancialCalculationSummary,
  FinancialPercentageBase,
} from '@/types/finance';

function toFiniteNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return 0;

  const normalized = typeof value === 'string' ? value.replace(/,/g, '').trim() : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNonNegativeNumber(value: number | string | null | undefined) {
  return Math.max(toFiniteNumber(value), 0);
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function resolveFinancialBaseAmount(base: FinancialPercentageBase | null, amounts: { grossRevenue: number; baseAfterTax: number; afterTaxAndCommission: number }) {
  if (base === 'after_tax') return amounts.baseAfterTax;
  if (base === 'after_tax_and_commission') return amounts.afterTaxAndCommission;
  return amounts.grossRevenue;
}

export function calculateFinancialSummary(input: {
  grossRevenue: number | string | null | undefined;
  taxReservePercentage: number | string | null | undefined;
  salesCommissionPercentage: number | string | null | undefined;
  expenses: EditableFinancialExpense[];
}): FinancialCalculationSummary {
  const grossRevenue = roundCurrency(toNonNegativeNumber(input.grossRevenue));
  const taxReservePercentage = toNonNegativeNumber(input.taxReservePercentage);
  const taxReserve = roundCurrency(grossRevenue * (taxReservePercentage / 100));
  const baseAfterTax = roundCurrency(grossRevenue - taxReserve);
  const salesCommissionPercentage = toNonNegativeNumber(input.salesCommissionPercentage);
  const salesCommission = roundCurrency(baseAfterTax * (salesCommissionPercentage / 100));
  const afterTaxAndCommission = roundCurrency(baseAfterTax - salesCommission);

  const expenses = input.expenses.map((expense) => {
    const rawValue = toFiniteNumber(expense.value);
    const baseAmount =
      expense.expense_type === 'percentage'
        ? resolveFinancialBaseAmount(expense.calculation_base, {
            grossRevenue,
            baseAfterTax,
            afterTaxAndCommission,
          })
        : null;

    const amount =
      expense.expense_type === 'percentage'
        ? roundCurrency((baseAmount ?? 0) * (rawValue / 100))
        : roundCurrency(rawValue);

    return {
      id: expense.id,
      name: expense.name.trim(),
      amount,
      baseAmount,
      expenseType: expense.expense_type,
      calculationBase: expense.calculation_base,
      note: expense.note,
    };
  });

  const totalExtraExpenses = roundCurrency(expenses.reduce((sum, expense) => sum + expense.amount, 0));
  const netProfit = roundCurrency(grossRevenue - taxReserve - salesCommission - totalExtraExpenses);

  return {
    grossRevenue,
    taxReservePercentage,
    taxReserve,
    baseAfterTax,
    salesCommissionPercentage,
    salesCommission,
    totalExtraExpenses,
    netProfit,
    expenses,
  };
}
