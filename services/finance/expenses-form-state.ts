export interface FinancialExpenseActionState {
  status: 'idle' | 'success' | 'error';
  message?: string;
}

export const initialFinancialExpenseActionState: FinancialExpenseActionState = {
  status: 'idle',
};
