export interface PreEventFormState {
  status: 'idle' | 'success' | 'error';
  message?: string;
}

export const initialPreEventFormState: PreEventFormState = {
  status: 'idle',
};
