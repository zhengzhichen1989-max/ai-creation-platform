import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Box,
  InputAdornment,
  IconButton,
  Alert,
  CircularProgress,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { resetPassword } from '@/api/auth';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const passwordTooShort = newPassword.length > 0 && newPassword.length < 8;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('缺少重置Token，请从重置链接进入');
      return;
    }
    if (passwordTooShort || passwordMismatch) return;

    setSubmitting(true);
    setError('');
    try {
      await resetPassword(token, newPassword);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch {
      setError('密码重置失败，链接可能已过期或已使用');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 10 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Box
          component="img"
          src="/logo.png"
          alt="智影工厂"
          sx={{ height: 64, width: 64, objectFit: 'contain', mb: 1 }}
        />
        <Typography variant="h4" gutterBottom>
          智影工厂
        </Typography>
        <Typography variant="body2" color="text.secondary">
          重置密码
        </Typography>
      </Box>

      <Card>
        <CardContent sx={{ p: 4 }}>
          {success ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Alert severity="success" sx={{ mb: 2 }}>
                密码重置成功！即将跳转到登录页面...
              </Alert>
              <Button variant="contained" onClick={() => navigate('/login')}>
                立即登录
              </Button>
            </Box>
          ) : (
            <>
              <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                设置新密码
              </Typography>

              {!token && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  缺少重置Token，请从重置链接进入
                </Alert>
              )}

              <form onSubmit={handleSubmit}>
                <TextField
                  label="新密码"
                  type={showPassword ? 'text' : 'password'}
                  fullWidth
                  margin="normal"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  error={passwordTooShort}
                  helperText={passwordTooShort ? '密码至少8位' : ''}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                          {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  label="确认新密码"
                  type={showPassword ? 'text' : 'password'}
                  fullWidth
                  margin="normal"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  error={passwordMismatch}
                  helperText={passwordMismatch ? '两次输入的密码不一致' : ''}
                />

                {error && (
                  <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
                )}

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  sx={{ mt: 3, mb: 2 }}
                  disabled={submitting || passwordMismatch || passwordTooShort || !token}
                >
                  {submitting ? <CircularProgress size={24} /> : '重置密码'}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
