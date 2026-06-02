import { Component, type ReactNode } from 'react';
import { Box, Typography, Paper, Button } from '@mui/material';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.href = '/';
  };

  handleClearStorage = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.toString() || '';
      const isReact130 = errorMsg.includes('#130');
      return (
        <Box sx={{ p: 4, maxWidth: 900, mx: 'auto', mt: 8 }}>
          <Paper sx={{ p: 4 }}>
            <Typography variant="h5" color="error" gutterBottom>
              页面渲染出错
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              应用程序遇到了一个错误。请尝试刷新页面或清除缓存后重试。
            </Typography>

            {isReact130 && (
              <Box sx={{ bgcolor: '#e3f2fd', p: 2, borderRadius: 1, mb: 2 }}>
                <Typography variant="body2" color="primary">
                  <strong>诊断提示：</strong>React Error #130 通常意味着某个组件导入失败（值为 undefined）。
                  请检查浏览器控制台(F12)查看更详细的错误信息。
                </Typography>
              </Box>
            )}

            <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 1, mb: 2, overflow: 'auto' }}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                {errorMsg}
              </Typography>
            </Box>

            {this.state.errorInfo && (
              <Box sx={{ bgcolor: '#fff3e0', p: 2, borderRadius: 1, mb: 2, overflow: 'auto', maxHeight: 400 }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                  组件堆栈:
                  {this.state.errorInfo.componentStack}
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Button variant="contained" onClick={this.handleReload}>
                刷新页面
              </Button>
              <Button variant="outlined" color="warning" onClick={this.handleClearStorage}>
                清除缓存并刷新
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}
