import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  TextField,
  MenuItem,
  Menu,
  TablePagination,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddIcon from '@mui/icons-material/Add';
import {
  adminListUsers,
  adminUpdateUserStatus,
  adminDeleteUser,
  type AdminUserListItem,
} from '@/api/admin';
import UserDetailDialog from './UserDetailDialog';
import CreditTopupDialog from './CreditTopupDialog';
import ResetPasswordDialog from './ResetPasswordDialog';
import TransactionListDialog from './TransactionListDialog';
import BatchTopupDialog from './BatchTopupDialog';
import { useSnackbarStore } from '@/stores/snackbar.store';

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserListItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(null);

  // Menu state
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuUser, setMenuUser] = useState<AdminUserListItem | null>(null);

  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);

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

  const handleDeleteClick = (user: AdminUserListItem) => {
    setDeleteTarget(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await adminDeleteUser(deleteTarget.id);
      showSnackbar(`用户 ${deleteTarget.nickname}（${deleteTarget.email}）已删除`, 'success');
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      fetchUsers();
    } catch {
      // error handled by interceptor
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, user: AdminUserListItem) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuUser(user);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuUser(null);
  };

  const handleMenuAction = (action: string) => {
    if (!menuUser) return;
    switch (action) {
      case 'topup': setSelectedUserId(menuUser.id); setSelectedUser(menuUser); setTopupOpen(true); break;
      case 'reset': setSelectedUserId(menuUser.id); setSelectedUser(menuUser); setResetOpen(true); break;
      case 'transaction': setSelectedUserId(menuUser.id); setSelectedUser(menuUser); setTransactionOpen(true); break;
      case 'toggle': handleToggleStatus(menuUser); break;
      case 'delete': handleDeleteClick(menuUser); break;
    }
    handleMenuClose();
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

      {/* 用户列表 — 用原生 HTML table + Tailwind 替代 MUI Table，避免点击事件被拦截 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2 text-left font-medium text-gray-600">ID</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">邮箱</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">昵称</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">角色</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">状态</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">积分余额</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">注册时间</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                  <CircularProgress size={24} />
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2">{user.id}</td>
                  <td className="px-3 py-2">{user.email}</td>
                  <td className="px-3 py-2">{user.nickname}</td>
                  <td className="px-3 py-2">
                    <Chip
                      label={user.role === 'admin' ? '管理员' : '用户'}
                      color={user.role === 'admin' ? 'primary' : 'default'}
                      size="small"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Chip
                      label={user.status === 'active' ? '正常' : '禁用'}
                      color={user.status === 'active' ? 'success' : 'error'}
                      size="small"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">{user.creditBalance}</td>
                  <td className="px-3 py-2">{new Date(user.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    <button
                      onClick={() => openDialog('detail', user)}
                      title="详情"
                      className="inline-flex items-center justify-center p-1.5 rounded-full hover:bg-gray-100 text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      <VisibilityIcon fontSize="small" />
                    </button>
                    <button
                      onClick={(e) => handleMenuOpen(e, user)}
                      title="更多操作"
                      className="inline-flex items-center justify-center p-1.5 rounded-full hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <MoreVertIcon fontSize="small" />
                    </button>
                  </td>
                </tr>
              ))
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                  暂无数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        component="div"
        count={total}
        page={page - 1}
        onPageChange={(_, p) => setPage(p + 1)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }}
        rowsPerPageOptions={[10, 20, 50]}
      />

      {/* 操作菜单 — 通过 portal 渲染，不受 table 影响 */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleMenuAction('topup')}>充值</MenuItem>
        <MenuItem onClick={() => handleMenuAction('reset')}>重置密码</MenuItem>
        <MenuItem onClick={() => handleMenuAction('transaction')}>流水</MenuItem>
        <MenuItem onClick={() => handleMenuAction('toggle')} disabled={menuUser?.role === 'admin'}>
          {menuUser?.status === 'active' ? '禁用' : '启用'}
        </MenuItem>
        <MenuItem
          onClick={() => handleMenuAction('delete')}
          disabled={menuUser?.role === 'admin'}
          sx={{ color: menuUser?.role !== 'admin' ? '#d32f2f' : undefined }}
        >
          删除用户
        </MenuItem>
      </Menu>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>确认删除用户</DialogTitle>
        <DialogContent>
          <DialogContentText>
            确定要删除用户 <strong>{deleteTarget?.nickname}</strong>（{deleteTarget?.email}）吗？
            此操作不可撤销，该用户的所有积分记录、生成任务、服饰短片会话等数据将被永久删除。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleteLoading}>
            取消
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleteLoading}
          >
            {deleteLoading ? <CircularProgress size={20} color="inherit" /> : '确认删除'}
          </Button>
        </DialogActions>
      </Dialog>

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
