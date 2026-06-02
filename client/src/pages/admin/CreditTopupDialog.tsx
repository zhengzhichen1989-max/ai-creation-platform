import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
} from '@mui/material';
import { adminCreditTopup } from '@/api/admin';

interface Props {
  open: boolean;
  userId: number | null;
  userEmail: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreditTopupDialog({ open, userId, userEmail, onClose, onSuccess }: Props) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
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
      await adminCreditTopup(userId!, numAmount, description.trim());
      setAmount('');
      setDescription('');
      onSuccess();
      onClose();
    } catch {
      setError('充值失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setAmount('');
    setDescription('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>手动充值积分</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        <Typography variant="body2" color="text.secondary">
          目标用户: {userEmail}
        </Typography>
        <TextField
          label="充值积分数量"
          type="number"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setError(''); }}
          fullWidth
          size="small"
          helperText="单次上限 100,000 积分"
          inputProps={{ min: 1, max: 100000 }}
        />
        <TextField
          label="描述"
          value={description}
          onChange={(e) => { setDescription(e.target.value); setError(''); }}
          fullWidth
          size="small"
          multiline
          rows={2}
          inputProps={{ maxLength: 200 }}
          placeholder="请输入充值原因"
        />
        {error && (
          <Typography color="error" variant="body2">{error}</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>取消</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          {submitting ? '充值中...' : '确认充值'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
