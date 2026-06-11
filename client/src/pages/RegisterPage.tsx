import { useState, useRef, useEffect, useCallback } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
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
  Collapse,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { register as registerApi, setSecurityQuestion as setSecurityQuestionApi, sendSmsCode } from '@/api/auth';
import { useAuthStore } from '@/stores/auth.store';
import { useSnackbarStore } from '@/stores/snackbar.store';

const SMS_COUNTDOWN = 60;

export default function RegisterPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Security question (optional, collapsible)
  const [showSecurityQuestion, setShowSecurityQuestion] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const passwordTooShort = password.length > 0 && password.length < 8;

  // SMS countdown timer
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

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
      const result = await sendSmsCode(phone);
      setCountdown(SMS_COUNTDOWN);
      // 开发环境下自动填充验证码
      if (result.devCode) {
        setSmsCode(result.devCode);
        showSnackbar(`验证码已自动填充（开发模式）`, 'info');
      }
    } catch {
      // error handled by interceptor
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !nickname || !phone || smsCode.length !== 6) return;
    if (password !== confirmPassword) return;
    if (password.length < 8) return;

    setSubmitting(true);
    try {
      const data = await registerApi(email, password, nickname, phone, smsCode);
      login(data.accessToken, data.refreshToken, data.user);

      // If security question is filled, set it after registration
      if (showSecurityQuestion && securityQuestion.trim() && securityAnswer.trim()) {
        try {
          await setSecurityQuestionApi(securityQuestion.trim(), securityAnswer.trim());
        } catch {
          // Security question setting failed, but registration succeeded
          showSnackbar('注册成功，但安全问题设置失败', 'warning');
          navigate('/workspace');
          return;
        }
      }

      showSnackbar('注册成功', 'success');
      navigate('/workspace');
    } catch {
      // error handled by apiClient interceptor
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
          创建账号，开启智能创作
        </Typography>
      </Box>

      <Card>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
            注册
          </Typography>

          <form onSubmit={handleSubmit}>
            <TextField
              label="昵称"
              fullWidth
              margin="normal"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              autoFocus
            />

            <TextField
              label="邮箱"
              type="email"
              fullWidth
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <TextField
              label="密码"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              label="确认密码"
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

            {/* 手机号实名验证（必填） */}
            <TextField
              label="手机号（实名验证）"
              fullWidth
              margin="normal"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
              required
              placeholder="请输入手机号"
            />

            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <TextField
                label="短信验证码"
                fullWidth
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
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

            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              根据国家相关规定，注册需完成手机号实名验证
            </Typography>

            {/* 安全问题（可选，折叠） */}
            <Box sx={{ mt: 2 }}>
              <Button
                size="small"
                onClick={() => setShowSecurityQuestion(!showSecurityQuestion)}
                endIcon={showSecurityQuestion ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                sx={{ textTransform: 'none' }}
              >
                设置安全问题（可选，用于找回密码）
              </Button>
              <Collapse in={showSecurityQuestion}>
                <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="安全问题"
                    fullWidth
                    size="small"
                    value={securityQuestion}
                    onChange={(e) => setSecurityQuestion(e.target.value)}
                    placeholder="如：您的宠物叫什么？"
                    helperText="设置后可用于自助重置密码"
                  />
                  <TextField
                    label="安全问题答案"
                    fullWidth
                    size="small"
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    placeholder="请输入答案"
                  />
                </Box>
              </Collapse>
            </Box>

            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2" color="text.secondary">
                    我已阅读并同意
                    <Link component={RouterLink} to="/terms" target="_blank" underline="hover" sx={{ mx: 0.5 }}>
                      《服务协议》
                    </Link>
                    与
                    <Link component={RouterLink} to="/privacy" target="_blank" underline="hover" sx={{ mx: 0.5 }}>
                      《隐私政策》
                    </Link>
                    ，承诺不利用本平台从事任何违法违规活动。
                  </Typography>
                }
              />
            </Box>

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              sx={{ mt: 1, mb: 2 }}
              disabled={submitting || passwordMismatch || passwordTooShort || phone.length !== 11 || smsCode.length !== 6 || !agreed}
            >
              {submitting ? '注册中...' : '注册'}
            </Button>
          </form>

          <Typography variant="body2" align="center" color="text.secondary">
            已有账号？{' '}
            <Link component={RouterLink} to="/login" underline="hover">
              立即登录
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Container>
  );
}
