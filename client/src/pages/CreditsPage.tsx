import { Box, Typography, Divider } from '@mui/material';
import { CreditsBalance } from '@/components/Credits/CreditsBalance';
import { CreditsPackage } from '@/components/Credits/CreditsPackage';
import { CreditsHistory } from '@/components/Credits/CreditsHistory';

export default function CreditsPage() {
  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        积分充值
      </Typography>

      {/* Balance overview */}
      <CreditsBalance />

      <Divider sx={{ my: 4 }} />

      {/* Credit packages */}
      <Typography variant="h6" sx={{ mb: 2 }}>
        选择充值套餐
      </Typography>
      <CreditsPackage />

      <Divider sx={{ my: 4 }} />

      {/* Transaction history */}
      <Typography variant="h6" sx={{ mb: 2 }}>
        积分流水
      </Typography>
      <CreditsHistory />
    </Box>
  );
}
