import { useState, useRef, useEffect, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Link,
  Box,
  InputAdornment,
  IconButton,
  Tabs,
  Tab,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useLogin, usePhoneLogin } from '@/hooks/useAuth';
import { sendSmsCode } from '@/api/auth';

const SMS_COUNTDOWN = 60;

export default function LoginPage() {
  const [tab, setTab] = useState(0);

  return (
    <Container maxWidth="sm" sx={{ mt: 12 }}>
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
          AI驱动的智能创作平台
        </Typography>
      </Box>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="fullWidth"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="邮箱登录" />
            <Tab label="手机号登录" />
          </Tabs>

          <Box sx={{ p: 4 }}>
            {tab === 0 ? <EmailLoginForm /> : <PhoneLoginForm />}

            <Typography variant="body2" align="center" color="text.secondary" sx={{ mt: 2 }}>
              还没有账号？{' '}
              <Link component={RouterLink} to="/register" underline="hover">
                立即注册
              </Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}

/** 邮箱密码登录表单 */
function EmailLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const loginMutation = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    loginMutation.mutate({ email, password });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
        邮箱登录
      </Typography>

      <TextField
        label="邮箱"
        type="email"
        fullWidth
        margin="normal"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        autoFocus
      />

      <TextField
        label="密码"
        type={showPassword ? 'text' : 'password'}
        fullWidth
        margin="normal"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
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

      <Box sx={{ textAlign: 'right', mt: 0.5 }}>
        <Link component={RouterLink} to="/forgot-password" variant="body2" underline="hover" color="text.secondary">
          忘记密码？
        </Link>
      </Box>

      <Button
        type="submit"
        variant="contained"
        fullWidth
        size="large"
        sx={{ mt: 3 }}
        disabled={loginMutation.isPending}
      >
        {loginMutation.isPending ? '登录中...' : '登录'}
      </Button>
    </form>
  );
}

/** 手机验证码登录表单 */
function PhoneLoginForm() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loginMutation = usePhoneLogin();

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 清理定时器
  useEffect(() => clearTimer, [clearTimer]);

  // 倒计时
  useEffect(() => {
    if (countdown <= 0) {
      clearTimer();
      return;
    }
    if (!timerRef.current) {
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) return 0;
          return c - 1;
        });
      }, 1000);
    }
  }, [countdown, clearTimer]);

  const handleSendCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) return;
    setSending(true);
    try {
      await sendSmsCode(phone);
      setCountdown(SMS_COUNTDOWN);
    } catch {
      // error handled by interceptor
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || code.length !== 6) return;
    loginMutation.mutate({ phone, code });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
        手机号登录
      </Typography>

      <TextField
        label="手机号"
        fullWidth
        margin="normal"
        value={phone}
        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
        required
        placeholder="请输入手机号"
        autoFocus
      />

      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <TextField
          label="验证码"
          fullWidth
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          required
          placeholder="6位验证码"
        />
        <Button
          variant="outlined"
          onClick={handleSendCode}
          disabled={!!countdown || sending || phone.length !== 11}
          sx={{ minWidth: 130, flexShrink: 0 }}
        >
          {countdown > 0 ? `${countdown}s后重发` : sending ? '发送中...' : '获取验证码'}
        </Button>
      </Box>

      <Button
        type="submit"
        variant="contained"
        fullWidth
        size="large"
        sx={{ mt: 3 }}
        disabled={loginMutation.isPending || code.length !== 6}
      >
        {loginMutation.isPending ? '登录中...' : '登录'}
      </Button>
    </form>
  );
}
