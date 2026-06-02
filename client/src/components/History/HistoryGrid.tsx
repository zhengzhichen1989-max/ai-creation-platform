import { useState } from 'react';
import { Grid, TablePagination, Box, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import * as generationsApi from '@/api/generations';
import { HistoryCard } from './HistoryCard';

interface HistoryGridProps {
  type?: 'image' | 'video';
}

export function HistoryGrid({ type }: HistoryGridProps) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(12);

  const { data, isLoading } = useQuery({
    queryKey: ['generations', type, page, rowsPerPage],
    queryFn: () =>
      generationsApi.listGenerations({
        type,
        page: page + 1,
        pageSize: rowsPerPage,
      }),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

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

  return (
    <Box>
      {items.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography color="text.secondary">暂无创作记录</Typography>
        </Box>
      ) : (
        <>
          <Grid container spacing={2}>
            {items.map((item) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={item.id}>
                <HistoryCard item={item} />
              </Grid>
            ))}
          </Grid>

          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[12, 24, 48]}
            labelRowsPerPage="每页条数"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} / 共 ${count} 条`}
            sx={{ mt: 2 }}
          />
        </>
      )}
    </Box>
  );
}
