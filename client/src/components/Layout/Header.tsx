import { useState } from 'react';
import { AppBar, Toolbar, Typography, IconButton, Box, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Alert, Snackbar } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import LockIcon from '@mui/icons-material/Lock';
import { useCurrentUser, useLogout } from '@/hooks/useAuth';
import { useBalance } from '@/hooks/useCredits';
import { useNavigate } from 'react-router-dom';
import { changePassword } from '@/api/auth';

interface HeaderProps {
  sidebarWidth: number;
}

export default function Header({ sidebarWidth }: HeaderProps) {
  const user = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const { data: balanceData } = useBalance();

  const balance = balanceData?.balance ?? 0;

  // 修改密码弹窗状态
  const [pwdDialogOpen, setPwdDialogOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleChangePassword = async () => {
    setError('');

    if (!oldPassword) {
      setError('请输入旧密码');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setError('新密码至少8位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    if (oldPassword === newPassword) {
      setError('新密码不能与旧密码相同');
      return;
    }

    setLoading(true);
    try {
      await changePassword(oldPassword, newPassword);
      setPwdDialogOpen(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setSuccessMsg('密码修改成功');
    } catch (err: any) {
      const msg = err?.response?.data?.message || '密码修改失败，请检查旧密码是否正确';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDialog = () => {
    if (!loading) {
      setPwdDialogOpen(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
    }
  };

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: `calc(100% - ${sidebarWidth}px)`,
          ml: `${sidebarWidth}px`,
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ justifyContent: 'flex-end', gap: 2 }}>
          {/* Credit balance chip */}
          <Chip
            icon={<AccountBalanceWalletIcon />}
            label={`${balance} 积分`}
            color="primary"
            variant="outlined"
            clickable
            onClick={() => navigate('/credits')}
            sx={{ fontWeight: 600 }}
          />

          {/* User info */}
          <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500 }}>
            {user?.nickname || user?.email || '用户'}
          </Typography>

          {/* Change password */}
          <IconButton onClick={() => setPwdDialogOpen(true)} title="修改密码" size="small">
            <LockIcon fontSize="small" />
          </IconButton>

          {/* Logout */}
          <IconButton onClick={logout} title="退出登录" size="small">
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* 修改密码弹窗 */}
      <Dialog open={pwdDialogOpen} onClose={handleCloseDialog} maxWidth="xs" fullWidth>
        <DialogTitle>修改密码</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
          <TextField
            label="旧密码"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            fullWidth
            size="small"
            autoComplete="current-password"
          />
          <TextField
            label="新密码"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            fullWidth
            size="small"
            helperText="至少8位"
            autoComplete="new-password"
          />
          <TextField
            label="确认新密码"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            fullWidth
            size="small"
            autoComplete="new-password"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialog} disabled={loading}>取消</Button>
          <Button onClick={handleChangePassword} variant="contained" disabled={loading}>
            {loading ? '提交中...' : '确认修改'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 成功提示 */}
      <Snackbar
        open={!!successMsg}
        autoHideDuration={3000}
        onClose={() => setSuccessMsg('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSuccessMsg('')} sx={{ width: '100%' }}>
          {successMsg}
        </Alert>
      </Snackbar>
    </>
  );
}
