import { useState } from 'react';
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
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { register as registerApi, setSecurityQuestion as setSecurityQuestionApi } from '@/api/auth';
import { useAuthStore } from '@/stores/auth.store';
import { useSnackbarStore } from '@/stores/snackbar.store';

export default function RegisterPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Security question (optional, collapsible)
  const [showSecurityQuestion, setShowSecurityQuestion] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const passwordTooShort = password.length > 0 && password.length < 8;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !nickname) return;
    if (password !== confirmPassword) return;
    if (password.length < 8) return;

    setSubmitting(true);
    try {
      const data = await registerApi(email, password, nickname);
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
        <AutoAwesomeIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
        <Typography variant="h4" gutterBottom>
          AI创作聚合平台
        </Typography>
        <Typography variant="body2" color="text.secondary">
          创建账号，开启AI创作
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

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              sx={{ mt: 3, mb: 2 }}
              disabled={submitting || passwordMismatch || passwordTooShort}
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
