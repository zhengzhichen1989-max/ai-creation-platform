import { Card, CardContent, Typography, Box } from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useBalance } from '@/hooks/useCredits';

export function CreditsBalance() {
  const { data, isLoading } = useBalance();

  const balance = data?.balance ?? 0;

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, #6200ea 0%, #9b66ff 100%)',
        color: '#fff',
      }}
    >
      <CardContent sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <AccountBalanceWalletIcon />
          <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
            当前积分余额
          </Typography>
        </Box>
        {isLoading ? (
          <Typography variant="h3">--</Typography>
        ) : (
          <Typography variant="h3" sx={{ fontWeight: 700 }}>
            {balance.toLocaleString()}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
