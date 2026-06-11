import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EmailIcon from '@mui/icons-material/Email';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { forgotPassword } from '@/api/auth';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError('');
    try {
      await forgotPassword(email);
      setSent(true);
    } catch {
      setError('请求失败，请稍后重试');
    } finally {
      setLoading(false);
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
          找回密码
        </Typography>
      </Box>

      <Card>
        <CardContent sx={{ p: 4 }}>
          {sent ? (
            // ✅ 发送成功状态
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h5" gutterBottom>
                邮件已发送
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 1 }}>
                重置链接已发送至
              </Typography>
              <Typography variant="body1" fontWeight={600} sx={{ mb: 3 }}>
                {email}
              </Typography>
              <Alert severity="info" sx={{ textAlign: 'left', mb: 3 }}>
                请查收邮件并点击链接重置密码，链接 <strong>30分钟内有效</strong>。如未收到，请检查垃圾邮件箱。
              </Alert>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => setSent(false)}
                sx={{ mb: 1 }}
              >
                重新发送
              </Button>
              <Button
                variant="text"
                fullWidth
                onClick={() => navigate('/login')}
              >
                返回登录
              </Button>
            </Box>
          ) : (
            // 📧 输入邮箱表单
            <>
              <Typography variant="h5" gutterBottom sx={{ mb: 1 }}>
                找回密码
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                输入注册邮箱，我们将向您发送密码重置链接
              </Typography>

              <form onSubmit={handleSubmit}>
                <TextField
                  label="注册邮箱"
                  type="email"
                  fullWidth
                  margin="normal"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  InputProps={{
                    startAdornment: (
                      <Box component="span" sx={{ mr: 1, color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
                        <EmailIcon fontSize="small" />
                      </Box>
                    ),
                  }}
                />

                {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  sx={{ mt: 3, mb: 2 }}
                  disabled={loading || !email}
                >
                  {loading ? <CircularProgress size={24} /> : '发送重置链接'}
                </Button>
              </form>

              <Typography variant="body2" align="center" color="text.secondary">
                想起密码了？{' '}
                <Typography
                  component="span"
                  sx={{ cursor: 'pointer', color: 'primary.main', textDecoration: 'underline' }}
                  onClick={() => navigate('/login')}
                >
                  返回登录
                </Typography>
              </Typography>
            </>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
