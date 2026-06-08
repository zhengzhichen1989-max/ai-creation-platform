import { Outlet } from 'react-router-dom';
import { Box, Toolbar } from '@mui/material';
import Sidebar from './Sidebar';
import Header from './Header';
import CustomerService from '../CustomerService/CustomerService';

const SIDEBAR_WIDTH = 240;

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
      </Box>
      {/* 客服微信悬浮按钮 */}
      <CustomerService />
    </Box>
  );
}
