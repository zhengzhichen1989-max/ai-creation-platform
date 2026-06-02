import { create } from 'zustand';

type Severity = 'success' | 'info' | 'warning' | 'error';

interface SnackbarState {
  open: boolean;
  message: string;
  severity: Severity;
  showSnackbar: (message: string, severity?: Severity) => void;
  hideSnackbar: () => void;
}

export const useSnackbarStore = create<SnackbarState>()((set) => ({
  open: false,
  message: '',
  severity: 'info',

  showSnackbar: (message, severity = 'info') =>
    set({ open: true, message, severity }),

  hideSnackbar: () =>
    set({ open: false, message: '', severity: 'info' }),
}));
