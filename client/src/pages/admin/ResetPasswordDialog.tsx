import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  IconButton,
  TextField,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { adminResetPassword } from '@/api/admin';

interface Props {
  open: boolean;
  userId: number | null;
  userEmail: string;
  onClose: () => void;
}

export default function ResetPasswordDialog({ open, userId, userEmail, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await adminResetPassword(userId!);
      const fullUrl = `${window.location.origin}${result.resetUrl}`;
      setResetUrl(fullUrl);
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(resetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  const handleClose = () => {
    setResetUrl('');
    setCopied(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>生成密码重置链接</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          目标用户: {userEmail}
        </Typography>

        {!resetUrl ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            点击下方按钮生成一次性密码重置链接，有效期30分钟。请将链接发送给用户。
          </Alert>
        ) : (
          <Box>
            <Alert severity="success" sx={{ mb: 2 }}>
              重置链接已生成！请复制后发送给用户。
            </Alert>
            <TextField
              label="重置链接"
              value={resetUrl}
              fullWidth
              size="small"
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <IconButton size="small" onClick={handleCopy} title="复制">
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                ),
              }}
            />
            {copied && (
              <Typography color="success.main" variant="body2" sx={{ mt: 1 }}>
                已复制到剪贴板
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{resetUrl ? '关闭' : '取消'}</Button>
        {!resetUrl && (
          <Button variant="contained" onClick={handleGenerate} disabled={loading}>
            {loading ? '生成中...' : '生成重置链接'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
