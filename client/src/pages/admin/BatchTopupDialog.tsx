import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import { adminBatchTopup } from '@/api/admin';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BatchTopupDialog({ open, onClose, onSuccess: _onSuccess }: Props) {
  const [userIdsText, setUserIdsText] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ successCount: number; failCount: number } | null>(null);

  const handleSubmit = async () => {
    const userIds = userIdsText
      .split(/[,，\s\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => parseInt(s, 10))
      .filter((n) => !isNaN(n));

    if (userIds.length === 0) {
      setError('请输入至少一个用户ID');
      return;
    }
    if (userIds.length > 50) {
      setError('单次最多50个用户');
      return;
    }

    const numAmount = parseInt(amount, 10);
    if (!numAmount || numAmount <= 0) {
      setError('请输入有效的充值金额');
      return;
    }
    if (numAmount > 100000) {
      setError('单次充值上限100,000积分');
      return;
    }
    if (!description.trim()) {
      setError('请输入描述');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await adminBatchTopup(userIds, numAmount, description.trim());
      setResult(res);
    } catch {
      setError('批量充值失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setUserIdsText('');
    setAmount('');
    setDescription('');
    setError('');
    setResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>批量充值积分</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        {result ? (
          <Alert severity="success">
            批量充值完成！成功: {result.successCount} 人，失败: {result.failCount} 人
          </Alert>
        ) : (
          <>
            <TextField
              label="用户ID列表"
              value={userIdsText}
              onChange={(e) => { setUserIdsText(e.target.value); setError(''); }}
              fullWidth
              size="small"
              multiline
              rows={3}
              placeholder="多个ID用逗号、空格或换行分隔，如: 2, 3, 5"
              helperText="单次最多50个用户"
            />
            <TextField
              label="每人充值积分"
              type="number"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(''); }}
              fullWidth
              size="small"
              inputProps={{ min: 1, max: 100000 }}
              helperText="单次上限 100,000 积分"
            />
            <TextField
              label="描述"
              value={description}
              onChange={(e) => { setDescription(e.target.value); setError(''); }}
              fullWidth
              size="small"
              multiline
              rows={2}
              placeholder="请输入充值原因"
            />
          </>
        )}
        {error && (
          <Typography color="error" variant="body2">{error}</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{result ? '关闭' : '取消'}</Button>
        {!result && (
          <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '充值中...' : '确认批量充值'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
