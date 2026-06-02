import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  TextField,
  MenuItem,
  TablePagination,
  IconButton,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import {
  adminListUsers,
  adminUpdateUserStatus,
  type AdminUserListItem,
} from '@/api/admin';
import UserDetailDialog from './UserDetailDialog';
import CreditTopupDialog from './CreditTopupDialog';
import ResetPasswordDialog from './ResetPasswordDialog';
import TransactionListDialog from './TransactionListDialog';
import BatchTopupDialog from './BatchTopupDialog';

export default function UserListTab() {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(false);

  // Dialog states
  const [detailOpen, setDetailOpen] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminListUsers({
        page,
        pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
        role: roleFilter || undefined,
      });
      setUsers(result.items);
      setTotal(result.total);
    } catch {
      // error handled by apiClient interceptor
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleStatus = async (user: AdminUserListItem) => {
    const newStatus = user.status === 'active' ? 'disabled' : 'active';
    try {
      await adminUpdateUserStatus(user.id, newStatus);
      fetchUsers();
    } catch {
      // error handled by interceptor
    }
  };

  const openDialog = (type: 'detail' | 'topup' | 'reset' | 'transaction', user: AdminUserListItem) => {
    setSelectedUserId(user.id);
    setSelectedUser(user);
    switch (type) {
      case 'detail': setDetailOpen(true); break;
      case 'topup': setTopupOpen(true); break;
      case 'reset': setResetOpen(true); break;
      case 'transaction': setTransactionOpen(true); break;
    }
  };

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6">用户管理</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setBatchOpen(true)}>
          批量充值
        </Button>
      </Box>

      {/* 筛选栏 */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          label="搜索邮箱/昵称"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          size="small"
          sx={{ minWidth: 200 }}
        />
        <TextField
          label="状态"
          select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          size="small"
          sx={{ minWidth: 120 }}
        >
          <MenuItem value="">全部</MenuItem>
          <MenuItem value="active">正常</MenuItem>
          <MenuItem value="disabled">禁用</MenuItem>
        </TextField>
        <TextField
          label="角色"
          select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          size="small"
          sx={{ minWidth: 120 }}
        >
          <MenuItem value="">全部</MenuItem>
          <MenuItem value="admin">管理员</MenuItem>
          <MenuItem value="user">用户</MenuItem>
        </TextField>
      </Box>

      {/* 用户表格 */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>邮箱</TableCell>
              <TableCell>昵称</TableCell>
              <TableCell>角色</TableCell>
              <TableCell>状态</TableCell>
              <TableCell align="right">积分余额</TableCell>
              <TableCell>注册时间</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.id}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.nickname}</TableCell>
                  <TableCell>
                    <Chip
                      label={user.role === 'admin' ? '管理员' : '用户'}
                      color={user.role === 'admin' ? 'primary' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.status === 'active' ? '正常' : '禁用'}
                      color={user.status === 'active' ? 'success' : 'error'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">{user.creditBalance}</TableCell>
                  <TableCell>{new Date(user.createdAt).toLocaleString()}</TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => openDialog('detail', user)} title="详情">
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                    <Button size="small" onClick={() => openDialog('topup', user)}>充值</Button>
                    <Button size="small" onClick={() => openDialog('reset', user)}>重置密码</Button>
                    <Button size="small" onClick={() => openDialog('transaction', user)}>流水</Button>
                    <Button
                      size="small"
                      color={user.status === 'active' ? 'error' : 'success'}
                      disabled={user.role === 'admin'}
                      onClick={() => handleToggleStatus(user)}
                    >
                      {user.status === 'active' ? '禁用' : '启用'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
            {!loading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  暂无数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={total}
        page={page - 1}
        onPageChange={(_, p) => setPage(p + 1)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }}
        rowsPerPageOptions={[10, 20, 50]}
      />

      {/* Dialogs */}
      <UserDetailDialog
        open={detailOpen}
        userId={selectedUserId}
        onClose={() => setDetailOpen(false)}
      />
      <CreditTopupDialog
        open={topupOpen}
        userId={selectedUserId}
        userEmail={selectedUser?.email || ''}
        onClose={() => setTopupOpen(false)}
        onSuccess={fetchUsers}
      />
      <ResetPasswordDialog
        open={resetOpen}
        userId={selectedUserId}
        userEmail={selectedUser?.email || ''}
        onClose={() => setResetOpen(false)}
      />
      <TransactionListDialog
        open={transactionOpen}
        userId={selectedUserId}
        userEmail={selectedUser?.email || ''}
        onClose={() => setTransactionOpen(false)}
      />
      <BatchTopupDialog
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        onSuccess={fetchUsers}
      />
    </>
  );
}
