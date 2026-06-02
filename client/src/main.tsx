import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, CssBaseline } from '@mui/material';
import App from './App';
import { theme } from './theme';
import { ErrorBoundary } from './components/ErrorBoundary';
import '@/styles/globals.css';

// Global error handler to catch unhandled JS errors
window.onerror = (message, source, lineno, colno, error) => {
  console.error('Global error:', { message, source, lineno, colno, error });
  // Show error in the root div if React hasn't rendered yet
  const root = document.getElementById('root');
  if (root && root.children.length === 0) {
    root.innerHTML = `
      <div style="padding: 32px; max-width: 800px; margin: 64px auto; font-family: sans-serif;">
        <h2 style="color: #d32f2f;">JavaScript 运行时错误</h2>
        <p>页面加载过程中出现错误：</p>
        <pre style="background: #f5f5f5; padding: 16px; border-radius: 8px; overflow: auto; white-space: pre-wrap;">${error?.stack || message}\n\nat ${source}:${lineno}:${colno}</pre>
        <button onclick="localStorage.clear(); location.href='/';" style="margin-top: 16px; padding: 8px 24px; cursor: pointer;">清除缓存并刷新</button>
      </div>
    `;
  }
};

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
