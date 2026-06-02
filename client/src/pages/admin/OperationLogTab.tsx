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
  TextField,
  MenuItem,
  TablePagination,
  Chip,
  CircularProgress,
} from '@mui/material';
import { adminGetOperationLogs, type AdminOperationLog } from '@/api/admin';

const ACTION_LABELS: Record<string, string> = {
  credit_topup: '手动充值',
  batch_topup: '批量充值',
  reset_password: '重置密码',
  disable_user: '禁用用户',
  enable_user: '启用用户',
};

export default function OperationLogTab() {
  const [logs, setLogs] = useState<AdminOperationLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminGetOperationLogs({
        page,
        pageSize,
        action: actionFilter || undefined,
      });
      setLogs(result.items);
      setTotal(result.total);
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <>
      <Typography variant="h6" sx={{ mb: 2 }}>
        操作日志
      </Typography>

      <Box sx={{ mb: 2 }}>
        <TextField
          label="操作类型"
          select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          size="small"
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">全部</MenuItem>
          <MenuItem value="credit_topup">手动充值</MenuItem>
          <MenuItem value="batch_topup">批量充值</MenuItem>
          <MenuItem value="reset_password">重置密码</MenuItem>
          <MenuItem value="disable_user">禁用用户</MenuItem>
          <MenuItem value="enable_user">启用用户</MenuItem>
        </TextField>
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>管理员</TableCell>
              <TableCell>操作</TableCell>
              <TableCell>目标用户ID</TableCell>
              <TableCell>详情</TableCell>
              <TableCell>时间</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => {
                return (
                  <TableRow key={log.id}>
                    <TableCell>{log.id}</TableCell>
                    <TableCell>{log.adminEmail}</TableCell>
                    <TableCell>
                      <Chip
                        label={ACTION_LABELS[log.action] || log.action}
                        size="small"
                        color={
                          log.action === 'disable_user' ? 'error' :
                          log.action === 'enable_user' ? 'success' :
                          log.action.includes('topup') ? 'info' :
                          'default'
                        }
                      />
                    </TableCell>
                    <TableCell>{log.targetUserId ?? '-'}</TableCell>
                    <TableCell sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.detail || '-'}
                    </TableCell>
                    <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                );
              })
            )}
            {!loading && logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
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
    </>
  );
}
