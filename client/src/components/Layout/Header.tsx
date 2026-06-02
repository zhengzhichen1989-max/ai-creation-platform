import { AppBar, Toolbar, Typography, IconButton, Box, Chip } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useCurrentUser, useLogout } from '@/hooks/useAuth';
import { useBalance } from '@/hooks/useCredits';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  sidebarWidth: number;
}

export default function Header({ sidebarWidth }: HeaderProps) {
  const user = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const { data: balanceData } = useBalance();

  const balance = balanceData?.balance ?? 0;

  return (
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

        {/* Logout */}
        <IconButton onClick={logout} title="退出登录" size="small">
          <LogoutIcon fontSize="small" />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
