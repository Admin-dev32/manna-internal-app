export interface EmployeeActionFormState {
  status: 'idle' | 'success' | 'error';
  message?: string;
}

export const initialEmployeeActionFormState: EmployeeActionFormState = {
  status: 'idle',
};
