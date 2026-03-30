export interface QuoteFormState {
  status: 'idle' | 'success' | 'error';
  message?: string;
}

export const initialQuoteFormState: QuoteFormState = {
  status: 'idle',
};
