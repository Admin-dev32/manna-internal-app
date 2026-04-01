export interface InvoiceFormState {
  status: 'idle' | 'success' | 'error';
  message?: string;
}

export const initialInvoiceFormState: InvoiceFormState = {
  status: 'idle',
};
