export interface PreEventCalendarSyncFormState {
  status: 'idle' | 'success' | 'error';
  message?: string;
}

export const initialPreEventCalendarSyncFormState: PreEventCalendarSyncFormState = {
  status: 'idle',
};
