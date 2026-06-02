import { Box, Typography, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TablePagination } from '@mui/material';
import { useState } from 'react';
import dayjs from 'dayjs';
import { useTransactions } from '@/hooks/useCredits';
import type { CreditTransaction } from '@/api/credits';

const TYPE_LABELS: Record<string, string> = {
  purchase: '充值',
  consume: '消费',
  refund: '退还',
};

const TYPE_COLORS: Record<string, 'success' | 'error' | 'default'> = {
  purchase: 'success',
  consume: 'error',
  refund: 'default',
};

export function CreditsHistory() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const { data, isLoading } = useTransactions({
    page: page + 1,
    pageSize: rowsPerPage,
  });

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  if (isLoading) {
    return <Typography color="text.secondary">加载中...</Typography>;
  }

  const items: CreditTransaction[] = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <Box>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>类型</TableCell>
              <TableCell>变动数量</TableCell>
              <TableCell>变动后余额</TableCell>
              <TableCell>描述</TableCell>
              <TableCell>时间</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>
                  <Chip
                    label={TYPE_LABELS[tx.type] ?? tx.type}
                    color={TYPE_COLORS[tx.type] ?? 'default'}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Typography
                    variant="body2"
                    color={tx.type === 'consume' ? 'error' : 'success'}
                    fontWeight={600}
                  >
                    {tx.type === 'consume' ? '-' : '+'}{tx.amount}
                  </Typography>
                </TableCell>
                <TableCell>{tx.balanceAfter}</TableCell>
                <TableCell>{tx.description || '-'}</TableCell>
                <TableCell>{dayjs(tx.createdAt).format('YYYY-MM-DD HH:mm')}</TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    暂无记录
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[10, 20, 50]}
        labelRowsPerPage="每页条数"
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} / 共 ${count} 条`}
      />
    </Box>
  );
}
