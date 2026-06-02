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
import { forgotPassword, verifySecurityAnswer } from '@/api/auth';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 2: security question
  const [hasSecurityQuestion, setHasSecurityQuestion] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError('');
    try {
      const result = await forgotPassword(email);
      if (result.hasSecurityQuestion && result.question) {
        setHasSecurityQuestion(true);
        setQuestion(result.question);
      } else {
        setError('该账户未设置安全问题，请联系管理员重置密码');
      }
    } catch {
      setError('查询失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer) return;

    setLoading(true);
    setError('');
    try {
      const result = await verifySecurityAnswer(email, answer);
      // 跳转到重置密码页面
      navigate(`/reset-password?token=${result.token}`);
    } catch {
      setError('安全问题答案错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 10 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <AutoAwesomeIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
        <Typography variant="h4" gutterBottom>
          AI创作聚合平台
        </Typography>
        <Typography variant="body2" color="text.secondary">
          忘记密码
        </Typography>
      </Box>

      <Card>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
            找回密码
          </Typography>

          {!hasSecurityQuestion ? (
            <form onSubmit={handleCheckEmail}>
              <TextField
                label="注册邮箱"
                type="email"
                fullWidth
                margin="normal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
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
                {loading ? <CircularProgress size={24} /> : '查询安全问题'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyAnswer}>
              <Alert severity="info" sx={{ mb: 2 }}>
                安全问题: {question}
              </Alert>
              <TextField
                label="安全问题答案"
                fullWidth
                margin="normal"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                required
                autoFocus
              />
              {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                sx={{ mt: 3, mb: 2 }}
                disabled={loading || !answer}
              >
                {loading ? <CircularProgress size={24} /> : '验证答案'}
              </Button>
            </form>
          )}

          <Typography variant="body2" align="center" color="text.secondary" sx={{ mt: 1 }}>
            想起密码了？{' '}
            <Typography
              component="span"
              sx={{ cursor: 'pointer', color: 'primary.main', textDecoration: 'underline' }}
              onClick={() => navigate('/login')}
            >
              返回登录
            </Typography>
          </Typography>
        </CardContent>
      </Card>
    </Container>
  );
}
