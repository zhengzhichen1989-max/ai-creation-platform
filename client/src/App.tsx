import { Snackbar, Alert } from '@mui/material';
import AppRouter from './router';
import { useSnackbarStore } from '@/stores/snackbar.store';

export default function App() {
  const { open, message, severity, hideSnackbar } = useSnackbarStore();

  return (
    <>
      <AppRouter />
      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={hideSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={hideSnackbar} severity={severity} variant="filled" sx={{ width: '100%' }}>
          {message}
        </Alert>
      </Snackbar>
    </>
  );
}
