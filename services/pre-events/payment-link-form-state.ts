export interface PreEventPaymentLinkFormState {
  status: 'idle' | 'success' | 'error';
  message?: string;
}

export const initialPreEventPaymentLinkFormState: PreEventPaymentLinkFormState = {
  status: 'idle',
};
