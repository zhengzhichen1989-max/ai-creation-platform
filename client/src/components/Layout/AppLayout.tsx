import { Outlet } from 'react-router-dom';
import { Box, Toolbar } from '@mui/material';
import Sidebar from './Sidebar';
import Header from './Header';
import CustomerService from '../CustomerService/CustomerService';

const SIDEBAR_WIDTH = 240;

function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        py: 2,
        px: 3,
        textAlign: 'center',
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        component="a"
        href="https://beian.mps.gov.cn/#/query/webSearch?code=44011202004009"
        rel="noreferrer"
        target="_blank"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          textDecoration: 'none',
          color: 'text.secondary',
          fontSize: 12,
          '&:hover': { color: 'text.primary' },
        }}
      >
        <Box
          component="img"
          src="/beian-icon.png"
          alt="备案图标"
          sx={{ width: 16, height: 16, display: 'block' }}
        />
        <span>粤公网安备44011202004009号</span>
      </Box>
    </Box>
  );
}

export default function AppLayout() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Sidebar width={SIDEBAR_WIDTH} />
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Header sidebarWidth={SIDEBAR_WIDTH} />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
          }}
        >
          {/* Toolbar spacer for the fixed AppBar */}
          <Toolbar />
          <Outlet />
        </Box>
        <Footer />
      </Box>
      {/* 客服微信悬浮按钮 */}
      <CustomerService />
    </Box>
  );
}
