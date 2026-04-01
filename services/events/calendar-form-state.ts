export interface EventCalendarSyncFormState {
  status: 'idle' | 'success' | 'error';
  message?: string;
}

export const initialEventCalendarSyncFormState: EventCalendarSyncFormState = {
  status: 'idle',
};
