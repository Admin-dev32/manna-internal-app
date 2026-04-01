export interface QuoteManualDeliveryFormState {
  status: 'idle' | 'success' | 'error';
  message: string;
}

export const initialQuoteManualDeliveryFormState: QuoteManualDeliveryFormState = {
  status: 'idle',
  message: '',
};
