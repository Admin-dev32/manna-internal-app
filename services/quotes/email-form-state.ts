export interface QuoteEmailFormState {
  status: 'idle' | 'success' | 'error';
  message?: string;
}

export const initialQuoteEmailFormState: QuoteEmailFormState = {
  status: 'idle',
};
