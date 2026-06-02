import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  Chip,
  Box,
  CircularProgress,
  TextField,
  MenuItem,
} from '@mui/material';
import { adminGetTransactions, type CreditTransactionInfo } from '@/api/admin';

interface Props {
  open: boolean;
  userId: number | null;
  userEmail: string;
  onClose: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  purchase: '购买',
  consume: '消费',
  refund: '退款',
  admin_topup: '管理员充值',
};

const TYPE_COLORS: Record<string, 'success' | 'error' | 'warning' | 'info'> = {
  purchase: 'success',
  consume: 'error',
  refund: 'warning',
  admin_topup: 'info',
};

export default function TransactionListDialog({ open, userId, userEmail, onClose }: Props) {
  const [transactions, setTransactions] = useState<CreditTransactionInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && userId) {
      setLoading(true);
      adminGetTransactions(userId, {
        page,
        pageSize,
        type: typeFilter || undefined,
      })
        .then((result) => {
          setTransactions(result.items);
          setTotal(result.total);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open, userId, page, pageSize, typeFilter]);

  const handleClose = () => {
    setTransactions([]);
    setTotal(0);
    setPage(1);
    setTypeFilter('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>积分流水 — {userEmail}</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <TextField
            label="类型筛选"
            select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            size="small"
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">全部</MenuItem>
            <MenuItem value="purchase">购买</MenuItem>
            <MenuItem value="consume">消费</MenuItem>
            <MenuItem value="refund">退款</MenuItem>
            <MenuItem value="admin_topup">管理员充值</MenuItem>
          </TextField>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>类型</TableCell>
                  <TableCell align="right">数量</TableCell>
                  <TableCell align="right">变动后余额</TableCell>
                  <TableCell>描述</TableCell>
                  <TableCell>时间</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{tx.id}</TableCell>
                    <TableCell>
                      <Chip
                        label={TYPE_LABELS[tx.type] || tx.type}
                        color={TYPE_COLORS[tx.type] || 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ color: tx.type === 'consume' ? 'error.main' : 'success.main' }}>
                      {tx.type === 'consume' ? '-' : '+'}{tx.amount}
                    </TableCell>
                    <TableCell align="right">{tx.balanceAfter}</TableCell>
                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.description || '-'}
                    </TableCell>
                    <TableCell>{new Date(tx.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {transactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      暂无数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <TablePagination
          component="div"
          count={total}
          page={page - 1}
          onPageChange={(_, p) => setPage(p + 1)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }}
          rowsPerPageOptions={[10, 20, 50]}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
}
