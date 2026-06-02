import { useLocation, useNavigate } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Box,
  Divider,
} from '@mui/material';
import CreateIcon from '@mui/icons-material/Create';
import HistoryIcon from '@mui/icons-material/History';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import PersonIcon from '@mui/icons-material/Person';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useAuthStore } from '@/stores/auth.store';

interface SidebarProps {
  width: number;
}

const NAV_ITEMS = [
  { label: '工作台', path: '/workspace', icon: <CreateIcon /> },
  { label: '历史记录', path: '/history', icon: <HistoryIcon /> },
  { label: '积分充值', path: '/credits', icon: <AccountBalanceWalletIcon /> },
  { label: '个人中心', path: '/profile', icon: <PersonIcon /> },
];

const ADMIN_ITEM = {
  label: '管理后台',
  path: '/admin',
  icon: <AdminPanelSettingsIcon />,
};

export default function Sidebar({ width }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = useAuthStore((s) => s.isAdmin);

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width,
          boxSizing: 'border-box',
        },
      }}
    >
      <Toolbar sx={{ px: 2, gap: 1 }}>
        <AutoAwesomeIcon sx={{ color: 'primary.main', fontSize: 28 }} />
        <Typography variant="h6" noWrap sx={{ fontWeight: 700, color: 'primary.main' }}>
          AI创作平台
        </Typography>
      </Toolbar>

      <Divider />

      <List sx={{ px: 1, pt: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={isActive}
                onClick={() => navigate(item.path)}
                sx={{
                  borderRadius: 2,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: '#fff',
                    '&:hover': { bgcolor: 'primary.dark' },
                    '& .MuiListItemIcon-root': { color: '#fff' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          );
        })}

        {isAdmin && (
          <>
            <Divider sx={{ my: 1 }} />
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={location.pathname === ADMIN_ITEM.path}
                onClick={() => navigate(ADMIN_ITEM.path)}
                sx={{
                  borderRadius: 2,
                  '&.Mui-selected': {
                    bgcolor: 'secondary.main',
                    color: '#fff',
                    '&:hover': { bgcolor: 'secondary.dark' },
                    '& .MuiListItemIcon-root': { color: '#fff' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{ADMIN_ITEM.icon}</ListItemIcon>
                <ListItemText primary={ADMIN_ITEM.label} />
              </ListItemButton>
            </ListItem>
          </>
        )}
      </List>

      <Box sx={{ flexGrow: 1 }} />

      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          v1.0.0 MVP
        </Typography>
      </Box>
    </Drawer>
  );
}
