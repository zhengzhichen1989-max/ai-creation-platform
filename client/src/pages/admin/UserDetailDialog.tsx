import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Divider,
  CircularProgress,
} from '@mui/material';
import { adminGetUser, type AdminUserDetail } from '@/api/admin';

interface Props {
  open: boolean;
  userId: number | null;
  onClose: () => void;
}

export default function UserDetailDialog({ open, userId, onClose }: Props) {
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && userId) {
      setLoading(true);
      adminGetUser(userId)
        .then(setUser)
        .catch(() => setUser(null))
        .finally(() => setLoading(false));
    } else {
      setUser(null);
    }
  }, [open, userId]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>用户详情</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : user ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">ID</Typography>
              <Typography>{user.id}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">邮箱</Typography>
              <Typography>{user.email}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">昵称</Typography>
              <Typography>{user.nickname}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">角色</Typography>
              <Chip
                label={user.role === 'admin' ? '管理员' : '用户'}
                color={user.role === 'admin' ? 'primary' : 'default'}
                size="small"
              />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">状态</Typography>
              <Chip
                label={user.status === 'active' ? '正常' : '禁用'}
                color={user.status === 'active' ? 'success' : 'error'}
                size="small"
              />
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">积分余额</Typography>
              <Typography fontWeight="bold">{user.creditBalance}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">版本号</Typography>
              <Typography>{user.creditVersion}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">安全问题</Typography>
              <Typography>{user.securityQuestion || '未设置'}</Typography>
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">注册时间</Typography>
              <Typography>{new Date(user.createdAt).toLocaleString()}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">更新时间</Typography>
              <Typography>{new Date(user.updatedAt).toLocaleString()}</Typography>
            </Box>
          </Box>
        ) : (
          <Typography color="text.secondary" sx={{ py: 2 }}>无法加载用户信息</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
}
